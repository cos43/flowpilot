import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage as Message } from "ai";
import type { ComparisonModelConfig } from "@/components/model-comparison-config-dialog";
import type { ConversationBranch } from "@/contexts/conversation-context";
import { decodeDiagramXml, encodeDiagramXml, formatXML } from "@/lib/utils";
import {
    ComparisonCardResult,
    ComparisonHistoryEntry,
    ComparisonModelMeta,
    ComparisonResultStatus,
} from "@/types/comparison";
import type { DiagramRenderingMode, DiagramUpdateMeta } from "../types";
import type { ComparisonNotice } from "../types";
import { serializeAttachments } from "../utils/attachments";
import { cloneMessages } from "../utils/messages";
import type { RuntimeModelOption } from "@/types/model-config";
import { buildSvgRootXml } from "@/lib/svg";

interface UseComparisonWorkbenchParams {
    activeBranchId: string;
    activeBranch?: ConversationBranch | null;
    createBranch: (input?: any) => ConversationBranch | null;
    switchBranch: (branchId: string) => ConversationBranch | null;
    onFetchChart: () => Promise<string>;
    files: File[];
    briefContext: { prompt: string; badges: string[] };
    input: string;
    status: string;
    tryApplyRoot: (xml: string) => Promise<void>;
    handleDiagramXml: (xml: string, meta: DiagramUpdateMeta) => Promise<void>;
    getLatestDiagramXml: () => string;
    messages: Message[];
    modelOptions: RuntimeModelOption[];
    selectedModelKey?: string;
    renderMode: DiagramRenderingMode;
}

interface ActivePreview {
    requestId: string;
    resultId: string;
}

const drawioPreviewBaseUrl =
    process.env.NEXT_PUBLIC_DRAWIO_PREVIEW_URL ??
    "https://viewer.diagrams.net/";

export function useComparisonWorkbench({
    activeBranch,
    activeBranchId,
    createBranch,
    switchBranch,
    onFetchChart,
    files,
    briefContext,
    input,
    status,
    tryApplyRoot,
    handleDiagramXml,
    getLatestDiagramXml,
    messages,
    modelOptions,
    selectedModelKey,
    renderMode,
}: UseComparisonWorkbenchParams) {
    const initialModelKey = selectedModelKey ?? modelOptions[0]?.key ?? "";
    const [comparisonConfig, setComparisonConfig] =
        useState<ComparisonModelConfig>({
            models: [initialModelKey, initialModelKey],
        });
    const [isComparisonConfigOpen, setIsComparisonConfigOpen] = useState(false);
    const [comparisonHistory, setComparisonHistory] = useState<
        ComparisonHistoryEntry[]
    >([]);
    const [comparisonNotice, setComparisonNotice] =
        useState<ComparisonNotice | null>(null);
    const [isComparisonRunning, setIsComparisonRunning] = useState(false);
    const [activeComparisonPreview, setActiveComparisonPreview] =
        useState<ActivePreview | null>(null);
    const [requiresBranchDecision, setRequiresBranchDecision] = useState(false);
    const [pendingDecisionRequestId, setPendingDecisionRequestId] = useState<string | null>(null);
    const comparisonPreviewBaselineRef = useRef<string | null>(null);
    const comparisonNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null
    );
    const comparisonAbortRef = useRef<AbortController | null>(null);

    const getModelOption = useCallback(
        (key?: string) =>
            key ? modelOptions.find((option) => option.key === key) : undefined,
        [modelOptions]
    );

    const normalizeModelKey = useCallback(
        (key?: string) => {
            if (key && getModelOption(key)) {
                return key;
            }
            if (selectedModelKey && getModelOption(selectedModelKey)) {
                return selectedModelKey;
            }
            return modelOptions[0]?.key ?? "";
        },
        [getModelOption, modelOptions, selectedModelKey]
    );

    useEffect(() => {
        return () => {
            if (comparisonNoticeTimeoutRef.current) {
                clearTimeout(comparisonNoticeTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        setComparisonConfig((prev) => {
            // 验证并修正配置中的每个模型
            const validatedModels = prev.models
                .map(key => normalizeModelKey(key))
                .filter(Boolean);

            // 确保至少有2个模型
            while (validatedModels.length < 2) {
                validatedModels.push(normalizeModelKey());
            }

            // 检查是否有变化
            if (validatedModels.length === prev.models.length &&
                validatedModels.every((key, idx) => key === prev.models[idx])) {
                return prev;
            }

            return {
                models: validatedModels,
            };
        });
    }, [normalizeModelKey]);

    const beginComparisonRequest = useCallback(() => {
        if (comparisonAbortRef.current) {
            comparisonAbortRef.current.abort();
        }
        const controller = new AbortController();
        comparisonAbortRef.current = controller;
        return controller;
    }, []);

    const clearComparisonRequest = useCallback(() => {
        comparisonAbortRef.current = null;
    }, []);

    const triggerComparisonNotice = useCallback((type: "success" | "error", message: string) => {
        if (comparisonNoticeTimeoutRef.current) {
            clearTimeout(comparisonNoticeTimeoutRef.current);
        }
        setComparisonNotice({ type, message });
        comparisonNoticeTimeoutRef.current = setTimeout(() => {
            setComparisonNotice(null);
        }, 4000);
    }, []);

    const setBranchDecisionRequirement = useCallback((requestId: string | null) => {
        setPendingDecisionRequestId(requestId);
        setRequiresBranchDecision(Boolean(requestId));
    }, []);

    const cancelComparisonJobs = useCallback(
        (reason?: string) => {
            if (comparisonAbortRef.current) {
                comparisonAbortRef.current.abort();
                comparisonAbortRef.current = null;
            }

            setComparisonHistory((prev) =>
                prev.map((entry) => {
                    if (entry.status !== "loading") {
                        return entry;
                    }
                    const pauseReason =
                        reason ?? "模型对比任务已暂停，请稍后重试。";
                    const nextResults = entry.results.map((result) =>
                        result.status === "loading"
                            ? {
                                ...result,
                                status: "cancelled" as const,
                                error: pauseReason,
                            }
                            : result
                    );
                    const nextStatus = nextResults.every(
                        (result) => result.status === "cancelled"
                    )
                        ? "cancelled"
                        : "ready";
                    return {
                        ...entry,
                        status: nextStatus,
                        results: nextResults,
                    };
                })
            );

            setIsComparisonRunning(false);
            setBranchDecisionRequirement(null);
            if (reason) {
                triggerComparisonNotice("error", reason);
            }
        },
        [triggerComparisonNotice, setBranchDecisionRequirement]
    );

    const createComparisonEntry = useCallback(
        ({
            prompt,
            badges,
            models,
            anchorMessageId,
        }: {
            prompt: string;
            badges: string[];
            models: ComparisonModelMeta[];
            anchorMessageId: string | null;
        }) => {
            const requestId = `cmp-${Date.now()}-${Math.random()
                .toString(16)
                .slice(2)}`;
            const timestamp = new Date().toISOString();
            const entry: ComparisonHistoryEntry = {
                requestId,
                prompt,
                timestamp,
                badges,
                models,
                status: "loading",
                anchorMessageId,
                results: models.map((model) => ({
                    id: `${model.key}__${model.slot}`,
                    modelId: model.id,
                    label: model.label,
                    provider: model.provider,
                    slot: model.slot,
                    status: "loading",
                    runtime: model.runtime,
                })),
            };
            setComparisonHistory((prev) => [...prev, entry]);
            return requestId;
        },
        []
    );

    const updateComparisonEntry = useCallback(
        (
            requestId: string,
            updater: (entry: ComparisonHistoryEntry) => ComparisonHistoryEntry
        ) => {
            setComparisonHistory((prev) =>
                prev.map((entry) =>
                    entry.requestId === requestId ? updater(entry) : entry
                )
            );
        },
        []
    );

    const attachBranchToResult = useCallback(
        (resultId: string, branchId: string) => {
            if (!resultId || !branchId) {
                return;
            }
            setComparisonHistory((prev) =>
                prev.map((entry) => ({
                    ...entry,
                    results: entry.results.map((result) =>
                        result.id === resultId ? { ...result, branchId } : result
                    ),
                }))
            );
        },
        []
    );

    const createComparisonBranchesForResults = useCallback(
        (
            requestId: string,
            results: ComparisonCardResult[],
            originBranchId: string,
            seedMessages: Message[]
        ) => {
            // 边界检查
            if (!requestId || typeof requestId !== 'string') {
                console.error("无效的 requestId");
                return {};
            }

            if (!Array.isArray(results)) {
                console.error("results 必须是数组");
                return {};
            }

            if (!originBranchId || typeof originBranchId !== 'string') {
                console.error("无效的 originBranchId");
                return {};
            }

            if (!Array.isArray(seedMessages)) {
                console.warn("seedMessages 不是数组，使用空数组");
                seedMessages = [];
            }

            const bindings: Record<string, string> = {};
            results.forEach((result) => {
                // 只为成功的结果创建分支
                if (result.status !== "ok" || !result.xml) {
                    return;
                }

                const label =
                    result.label?.trim()?.length
                        ? `${result.label} · 分支`
                        : result.slot
                            ? `模型 ${result.slot} · 分支`
                            : `对比结果 · 分支`;

                const branch = createBranch({
                    parentId: originBranchId,
                    label,
                    diagramXml: result.xml ?? null,
                    meta: {
                        type: "comparison",
                        comparisonRequestId: requestId,
                        comparisonResultId: result.id,
                        label: result.label || result.modelId,
                    },
                    activate: false,
                    inheritMessages: false,
                    seedMessages,
                });
                if (branch) {
                    bindings[result.id] = branch.id;
                } else {
                    console.warn(`创建分支失败：result.id = ${result.id}`);
                }
            });
            return bindings;
        },
        [createBranch]
    );

    const clearComparisonPreview = useCallback(
        async (showNotice?: boolean) => {
            if (!comparisonPreviewBaselineRef.current) {
                setActiveComparisonPreview(null);
                return;
            }
            const baseline = comparisonPreviewBaselineRef.current;
            try {
                await tryApplyRoot(baseline);
                if (showNotice) {
                    triggerComparisonNotice("success", "已恢复预览前的画布。");
                }
            } catch (error) {
                console.error("Reset comparison preview failed:", error);
            } finally {
                comparisonPreviewBaselineRef.current = null;
                setActiveComparisonPreview(null);
            }
        },
        [triggerComparisonNotice, tryApplyRoot]
    );

    const buildComparisonPreviewUrl = useCallback((xmlOrEncoded: string) => {
        const trimmed = xmlOrEncoded?.trim();
        if (!trimmed) {
            return null;
        }
        try {
            const normalizedXml = trimmed.startsWith("<")
                ? trimmed
                : decodeDiagramXml(trimmed);
            if (!normalizedXml) {
                return null;
            }
            const encoded = encodeDiagramXml(normalizedXml);
            const url = new URL(drawioPreviewBaseUrl);
            url.searchParams.set("lightbox", "1");
            url.searchParams.set("nav", "1");
            url.searchParams.set("highlight", "0000FF");
            url.searchParams.set("layers", "1");
            url.hash = `R${encoded}`;
            return url.toString();
        } catch (error) {
            console.error("Failed to build preview url:", error);
            return null;
        }
    }, []);

    const normalizeComparisonResults = useCallback(
        (
            modelsMeta: ComparisonModelMeta[],
            rawResults: any[],
            defaultErrorMessage = "该模型未返回有效结果，请调整提示词后重试。"
        ): ComparisonCardResult[] => {
            const ensureString = (value: unknown) =>
                typeof value === "string" && value.trim().length > 0
                    ? value.trim()
                    : undefined;

            return modelsMeta.map((model, index) => {
                const item = rawResults?.[index] ?? {};
                const xml = ensureString(item?.xml);
                const svg = ensureString(item?.svg);
                const encodedXml = ensureString(
                    item?.encodedXml ?? item?.compressedXml ?? item?.raw
                );
                const previewSvg = ensureString(
                    item?.previewSvg ?? item?.svg ?? item?.thumbnailSvg
                );
                const previewImage = ensureString(
                    item?.previewImage ??
                    item?.image ??
                    item?.thumbnail ??
                    item?.previewUrl
                );
                const rawId = ensureString(item?.id) ?? model.id;
                const resultId = `${model.key}__${model.slot}`;
                let resolvedXml = xml;
                let mode: "drawio" | "svg" | undefined = renderMode === "svg" ? "svg" : "drawio";
                if (!resolvedXml && svg && renderMode !== "svg") {
                    try {
                        const { rootXml } = buildSvgRootXml(svg);
                        resolvedXml = rootXml;
                        mode = "svg";
                    } catch (error) {
                        console.error("Failed to convert SVG to root XML:", error);
                    }
                } else if (svg) {
                    mode = "svg";
                }
                const status: ComparisonResultStatus =
                    item?.status === "error" || (!resolvedXml && !svg)
                        ? "error"
                        : "ok";

                return {
                    id: resultId,
                    modelId: rawId,
                    label: ensureString(item?.label) ?? model.label,
                    provider: ensureString(item?.provider) ?? model.provider,
                    slot: model.slot,
                    status,
                    runtime: model.runtime,
                    summary:
                        status === "ok" && ensureString(item?.summary)
                            ? ensureString(item?.summary)
                            : "",
                    xml: status === "ok" ? resolvedXml : undefined,
                    svg: status === "ok" ? svg : undefined,
                    mode: status === "ok" ? mode : undefined,
                    encodedXml: status === "ok" ? encodedXml : undefined,
                    previewSvg: status === "ok" ? previewSvg : undefined,
                    previewImage: status === "ok" ? previewImage : undefined,
                    error:
                        status === "error"
                            ? ensureString(item?.error) ?? defaultErrorMessage
                            : undefined,
                };
            });
        },
        []
    );

    const handleDownloadXml = useCallback(
        (result: ComparisonCardResult) => {
            if (result.status !== "ok") {
                triggerComparisonNotice("error", "该模型没有可导出的结果。");
                return;
            }
            if (result.mode === "svg" && result.svg) {
                const blob = new Blob([result.svg], { type: "image/svg+xml" });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `${result.label ?? result.modelId}.svg`;
                anchor.click();
                URL.revokeObjectURL(url);
                triggerComparisonNotice("success", "已导出 SVG 文件。");
                return;
            }
            if (result.xml) {
                const blob = new Blob([formatXML(result.xml)], {
                    type: "application/xml",
                });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `${result.label ?? result.modelId}.xml`;
                anchor.click();
                URL.revokeObjectURL(url);
                triggerComparisonNotice("success", "已导出 XML 文件。");
                return;
            }
            triggerComparisonNotice("error", "该模型缺少可导出的 XML 或 SVG。");
        },
        [triggerComparisonNotice]
    );

    const handleApplyComparisonResult = useCallback(
        async (result: ComparisonCardResult) => {
            // 边界检查：验证结果对象
            if (!result || typeof result !== 'object') {
                triggerComparisonNotice("error", "无效的对比结果对象");
                return;
            }

            if (result.status !== "ok" || (!result.xml && !result.svg)) {
                triggerComparisonNotice("error", "该模型没有可应用的结果。");
                return;
            }

            // 获取可用的内容：SVG 模式优先使用 svg，其余模式使用 XML（必要时转换）
            let canvasPayload = renderMode === "svg" ? result.svg ?? "" : result.xml ?? "";
            if (renderMode !== "svg" && !canvasPayload && result.svg) {
                try {
                    const { rootXml } = buildSvgRootXml(result.svg);
                    canvasPayload = rootXml;
                } catch (error) {
                    triggerComparisonNotice("error", "SVG 转换失败，无法应用结果。");
                    return;
                }
            }

            const trimmedXml = (canvasPayload || "").trim();
            if (trimmedXml.length === 0) {
                triggerComparisonNotice("error", "返回内容为空，无法应用。");
                return;
            }

            if (result.branchId) {
                const branch = switchBranch(result.branchId);
                if (branch) {
                    comparisonPreviewBaselineRef.current = null;
                    setActiveComparisonPreview(null);
                    setBranchDecisionRequirement(null);
                    const relatedEntry = comparisonHistory.find((entry) =>
                        entry.results.some((item) => item.id === result.id)
                    );
                    if (relatedEntry?.requestId) {
                        updateComparisonEntry(relatedEntry.requestId, (entry) => {
                            if (entry.adoptedResultId === result.id) {
                                return entry;
                            }
                            return { ...entry, adoptedResultId: result.id };
                        });
                    }
                    triggerComparisonNotice(
                        "success",
                        `已切换至「${branch.label}」，可继续在该版本上对话。`
                    );
                    return;
                }
            }

            try {
                await handleDiagramXml(trimmedXml, {
                    origin: "display",
                    modelRuntime: result.runtime,
                });

                // 边界检查：确保有有效的消息历史
                const branchMessages = cloneMessages(activeBranch?.messages ?? []);
                const relatedEntry = comparisonHistory.find((entry) =>
                    entry.results.some((item) => item.id === result.id)
                );

                // 生成合理的分支标签
                const branchLabel = result.label?.trim()?.length
                    ? `${result.label} · 分支`
                    : result.slot
                        ? `模型 ${result.slot} · 分支`
                        : `对比结果 · 分支`;

                const created = createBranch({
                    label: branchLabel,
                    diagramXml: trimmedXml,
                    meta: {
                        type: "comparison",
                        comparisonResultId: result.id,
                        comparisonRequestId: relatedEntry?.requestId,
                        label: result.label || result.modelId,
                    },
                    seedMessages: branchMessages,
                });

                if (created) {
                    attachBranchToResult(result.id, created.id);
                } else {
                    console.warn("创建分支失败，但图表已应用");
                }

                if (relatedEntry?.requestId) {
                    updateComparisonEntry(relatedEntry.requestId, (entry) => {
                        if (entry.adoptedResultId === result.id) {
                            return entry;
                        }
                        return { ...entry, adoptedResultId: result.id };
                    });
                }
                comparisonPreviewBaselineRef.current = null;
                setActiveComparisonPreview(null);
                setBranchDecisionRequirement(null);
                triggerComparisonNotice(
                    "success",
                    `已采用「${created?.label ?? result.label ?? result.modelId}」的画布，并开启新分支。`
                );
            } catch (error) {
                console.error("应用对比结果失败：", error);
                const message =
                    error instanceof Error
                        ? error.message
                        : "应用模型输出失败，请稍后重试。";
                triggerComparisonNotice("error", message);
            }
        },
        [
            activeBranch,
            attachBranchToResult,
            comparisonHistory,
            createBranch,
            handleDiagramXml,
            setBranchDecisionRequirement,
            switchBranch,
            triggerComparisonNotice,
            updateComparisonEntry,
        ]
    );

    const handlePreviewComparisonResult = useCallback(
        async (requestId: string, result: ComparisonCardResult) => {
            if (
                activeComparisonPreview &&
                activeComparisonPreview.requestId === requestId &&
                activeComparisonPreview.resultId === result.id
            ) {
                await clearComparisonPreview(true);
                return;
            }
            if (result.status !== "ok" || !result.xml) {
                triggerComparisonNotice("error", "该模型未返回可预览的 XML。");
                return;
            }
            try {
                if (!comparisonPreviewBaselineRef.current) {
                    comparisonPreviewBaselineRef.current = getLatestDiagramXml();
                }
                await tryApplyRoot(result.xml);
                setActiveComparisonPreview({
                    requestId,
                    resultId: result.id,
                });
                triggerComparisonNotice("success", `已预览「${result.label}」。`);
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : "预览时发生未知错误。";
                triggerComparisonNotice("error", `预览失败：${message}`);
            }
        },
        [
            activeComparisonPreview,
            clearComparisonPreview,
            getLatestDiagramXml,
            triggerComparisonNotice,
            tryApplyRoot,
        ]
    );

    const ensureBranchSelectionSettled = useCallback(
        (options?: { allowRequestId?: string }) => {
            if (!requiresBranchDecision) {
                return true;
            }
            if (
                options?.allowRequestId &&
                pendingDecisionRequestId &&
                options.allowRequestId === pendingDecisionRequestId
            ) {
                return true;
            }
            triggerComparisonNotice(
                "error",
                "请先在上次对比结果中选择一个分支，再继续操作。"
            );
            return false;
        },
        [pendingDecisionRequestId, requiresBranchDecision, triggerComparisonNotice]
    );

    const handleCompareRequest = useCallback(async (userMessageId?: string) => {
        if (status === "streaming" || isComparisonRunning) {
            triggerComparisonNotice(
                "error",
                status === "streaming"
                    ? "AI 正在回答其他请求，请稍后再试。"
                    : "已有模型对比任务在执行，请稍候。"
            );
            return;
        }
        if (!input.trim()) {
            triggerComparisonNotice("error", "请输入对比提示词后再试。");
            return;
        }
        if (!ensureBranchSelectionSettled()) {
            return;
        }

        // 从配置中获取所有选中的模型
        const resolvedOptions: RuntimeModelOption[] = [];

        // 允许相同模型重复出现，以便用户测试同一模型的随机性/稳定性
        for (const modelKey of comparisonConfig.models) {
            const option = getModelOption(modelKey);
            if (option) {
                resolvedOptions.push(option);
            }
        }

        // 如果配置为空，尝试使用当前选中的模型
        if (resolvedOptions.length === 0 && selectedModelKey) {
            const fallback = getModelOption(selectedModelKey);
            if (fallback) {
                resolvedOptions.push(fallback);
            }
        }

        if (resolvedOptions.length === 0) {
            triggerComparisonNotice(
                "error",
                "请先在模型设置里添加至少一个模型，再执行对比。"
            );
            return;
        }

        // 确保至少有2个模型用于对比
        if (resolvedOptions.length < 2) {
            // 如果只有一个模型，复制它作为第二个
            resolvedOptions.push(resolvedOptions[0]);
        }

        const slots = ["A", "B", "C", "D", "E"];
        const modelsMeta: ComparisonModelMeta[] = resolvedOptions.map(
            (option, index) => {
                const slot = slots[index] ?? "A";
                return {
                    key: option.key,
                    id: option.modelId,
                    label: `${option.label || option.modelId} · 模型 ${slot}`,
                    provider: option.providerHint,
                    slot,
                    runtime: {
                        modelId: option.modelId,
                        baseUrl: option.baseUrl,
                        apiKey: option.apiKey,
                        label: option.label,
                    },
                };
            }
        );

        const enrichedInput =
            briefContext.prompt.length > 0
                ? `${briefContext.prompt}\n\n${input}`
                : input;
        const originBranchId = activeBranchId;
        const branchSeedMessages = cloneMessages(activeBranch?.messages ?? []);

        // 直接使用传入的 userMessageId 作为锚点
        // 确保对比结果能正确关联到用户消息
        const anchorMessageId = userMessageId ?? null;

        const requestId = createComparisonEntry({
            prompt: enrichedInput, // 立即保存提示词，确保在任何状态下都能看到
            badges: briefContext.badges,
            models: modelsMeta,
            anchorMessageId,
        });
        setBranchDecisionRequirement(requestId);

        try {
            setIsComparisonRunning(true);
            const controller = beginComparisonRequest();

            let chartXml = await onFetchChart();

            const attachments =
                files.length > 0 ? await serializeAttachments(files) : [];

            const requestBody: Record<string, any> = {
                models: modelsMeta.map((model) => ({
                    id: model.id,
                    key: model.key,
                    label: model.label,
                    provider: model.provider,
                    slot: model.slot,
                    runtime: model.runtime,
                })),
                prompt: enrichedInput,
                xml: chartXml,
                brief: briefContext.prompt,
                renderMode,
            };

            if (attachments.length > 0) {
                requestBody.attachments = attachments;
            }

            const response = await fetch("/api/model-compare", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                    errorText || "模型对比接口返回错误，请稍后再试。"
                );
            }

            const data = await response.json();
            const rawResults: any[] = Array.isArray(data?.results)
                ? data.results
                : [];

            const normalizedResults = normalizeComparisonResults(
                modelsMeta,
                rawResults
            );
            const bindings = createComparisonBranchesForResults(
                requestId,
                normalizedResults,
                originBranchId,
                branchSeedMessages
            );
            const enrichedResults = normalizedResults.map((result) => ({
                ...result,
                branchId: bindings[result.id],
            }));
            const hasUsableBranch = normalizedResults.some(
                (result) =>
                    result.status === "ok" &&
                    (Boolean(result.xml) || Boolean(result.svg))
            );
            if (!hasUsableBranch) {
                setBranchDecisionRequirement(null);
            }

            updateComparisonEntry(requestId, (entry) => ({
                ...entry,
                status: "ready",
                prompt: enrichedInput,
                results: enrichedResults,
            }));

            const allError = normalizedResults.every(
                (result) => result.status === "error"
            );
            triggerComparisonNotice(
                allError ? "error" : "success",
                allError
                    ? "两个模型均未返回有效结果，请检查提示词或模型设置。"
                    : "模型对比完成，结果已展示在对话中。"
            );
            clearComparisonRequest();
        } catch (error) {
            clearComparisonRequest();
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }
            console.error("Model comparison failed:", error);
            const message =
                error instanceof Error
                    ? error.message
                    : "模型对比失败，请稍后重试。";
            const fallbackResults: ComparisonCardResult[] = modelsMeta.map(
                (model) => ({
                    id: `${model.key}__${model.slot}`,
                    modelId: model.id,
                    label: model.label,
                    provider: model.provider,
                    slot: model.slot,
                    status: "error",
                    runtime: model.runtime,
                    summary: "",
                    xml: undefined,
                    encodedXml: undefined,
                    previewSvg: undefined,
                    previewImage: undefined,
                    error: message,
                })
            );
            const bindings = createComparisonBranchesForResults(
                requestId,
                fallbackResults,
                originBranchId,
                branchSeedMessages
            );
            const enrichedFallback = fallbackResults.map((result) => ({
                ...result,
                branchId: bindings[result.id],
            }));
            updateComparisonEntry(requestId, (entry) => ({
                ...entry,
                status: "ready",
                prompt: enrichedInput,
                results: enrichedFallback,
            }));
            triggerComparisonNotice("error", message);
            setBranchDecisionRequirement(null);
        } finally {
            setIsComparisonRunning(false);
        }
    }, [
        activeBranch,
        activeBranchId,
        beginComparisonRequest,
        briefContext,
        comparisonConfig.models,
        createComparisonBranchesForResults,
        createComparisonEntry,
        ensureBranchSelectionSettled,
        files,
        getModelOption,
        input,
        isComparisonRunning,
        messages,
        normalizeComparisonResults,
        onFetchChart,
        selectedModelKey,
        setBranchDecisionRequirement,
        status,
        triggerComparisonNotice,
        updateComparisonEntry,
        renderMode,
    ]);

    const handleRetryComparisonResult = useCallback(
        async (
            entry: ComparisonHistoryEntry,
            targetResult: ComparisonCardResult
        ) => {
            if (
                !ensureBranchSelectionSettled({
                    allowRequestId: entry.requestId,
                })
            ) {
                return;
            }

            // 检查该result是否已经在loading中（防止重复点击）
            const currentEntry = comparisonHistory.find(e => e.requestId === entry.requestId);
            const currentResult = currentEntry?.results.find(r => r.id === targetResult.id);
            if (currentResult?.status === "loading") {
                triggerComparisonNotice(
                    "error",
                    "该模型正在生成中，请稍等。"
                );
                return;
            }

            if (!entry || !targetResult) {
                return;
            }

            await clearComparisonPreview();
            const originBranchId = activeBranchId;
            const branchSeedMessages = cloneMessages(activeBranch?.messages ?? []);
            setBranchDecisionRequirement(entry.requestId);

            updateComparisonEntry(entry.requestId, (current) => ({
                ...current,
                status: "loading",
                results: current.results.map((item) =>
                    item.id === targetResult.id
                        ? {
                            ...item,
                            status: "loading",
                            summary: "",
                            xml: undefined,
                            encodedXml: undefined,
                            previewSvg: undefined,
                            previewImage: undefined,
                            error: undefined,
                        }
                        : item
                ),
            }));

            try {
                // 只在该result的范围内设置running状态
                // 不影响全局的isComparisonRunning
                const controller = beginComparisonRequest();

                let chartXml = await onFetchChart();

                const response = await fetch("/api/model-compare", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        models: entry.models.map((model) => ({
                            id: model.id,
                            key: model.key,
                            label: model.label,
                            provider: model.provider,
                            slot: model.slot,
                            runtime: model.runtime,
                        })),
                        prompt: entry.prompt,
                        xml: chartXml,
                        brief: briefContext.prompt,
                    }),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(
                        errorText || "模型对比接口返回错误，请稍后再试。"
                    );
                }

                const data = await response.json();
                const rawResults: any[] = Array.isArray(data?.results)
                    ? data.results
                    : [];

                const normalizedResults = normalizeComparisonResults(
                    entry.models,
                    rawResults
                );
                const bindings = createComparisonBranchesForResults(
                    entry.requestId,
                    normalizedResults,
                    originBranchId,
                    branchSeedMessages
                );
                const enrichedResults = normalizedResults.map((result) => ({
                    ...result,
                    branchId: bindings[result.id],
                }));
                const hasUsableBranch = normalizedResults.some(
                    (result) => result.status === "ok" && Boolean(result.xml)
                );
                if (!hasUsableBranch) {
                    setBranchDecisionRequirement(null);
                }

                updateComparisonEntry(entry.requestId, (current) => ({
                    ...current,
                    status: "ready",
                    results: enrichedResults,
                }));

                triggerComparisonNotice("success", "已重新生成模型输出。");
                clearComparisonRequest();
            } catch (error) {
                clearComparisonRequest();
                if (error instanceof DOMException && error.name === "AbortError") {
                    return;
                }
                console.error("Retry comparison failed:", error);
                const message =
                    error instanceof Error
                        ? error.message
                        : "模型对比失败，请稍后再试。";
                updateComparisonEntry(entry.requestId, (current) => ({
                    ...current,
                    status: "ready",
                    results: current.results.map((item) =>
                        item.id === targetResult.id
                            ? {
                                ...item,
                                status: "error",
                                xml: undefined,
                                encodedXml: undefined,
                                previewSvg: undefined,
                                previewImage: undefined,
                                error: message,
                            }
                            : item
                    ),
                }));
                triggerComparisonNotice("error", message);
                setBranchDecisionRequirement(null);
            } finally {
                // 不需要设置全局的isComparisonRunning为false
                // 因为我们没有设置为true
            }
        },
        [
            activeBranch,
            activeBranchId,
            beginComparisonRequest,
            briefContext,
            clearComparisonPreview,
            createComparisonBranchesForResults,
            ensureBranchSelectionSettled,
            comparisonHistory,
            normalizeComparisonResults,
            onFetchChart,
            setBranchDecisionRequirement,
            triggerComparisonNotice,
            updateComparisonEntry,
        ]
    );

    useEffect(() => {
        const requestId = activeBranch?.meta?.comparisonRequestId;
        if (!requestId) {
            return;
        }
        const adoptedId = activeBranch?.meta?.comparisonResultId ?? null;
        updateComparisonEntry(requestId, (current) => {
            if (current.adoptedResultId === adoptedId) {
                return current;
            }
            return {
                ...current,
                adoptedResultId: adoptedId,
            };
        });
    }, [activeBranch, updateComparisonEntry]);

    const pruneHistoryByMessageIds = useCallback((allowedIds: Set<string>) => {
        setComparisonHistory((prev) =>
            prev.filter((entry) => {
                if (!entry.anchorMessageId) {
                    return true;
                }
                return allowedIds.has(entry.anchorMessageId);
            })
        );
    }, []);

    const resetWorkbench = useCallback(() => {
        setComparisonHistory([]);
        setComparisonNotice(null);
        if (comparisonNoticeTimeoutRef.current) {
            clearTimeout(comparisonNoticeTimeoutRef.current);
            comparisonNoticeTimeoutRef.current = null;
        }
        comparisonPreviewBaselineRef.current = null;
        setActiveComparisonPreview(null);
        setBranchDecisionRequirement(null);
    }, [setBranchDecisionRequirement]);

    const releaseBranchRequirement = useCallback(() => {
        setBranchDecisionRequirement(null);
    }, [setBranchDecisionRequirement]);

    return {
        comparisonConfig,
        setComparisonConfig,
        isComparisonConfigOpen,
        setIsComparisonConfigOpen,
        comparisonHistory,
        comparisonNotice,
        isComparisonRunning,
        activeComparisonPreview,
        requiresBranchDecision,
        handleCompareRequest,
        handleRetryComparisonResult,
        handleApplyComparisonResult,
        handlePreviewComparisonResult,
        handleDownloadXml,
        buildComparisonPreviewUrl,
        ensureBranchSelectionSettled,
        resetWorkbench,
        releaseBranchRequirement,
        pruneHistoryByMessageIds,
        notifyComparison: triggerComparisonNotice,
        cancelComparisonJobs,
    };
}
