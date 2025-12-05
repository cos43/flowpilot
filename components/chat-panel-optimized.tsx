"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {FaGithub} from "react-icons/fa";
import Link from "next/link";
import {
    AlertCircle,
    CheckCircle2,
    Copy,
    FileText,
    Handshake,
    ListMinus,
    ListPlus,
    PanelRightClose,
    PauseCircle,
    Sparkles,
    MoreHorizontal,
    LayoutGrid,
    MessageSquare,
    History,
    Settings,
    Info,
} from "lucide-react";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {useChat} from "@ai-sdk/react";
import {DefaultChatTransport} from "ai";
import {ChatInputOptimized} from "@/components/chat-input-optimized";
import {ChatMessageDisplay} from "./chat-message-display-optimized";
import {useDiagram} from "@/contexts/diagram-context";
import {useConversationManager} from "@/contexts/conversation-context";
import {useSvgEditor} from "@/contexts/svg-editor-context";
import {cn, formatXML, replaceXMLParts, convertToLegalXml, replaceNodes} from "@/lib/utils";
import {buildSvgRootXml, repairSvg, svgToDataUrl} from "@/lib/svg";
import {SessionStatus} from "@/components/session-status";
import {QuickActionBar} from "@/components/quick-action-bar";
import type {QuickActionDefinition} from "@/components/quick-action-bar";

import {
    FlowPilotBriefLauncher,
    FlowPilotBriefDialog,
    FlowPilotBriefState,
    DEFAULT_BRIEF_STATE,
    FOCUS_OPTIONS,
    INTENT_OPTIONS,
    TONE_OPTIONS,
    DIAGRAM_TYPE_OPTIONS,
    FLOWPILOT_FREEFORM_PROMPT,
} from "./flowpilot-brief";
import {ReportBlueprintTray} from "./report-blueprint-tray";
import {useChatState} from "@/hooks/use-chat-state";
import {EMPTY_MXFILE} from "@/lib/diagram-templates";
import {ModelComparisonConfigDialog} from "@/components/model-comparison-config-dialog";
import {ToolPanelSidebar} from "@/features/chat-panel/components/tool-panel-sidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {QUICK_ACTIONS, TOOLBAR_ACTIONS, TOOLBAR_PANELS} from "@/features/chat-panel/constants";
import {useComparisonWorkbench} from "@/features/chat-panel/hooks/use-comparison-workbench";
import {useDiagramOrchestrator} from "@/features/chat-panel/hooks/use-diagram-orchestrator";
import type {DiagramRenderingMode, DiagramResultEntry, DiagramUpdateMeta, ToolPanel} from "@/features/chat-panel/types";
import {serializeAttachments} from "@/features/chat-panel/utils/attachments";
import {useModelRegistry} from "@/hooks/use-model-registry";
import {ModelConfigDialog} from "@/components/model-config-dialog";
import {ConversationHistoryDialog} from "@/components/conversation-history-dialog";
import {DiagramGalleryDialog} from "@/components/diagram-gallery-dialog";
import {useConversationHistory, type ConversationHistoryItem} from "@/hooks/use-conversation-history";
import type {RuntimeModelConfig} from "@/types/model-config";
import {TemplateGallery} from "@/components/template-gallery";
import {BriefQuickControl} from "@/components/brief-quick-control";
import {RenderModeToggle} from "@/components/render-mode-toggle";
import {SmartSvgConverterDialog} from "@/components/smart-svg-converter-dialog";

interface ChatPanelProps {
    onCollapse?: () => void;
    isCollapsible?: boolean;
    renderMode?: DiagramRenderingMode;
    onRenderModeChange?: (mode: DiagramRenderingMode) => void;
}

export default function ChatPanelOptimized({
                                               onCollapse,
                                               isCollapsible = false,
                                               renderMode: controlledRenderMode,
                                               onRenderModeChange,
                                           }: ChatPanelProps) {
    const {
        loadDiagram: onDisplayChart,
        loadDiagramImmediate,
        chartXML,
        clearDiagram,
        diagramHistory: mxDiagramHistory,
        restoreDiagramAt,
        fetchDiagramXml,
        fetchDiagramData,
        runtimeError,
        setRuntimeError,
    } = useDiagram();
    const {
        loadSvgMarkup,
        exportSvgMarkup,
        clearSvg,
        history: svgHistory,
        restoreHistoryAt: restoreSvgHistoryAt,
        setStreamingSvgContent,
    } = useSvgEditor();
    const [internalRenderMode, setInternalRenderMode] = useState<DiagramRenderingMode>("svg");
    const renderMode = controlledRenderMode ?? internalRenderMode;
    const isSvgMode = renderMode === "svg";
    const handleRenderModeChange = useCallback(
        (mode: DiagramRenderingMode) => {
            if (onRenderModeChange) {
                onRenderModeChange(mode);
            } else {
                setInternalRenderMode(mode);
            }
        },
        [onRenderModeChange]
    );

    const {
        isConversationStarted,
        messageCount,
        isCompactMode,
        startConversation,
        incrementMessageCount,
        clearConversation,
        toggleCompactMode,
    } = useChatState();
    const {
        activeBranch,
        activeBranchId,
        branchTrail,
        branchList,
        createBranch,
        switchBranch,
        updateActiveBranchMessages,
        updateActiveBranchDiagram,
        resetActiveBranch,
    } = useConversationManager();
    const {handleDiagramXml, tryApplyRoot, applyRootPatch, updateLatestDiagramXml, getLatestDiagramXml} =
        useDiagramOrchestrator({
            chartXML,
            onDisplayChart,
            updateActiveBranchDiagram,
        });
    const handleCanvasUpdate = useCallback(
        async (payload: string, meta: DiagramUpdateMeta) => {
            if (isSvgMode) {
                setStreamingSvgContent(null);
                loadSvgMarkup(payload);
                updateActiveBranchDiagram(payload);
                return;
            }
            await handleDiagramXml(payload, meta);
        },
        [isSvgMode, loadSvgMarkup, updateActiveBranchDiagram, handleDiagramXml, setStreamingSvgContent]
    );
    const tryApplyCanvasRoot = useCallback(
        async (xml: string) => {
            if (isSvgMode) {
                setStreamingSvgContent(null);
                loadSvgMarkup(xml);
                updateActiveBranchDiagram(xml);
                return;
            }
            await tryApplyRoot(xml);
        },
        [isSvgMode, loadSvgMarkup, updateActiveBranchDiagram, tryApplyRoot, setStreamingSvgContent]
    );
    const getLatestCanvasMarkup = useCallback(
        () => (isSvgMode ? exportSvgMarkup() : getLatestDiagramXml()),
        [isSvgMode, exportSvgMarkup, getLatestDiagramXml]
    );

    const lastBranchIdRef = useRef(activeBranchId);
    const streamingSvgFrameRef = useRef<number | null>(null);
    const latestStreamingSvgRef = useRef<string | null>(null);
    const lastPreviewLengthRef = useRef<number>(0);
    const lastPreviewAtRef = useRef<number>(0);
    const idleCallbackIdRef = useRef<number | null>(null);
    // draw.io 流式去重，尽量减少 reload
    const lastDrawioAppliedRef = useRef<string | null>(null);

    const normalizeStreamingSvg = useCallback((raw: string): string | null => {
        if (!raw || !raw.includes("<svg")) return null;
        let fixed = raw;
        // 丢弃末尾未完成的标签，避免浏览器在 parse 时反复回溯
        const lastOpen = fixed.lastIndexOf("<");
        const lastClose = fixed.lastIndexOf(">");
        if (lastOpen > lastClose) {
            fixed = fixed.slice(0, lastOpen);
        }
        // 简单闭合根节点，避免重复正则扫描
        if (!/<\/svg>\s*$/i.test(fixed)) {
            fixed += "</svg>";
        }
        return fixed;
    }, []);

    const flushStreamingSvgPreview = useCallback(() => {
        streamingSvgFrameRef.current = null;
        if (latestStreamingSvgRef.current === null) return;
        try {
            setStreamingSvgContent(latestStreamingSvgRef.current);
            lastPreviewLengthRef.current = latestStreamingSvgRef.current.length;
            lastPreviewAtRef.current = Date.now();
        } catch (error) {
            console.warn("应用 SVG 流式预览失败:", error);
        }
    }, [setStreamingSvgContent]);

    const queueStreamingSvgPreview = useCallback((svg: string) => {
        const normalized = normalizeStreamingSvg(svg);
        if (!normalized) return;

        // 低频节流：内容增长不明显且时间间隔很短时跳过，以避免浏览器在模型卡顿时频繁重绘
        const now = Date.now();
        const deltaLen = Math.abs(normalized.length - lastPreviewLengthRef.current);
        const elapsed = now - lastPreviewAtRef.current;
        const minDelta = 400; // 至少增长一定字符数再重绘
        const minElapsed = 900; // 或者间隔达到一定时间
        if (deltaLen < minDelta && elapsed < minElapsed) {
            latestStreamingSvgRef.current = normalized; // 记录最新数据，稍后一次性刷新
            return;
        }

        latestStreamingSvgRef.current = normalized;
        if (streamingSvgFrameRef.current !== null) return;
        // 在空闲时间优先更新，退化到 rAF
        if (typeof window.requestIdleCallback === "function") {
            idleCallbackIdRef.current = window.requestIdleCallback(() => {
                flushStreamingSvgPreview();
            }, { timeout: 800 });
        } else {
            streamingSvgFrameRef.current = window.requestAnimationFrame(flushStreamingSvgPreview);
        }
    }, [flushStreamingSvgPreview, normalizeStreamingSvg]);

    useEffect(() => {
        return () => {
            if (streamingSvgFrameRef.current !== null) {
                cancelAnimationFrame(streamingSvgFrameRef.current);
            }
            if (idleCallbackIdRef.current !== null && typeof window.cancelIdleCallback === "function") {
                window.cancelIdleCallback(idleCallbackIdRef.current);
            }
        };
    }, []);

    const fetchAndFormatDiagram = useCallback(
        async (options?: { saveHistory?: boolean }) => {
            if (isSvgMode) {
                return exportSvgMarkup();
            }
            const rawXml = await fetchDiagramXml(options);
            const formatted = formatXML(rawXml);
            updateLatestDiagramXml(formatted);
            return formatted;
        },
        [isSvgMode, exportSvgMarkup, fetchDiagramXml, updateLatestDiagramXml]
    );

    const onFetchChart = useCallback(async () => {
        return fetchAndFormatDiagram();
    }, [fetchAndFormatDiagram]);

    const {
        isReady: isModelRegistryReady,
        hasConfiguredModels,
        endpoints: modelEndpoints,
        models: modelOptions,
        selectedModelKey,
        selectedModel,
        selectModel,
        saveEndpoints,
    } = useModelRegistry();

    const [isModelConfigOpen, setIsModelConfigOpen] = useState(false);
    const hasPromptedModelSetup = useRef(false);
    const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
    const historyItems = useMemo(
        () =>
            isSvgMode
                ? svgHistory.map((item) => ({
                    svg: item.dataUrl || item.svg,
                }))
                : mxDiagramHistory,
        [isSvgMode, svgHistory, mxDiagramHistory]
    );
    const handleRestoreHistory = useCallback(
        (index: number) => {
            if (isSvgMode) {
                restoreSvgHistoryAt(index);
            } else {
                restoreDiagramAt(index);
            }
        },
        [isSvgMode, restoreDiagramAt, restoreSvgHistoryAt]
    );

    // 更新模型的流式设置
    const handleModelStreamingChange = useCallback((modelKey: string, isStreaming: boolean) => {
        const [endpointId, modelId] = modelKey.split(':');
        const updatedEndpoints = modelEndpoints.map(endpoint => {
            if (endpoint.id === endpointId) {
                return {
                    ...endpoint,
                    models: endpoint.models.map(model => {
                        if (model.id === modelId) {
                            return {...model, isStreaming, updatedAt: Date.now()};
                        }
                        return model;
                    }),
                    updatedAt: Date.now(),
                };
            }
            return endpoint;
        });
        saveEndpoints(updatedEndpoints);
    }, [modelEndpoints, saveEndpoints]);

    // State management
    const [files, setFiles] = useState<File[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [input, setInput] = useState("");
    const [briefState, setBriefState] = useState<FlowPilotBriefState>(() => ({
        ...DEFAULT_BRIEF_STATE,
    }));
    const [commandTab, setCommandTab] = useState<"starter" | "report" | "templates">(
        "templates"
    );
    const [activeToolPanel, setActiveToolPanel] = useState<ToolPanel | null>(null);
    const [isToolSidebarOpen, setIsToolSidebarOpen] = useState(false);
    const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
    const [isBriefDialogOpen, setIsBriefDialogOpen] = useState(false);
    const [isSmartSvgConverterOpen, setIsSmartSvgConverterOpen] = useState(false);
    const [prefillSvgForConvert, setPrefillSvgForConvert] = useState<string>("");
    const [contactCopyState, setContactCopyState] = useState<"idle" | "copied">(
        "idle"
    );

    // 对话历史相关状态
    const [isConversationHistoryOpen, setIsConversationHistoryOpen] = useState(false);
    const [isDiagramGalleryOpen, setIsDiagramGalleryOpen] = useState(false);

    // 使用对话历史 hook
    const {
        conversations,
        isLoading: isConversationHistoryLoading,
        saveCurrentConversation,
        deleteConversation,
        clearAllConversations,
    } = useConversationHistory();

    const diagramResultsRef = useRef<
        Map<string, DiagramResultEntry>
    >(new Map());
    const [diagramResultVersion, setDiagramResultVersion] = useState(0);
    const lastLoadedSvgResultIdRef = useRef<string | null>(null);
    const getDiagramResult = useCallback(
        (toolCallId: string) => diagramResultsRef.current.get(toolCallId),
        []
    );

    useEffect(() => {
        if (
            isModelRegistryReady &&
            !hasConfiguredModels &&
            !hasPromptedModelSetup.current
        ) {
            setIsModelConfigOpen(true);
            hasPromptedModelSetup.current = true;
        }
    }, [hasConfiguredModels, isModelRegistryReady]);

    useEffect(() => {
        if (hasConfiguredModels) {
            hasPromptedModelSetup.current = false;
        }
    }, [hasConfiguredModels]);

    useEffect(() => {
        if (!isSvgMode) return;
        const entries = Array.from(diagramResultsRef.current.entries());
        if (entries.length === 0) return;
        const lastWithSvg = [...entries]
            .reverse()
            .find(([, value]) => value.mode === "svg" && value.svg);
        if (!lastWithSvg) return;
        const [resultId, value] = lastWithSvg;
        if (lastLoadedSvgResultIdRef.current === resultId) return;
        loadSvgMarkup(value.svg!);
        updateActiveBranchDiagram(value.svg!);
        lastLoadedSvgResultIdRef.current = resultId;
    }, [isSvgMode, diagramResultVersion, loadSvgMarkup, updateActiveBranchDiagram]);

    const briefMode = briefState.mode ?? "guided";
    const briefContext = useMemo(() => {
        if (briefMode === "free") {
            return {
                prompt: FLOWPILOT_FREEFORM_PROMPT,
                badges: [
                    "自由·AI 自主选型",
                    "默认·干净美观",
                ],
                mode: briefMode,
            };
        }

        const intentMeta = INTENT_OPTIONS.find(
            (option) => option.id === briefState.intent
        );
        const toneMeta = TONE_OPTIONS.find(
            (option) => option.id === briefState.tone
        );
        const focusMeta = FOCUS_OPTIONS.filter((option) =>
            briefState.focus.includes(option.id)
        );
        const diagramTypeMeta = DIAGRAM_TYPE_OPTIONS.filter((option) =>
            briefState.diagramTypes.includes(option.id)
        );

        const segments: string[] = [];
        const badges: string[] = [];

        if (intentMeta) {
            segments.push(`模式：「${intentMeta.title}」— ${intentMeta.prompt}`);
            badges.push(`模式·${intentMeta.title}`);
        }
        if (toneMeta) {
            segments.push(`视觉：${toneMeta.prompt}`);
            badges.push(`视觉·${toneMeta.title}`);
        }
        if (focusMeta.length > 0) {
            segments.push(
                `重点：${focusMeta.map((item) => item.prompt).join("；")}`
            );
            focusMeta.forEach((item) => badges.push(`重点·${item.title}`));
        }
        if (diagramTypeMeta.length > 0) {
            segments.push(
                `图型：${diagramTypeMeta
                    .map((item) => item.prompt)
                    .join("；")}`
            );
            diagramTypeMeta.forEach((item) =>
                badges.push(`图型·${item.title}`)
            );
        }

        const prompt =
            segments.length > 0
                ? `### FlowPilot Brief\\n${segments
                    .map((segment) => `- ${segment}`)
                    .join("\\n")}`
                : "";

        return {prompt, badges, mode: briefMode};
    }, [briefMode, briefState]);
    const {
        messages,
        sendMessage,
        addToolResult,
        status,
        error,
        setMessages,
        stop,
    } =
        useChat({
            transport: new DefaultChatTransport({
                api: "/api/chat",
            }),
            async onToolCall({toolCall}) {
                if (toolCall.toolName === "display_diagram") {
                    const {xml} = toolCall.input as { xml?: string };
                    try {
                        if (!xml || typeof xml !== "string" || !xml.trim()) {
                            throw new Error("大模型返回的 XML 为空，无法渲染。");
                        }

                        let finalXml = xml;
                        let isSvgContent = false;

                        // 检查是否为 SVG 内容（如果模型错误地使用了 display_diagram 返回 SVG）
                        if (xml.trim().startsWith("<svg") || xml.trim().startsWith("<?xml")) {
                            try {
                                // 尝试作为 SVG 处理
                                const {rootXml} = buildSvgRootXml(xml);
                                finalXml = rootXml;
                                isSvgContent = true;
                                console.log("Detected SVG content in display_diagram, wrapped as DrawIO image.");
                            } catch (e) {
                                // 如果解析失败，可能是普通 XML，忽略错误继续尝试作为 DrawIO XML 加载
                                console.warn("Failed to parse potential SVG content:", e);
                            }
                        }

                        // 立即渲染到画布
                        // 在 SVG 模式下也强制走 draw.io 渲染，避免被 SVG 编辑器截流
                        const cleanXml = convertToLegalXml(finalXml);
                        if (isSvgMode) {
                            handleRenderModeChange("drawio");
                            setStreamingSvgContent(null);
                            await handleDiagramXml(cleanXml, {
                                origin: "display",
                                modelRuntime: selectedModel ?? undefined,
                            });
                        } else {
                            await handleCanvasUpdate(cleanXml, {
                                origin: "display",
                                modelRuntime: selectedModel ?? undefined,
                            });
                        }

                        // 同时保存到 diagramResultsRef 供后续使用
                        console.log("Saving diagram to gallery:", toolCall.toolCallId, cleanXml.slice(0, 50));
                        diagramResultsRef.current.set(toolCall.toolCallId, {
                            xml: cleanXml,
                            mode: isSvgContent ? "drawio" : "drawio", // 仍然是 drawio 模式，因为是在 drawio 画布上渲染
                            runtime: selectedModel ?? undefined,
                            // 如果是 SVG 内容，我们也保存原始 SVG 以备不时之需（虽然 gallery 主要用 xml/svg 快照）
                            svg: isSvgContent ? xml : undefined
                        });
                        setDiagramResultVersion((prev) => prev + 1);

                        // 延迟获取 SVG 快照用于画廊展示
                        setTimeout(async () => {
                            try {
                                const {svg} = await fetchDiagramData({saveHistory: false});
                                const current = diagramResultsRef.current.get(toolCall.toolCallId);
                                if (current) {
                                    diagramResultsRef.current.set(toolCall.toolCallId, {
                                        ...current,
                                        svg,
                                    });
                                    setDiagramResultVersion((prev) => prev + 1);
                                }
                            } catch (e) {
                                console.warn("Failed to capture SVG snapshot for gallery:", e);
                            }
                        }, 1000); // 等待渲染完成后截图

                        // 立即清除 input 中的 XML，避免在 DOM 中显示大量内容
                        if (toolCall.input && typeof toolCall.input === "object") {
                            (toolCall.input as Record<string, unknown>).xmlRef =
                                toolCall.toolCallId;
                            (toolCall.input as Record<string, unknown>).xmlLength =
                                xml.length;
                            (toolCall.input as Record<string, unknown>).xml = undefined;
                        }

                        addToolResult({
                            tool: "display_diagram",
                            toolCallId: toolCall.toolCallId,
                            output:
                                "Diagram rendered to canvas successfully.",
                        });
                    } catch (error) {
                        const message =
                            error instanceof Error
                                ? error.message
                                : "Failed to display diagram.";
                        addToolResult({
                            tool: "display_diagram",
                            toolCallId: toolCall.toolCallId,
                            output: `Failed to display diagram: ${message}`,
                        });
                    }
                } else if (toolCall.toolName === "display_svg") {
                    const {svg} = toolCall.input as { svg?: string };
                    try {
                        if (!svg || typeof svg !== "string" || !svg.trim()) {
                            throw new Error("大模型返回的 SVG 为空，无法渲染。");
                        }

                        if (isSvgMode) {
                            const fixed = repairSvg(svg);
                            setStreamingSvgContent(null); // Clear streaming preview
                            loadSvgMarkup(fixed);
                            updateActiveBranchDiagram(fixed);
                            diagramResultsRef.current.set(toolCall.toolCallId, {
                                xml: fixed,
                                svg: fixed,
                                mode: "svg",
                                runtime: selectedModel ?? undefined,
                            });
                            setDiagramResultVersion((prev) => prev + 1);

                            addToolResult({
                                tool: "display_svg",
                                toolCallId: toolCall.toolCallId,
                                output: "SVG 已载入新编辑器，可直接编辑。",
                            });
                            return;
                        }

                        const {rootXml} = buildSvgRootXml(svg);

                        await handleCanvasUpdate(rootXml, {
                            origin: "display",
                            modelRuntime: selectedModel ?? undefined,
                            toolCallId: toolCall.toolCallId,
                        });

                        const mergedXml = getLatestDiagramXml();
                        diagramResultsRef.current.set(toolCall.toolCallId, {
                            xml: mergedXml,
                            svg,
                            mode: "svg",
                            runtime: selectedModel ?? undefined,
                        });
                        setDiagramResultVersion((prev) => prev + 1);

                        if (toolCall.input && typeof toolCall.input === "object") {
                            (toolCall.input as Record<string, unknown>).svgRef =
                                toolCall.toolCallId;
                            (toolCall.input as Record<string, unknown>).svgLength =
                                svg.length;
                            (toolCall.input as Record<string, unknown>).svg = undefined;
                        }

                        addToolResult({
                            tool: "display_svg",
                            toolCallId: toolCall.toolCallId,
                            output: "SVG 已转换并渲染到画布。",
                        });
                    } catch (error) {
                        const message =
                            error instanceof Error
                                ? error.message
                                : "Failed to display SVG.";
                        addToolResult({
                            tool: "display_svg",
                            toolCallId: toolCall.toolCallId,
                            output: `Failed to display SVG: ${message}`,
                        });
                    }
                } else if (toolCall.toolName === "edit_diagram") {
                    const {edits} = toolCall.input as {
                        edits: Array<{ search: string; replace: string }>;
                    };

                    let currentXml = "";
                    try {
                        currentXml = await fetchAndFormatDiagram({saveHistory: false});
                        const editedXml = replaceXMLParts(currentXml, edits);

                        // replaceXMLParts 返回完整的 XML，直接应用到画布
                        // 不应使用 handleDiagramXml，因为它期望接收 <root> 片段
                        onDisplayChart(editedXml);
                        updateActiveBranchDiagram(editedXml);
                        updateLatestDiagramXml(editedXml);

                        // 等待 draw.io 应用更新后再导出一次，确保历史记录中保存的是最新版本
                        try {
                            await new Promise((resolve) => setTimeout(resolve, 250));
                            await fetchAndFormatDiagram();
                        } catch (snapshotError) {
                            console.warn("Failed to capture diagram history after edit:", snapshotError);
                        }

                        addToolResult({
                            tool: "edit_diagram",
                            toolCallId: toolCall.toolCallId,
                            output: `Successfully applied ${edits.length} edit(s) to the diagram.`,
                        });
                    } catch (error) {
                        console.error("Edit diagram failed:", error);
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        addToolResult({
                            tool: "edit_diagram",
                            toolCallId: toolCall.toolCallId,
                            output: `Failed to edit diagram: ${errorMessage}`,
                        });
                    }
                }
            },
            onError: (error) => {
                console.error("Chat error:", error);
            },
        });

    const {
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
        notifyComparison,
        cancelComparisonJobs,
        pruneHistoryByMessageIds,
    } = useComparisonWorkbench({
        activeBranch,
        activeBranchId,
        createBranch,
        switchBranch,
        onFetchChart,
        files,
        briefContext,
        input,
        status,
        tryApplyRoot: tryApplyCanvasRoot,
        handleDiagramXml: handleCanvasUpdate,
        getLatestDiagramXml: getLatestCanvasMarkup,
        messages,
        modelOptions: modelOptions,
        selectedModelKey,
        renderMode,
    });
    const isComparisonAllowed = Boolean(selectedModel);

    const handleCopyXml = useCallback(
        async (xml: string) => {
            if (!xml || xml.trim().length === 0) {
                notifyComparison("error", "当前结果缺少 XML 内容，无法复制。");
                return;
            }
            try {
                await navigator.clipboard.writeText(xml);
                notifyComparison("success", "XML 已复制到剪贴板。");
            } catch (copyError) {
                console.error("Copy XML failed:", copyError);
                notifyComparison("error", "复制 XML 失败，请检查浏览器权限。");
            }
        },
        [notifyComparison]
    );

    const handleStopAll = useCallback(
        async (
            notice?: { type: "success" | "error"; message: string } | null
        ) => {
            try {
                if (status === "streaming" || status === "submitted") {
                    await stop();
                }
            } catch (stopError) {
                console.error("停止生成失败：", stopError);
            }
            cancelComparisonJobs();
            if (notice) {
                notifyComparison(notice.type, notice.message);
            }
        },
        [status, stop, cancelComparisonJobs, notifyComparison]
    );

    const handleRetryGeneration = useCallback(async () => {
        try {
            if (status === "streaming") {
                await stop();
            }

            // 找到最后一条用户消息
            const lastUserMessage = messages
                .slice()
                .reverse()
                .find(msg => msg.role === "user");

            if (!lastUserMessage) {
                console.error("没有找到用户消息可以重试");
                return;
            }

            // 删除最后一条AI回复（如果有的话）
            const lastMessageIndex = messages.length - 1;
            if (lastMessageIndex >= 0 && messages[lastMessageIndex].role === "assistant") {
                setMessages(messages.slice(0, lastMessageIndex));
            }

            // 重新发送最后一条用户消息
            const chartXml = await onFetchChart();
            const streamingFlag = selectedModel?.isStreaming ?? false;

            sendMessage(
                {parts: lastUserMessage.parts || []},
                {
                    body: {
                        xml: chartXml,
                        modelRuntime: selectedModel,
                        enableStreaming: streamingFlag,
                        renderMode,
                    },
                }
            );
        } catch (error) {
            console.error("重试生成失败：", error);
        }
    }, [status, stop, messages, setMessages, sendMessage, onFetchChart, selectedModel, renderMode]);

    const handleSmartSvgConvert = useCallback(async (svgContent: string, modelKey: string) => {
        setIsSmartSvgConverterOpen(false);
        handleRenderModeChange("drawio");
        if (modelKey !== selectedModelKey) {
            selectModel(modelKey);
        }

        // Wait a bit for state updates to propagate
        await new Promise(resolve => setTimeout(resolve, 100));

        const prompt = [
            "Convert this SVG into a fully editable draw.io diagram.",
            "Preserve 100% of layout, positions, sizes, colors, text, and connectors.",
            "Do not drop elements, avoid placeholders, return a single-page draw.io XML ready for editing."
        ].join(" ");

        // Use the same logic as form submit but bypassing the event
        try {
            let chartXml = await onFetchChart();
            const currentModel = modelOptions.find(m => m.key === modelKey) || selectedModel;

            if (!currentModel) {
                console.error("Model not found for conversion");
                return;
            }

            const streamingFlag = currentModel.isStreaming ?? false;

            const parts: Array<
                | { type: "text"; text: string; displayText?: string }
                | { type: "file"; url: string; mediaType: string }
            > = [
                {
                    type: "text",
                    text: `${prompt}\n\nSVG content:\n\`\`\`svg\n${svgContent}\n\`\`\``,
                    displayText: "请将这份 SVG 转绘为 Draw.io 图表",
                },
            ];

            sendMessage(
                {parts},
                {
                    body: {
                        xml: chartXml,
                        modelRuntime: currentModel,
                        enableStreaming: streamingFlag,
                        renderMode: "drawio",
                    },
                }
            );
        } catch (error) {
            console.error("Error initiating conversion:", error);
        }
    }, [handleRenderModeChange, selectedModelKey, selectModel, onFetchChart, modelOptions, selectedModel, sendMessage]);

    const handleOpenSvgConvert = useCallback(() => {
        const latest = getLatestCanvasMarkup();
        setPrefillSvgForConvert(typeof latest === "string" ? latest : "");
        setIsSmartSvgConverterOpen(true);
    }, [getLatestCanvasMarkup]);

    useEffect(() => {
        const handleConvertEvent = () => handleOpenSvgConvert();
        if (typeof window !== "undefined") {
            window.addEventListener("flowpilot:convert-svg", handleConvertEvent);
        }
        return () => {
            if (typeof window !== "undefined") {
                window.removeEventListener("flowpilot:convert-svg", handleConvertEvent);
            }
        };
    }, [handleOpenSvgConvert]);

    const handleCopyWechat = useCallback(async () => {
        try {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
                await navigator.clipboard.writeText("leland1999");
            } else if (typeof window !== "undefined") {
                const fallback = window.prompt("复制微信号", "leland1999");
                if (fallback === null) {
                    throw new Error("用户取消复制。");
                }
            }
            setContactCopyState("copied");
            setTimeout(() => setContactCopyState("idle"), 1800);
        } catch (error) {
            console.error("复制微信号失败：", error);
            setContactCopyState("idle");
        }
    }, []);

    // 监听消息变化，自动启动对话状态
    useEffect(() => {
        const userMessages = messages.filter((message) => message.role === "user");
        if (userMessages.length > 0 && !isConversationStarted) {
            startConversation();
        }
        if (userMessages.length > messageCount) {
            incrementMessageCount();
        }
    }, [messages, isConversationStarted, messageCount, startConversation, incrementMessageCount]);

    // 自动保存对话历史
    useEffect(() => {
        if (messages.length > 0) {
            // 延迟保存，避免频繁保存
            const timer = setTimeout(() => {
                const latestDiagram = getLatestCanvasMarkup();
                saveCurrentConversation(messages, renderMode, latestDiagram, diagramResultsRef.current);
            }, 3000); // 3秒延迟保存

            return () => clearTimeout(timer);
        }
    }, [messages, renderMode, getLatestCanvasMarkup, saveCurrentConversation]);

    useEffect(() => {
        if (isConversationStarted) {
            setActiveToolPanel(null);
            setIsToolSidebarOpen(false);
        }
    }, [isConversationStarted]);

    useEffect(() => {
        if (!activeBranch) {
            return;
        }
        if (activeBranch.messages === messages) {
            return;
        }
        updateActiveBranchMessages(messages);
    }, [messages, activeBranch, updateActiveBranchMessages]);

    useEffect(() => {
        if (
            showHistory &&
            (status === "streaming" || status === "submitted" || isComparisonRunning)
        ) {
            void handleStopAll({
                type: "error",
                message: "查看历史时已暂停当前生成。",
            });
        }
    }, [showHistory, status, isComparisonRunning, handleStopAll]);

    const onFormSubmit = useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (status === "streaming") {
                return;
            }
            if (!input.trim()) {
                return;
            }
            if (!ensureBranchSelectionSettled()) {
                return;
            }
            if (!selectedModel) {
                setIsModelConfigOpen(true);
                return;
            }
            try {
                let chartXml = await onFetchChart();
                const streamingFlag = selectedModel?.isStreaming ?? false;

                const enrichedInput =
                    briefContext.prompt.length > 0
                        ? `${briefContext.prompt}\n\n${input}`
                        : input;

                const parts: Array<
                    | { type: "text"; text: string; displayText?: string }
                    | { type: "file"; url: string; mediaType: string }
                > = [{type: "text", text: enrichedInput, displayText: input}];

                if (files.length > 0) {
                    const attachments = await serializeAttachments(files);
                    attachments.forEach(({url, mediaType}) => {
                        parts.push({
                            type: "file",
                            url,
                            mediaType,
                        });
                    });
                }

                sendMessage(
                    {parts},
                    {
                        body: {
                            xml: chartXml,
                            modelRuntime: selectedModel,
                            enableStreaming: streamingFlag,
                            renderMode,
                        },
                    }
                );

                setInput("");
                setFiles([]);
            } catch (submissionError) {
                console.error("Error fetching chart data:", submissionError);
            }
        },
        [
            status,
            input,
            ensureBranchSelectionSettled,
            onFetchChart,
            briefContext.prompt,
            files,
            sendMessage,
            selectedModel,
            setIsModelConfigOpen,
            renderMode,
        ]
    );

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        setInput(e.target.value);
    };

    const handleFileChange = (newFiles: File[]) => {
        setFiles(newFiles);
    };

    const handleQuickAction = async (action: QuickActionDefinition) => {
        if (status === "streaming") return;
        if (!ensureBranchSelectionSettled()) return;
        setInput(action.prompt);

        if (action.attachment) {
            try {
                const response = await fetch(action.attachment.path);
                const blob = await response.blob();
                const file = new File([blob], action.attachment.fileName, {
                    type: action.attachment.mime,
                });
                handleFileChange([file]);
            } catch (err) {
                console.error("Failed to attach reference asset:", err);
            }
        } else if (files.length > 0) {
            handleFileChange([]);
        }
    };

    const handleBranchSwitch = useCallback(
        async (branchId: string) => {
            if (branchId === activeBranchId) {
                return;
            }
            await handleStopAll({
                type: "error",
                message: "已暂停当前生成，准备切换分支。",
            });
            switchBranch(branchId);
        },
        [activeBranchId, handleStopAll, switchBranch]
    );

    const handleBlueprintTemplate = (prompt: string) => {
        if (status === "streaming") return;
        if (!ensureBranchSelectionSettled()) return;
        setInput(prompt);
        if (files.length > 0) {
            handleFileChange([]);
        }
    };

    const handleClearChat = () => {
        void handleStopAll({
            type: "success",
            message: "已清空当前对话并停止生成。",
        });
        setMessages([]);
        resetActiveBranch();
        updateActiveBranchDiagram(isSvgMode ? null : EMPTY_MXFILE);
        if (isSvgMode) {
            clearSvg();
        } else {
            clearDiagram();
        }
        clearConversation();
        resetWorkbench();
    };

    const exchanges = messages.filter(
        (message) => message.role === "user" || message.role === "assistant"
    ).length;

    // 对话历史处理函数
    const handleShowConversationHistory = useCallback(() => {
        if (status === "streaming") return;
        setIsConversationHistoryOpen(true);
    }, [status]);

    const handleShowDiagramGallery = useCallback(() => {
        if (status === "streaming") return;
        setIsDiagramGalleryOpen(true);
    }, [status]);

    const handleStartNewConversation = useCallback(async () => {
        // 保存当前对话
        if (messages.length > 0) {
            const latestDiagram = getLatestCanvasMarkup();
            saveCurrentConversation(messages, renderMode, latestDiagram, diagramResultsRef.current);
        }

        // 清空当前状态
        await handleClearChat();
    }, [messages, getLatestCanvasMarkup, saveCurrentConversation, renderMode, handleClearChat]);

    const handleLoadConversation = useCallback(async (conversation: ConversationHistoryItem) => {
        // 停止当前的生成
        await handleStopAll({
            type: "success",
            message: "已加载历史对话。",
        });

        // 1. 先重置状态，防止旧状态干扰
        clearConversation();
        resetActiveBranch();

        // 2. 恢复消息
        if (conversation.messagesData) {
            setMessages(conversation.messagesData);
            // 关键：立即同步到 activeBranch，防止 useConversationManager 中的 effect 
            // 检测到 messages 变化但 activeBranch 尚未更新导致的不一致或覆盖
            updateActiveBranchMessages(conversation.messagesData);
        }

        // 3. 恢复图表结果
        if (conversation.diagramResults) {
            diagramResultsRef.current.clear();
            conversation.diagramResults.forEach(diagram => {
                diagramResultsRef.current.set(diagram.id, {
                    xml: diagram.xml || "",
                    svg: diagram.svg || "",
                    mode: diagram.mode,
                });
            });
            setDiagramResultVersion(prev => prev + 1);
        }

        // 4. 如果有图表数据，恢复画布
        if (conversation.finalDiagramXml) {
            if (conversation.renderMode === "svg") {
                loadSvgMarkup(conversation.finalDiagramXml);
            } else {
                await handleDiagramXml(conversation.finalDiagramXml, {
                    origin: "display",
                    modelRuntime: undefined,
                });
            }
            updateActiveBranchDiagram(conversation.finalDiagramXml);
        } else {
            // 清空画布
            if (isSvgMode) {
                clearSvg();
            } else {
                clearDiagram();
            }
        }
    }, [handleStopAll, setMessages, resetActiveBranch, isSvgMode, loadSvgMarkup, clearSvg, handleDiagramXml, clearDiagram, clearConversation, updateActiveBranchMessages, updateActiveBranchDiagram]);

    const toggleToolPanel = async (panel: ToolPanel) => {
        if (panel === 'converter') {
            setIsSmartSvgConverterOpen(true);
            return;
        }

        if (panel === 'starter') {
            // 新建对话动作：保存历史（如有）并重置，同时关闭侧边栏
            if (messages.length > 0) {
                await handleStartNewConversation();
            } else {
                // 如果已经是空对话，也尝试清理一下可能存在的草稿状态
                handleClearChat();
            }
            // 确保侧边栏关闭，不打扰用户
            setActiveToolPanel(null);
            setIsToolSidebarOpen(false);
            return;
        }

        if (panel === 'actions') {
            setCommandTab('templates');
        }
        setActiveToolPanel((current) => {
            const next = current === panel ? null : panel;
            setIsToolSidebarOpen(next !== null);
            return next;
        });
    };

    const closeToolSidebar = () => {
        setActiveToolPanel(null);
        setIsToolSidebarOpen(false);
    };

    useEffect(() => {
        if (!activeBranch) {
            return;
        }
        const branchChanged = lastBranchIdRef.current !== activeBranchId;
        const messagesMismatch = activeBranch.messages !== messages;

        if (branchChanged && activeBranch.diagramXml) {
            (async () => {
                try {
                    await handleDiagramXml(activeBranch.diagramXml!, {
                        origin: "display",
                        modelRuntime: undefined,
                    });
                } catch (error) {
                    console.error("切换分支应用画布失败：", error);
                }
            })();
        }

        if (branchChanged && messagesMismatch) {
            setMessages(activeBranch.messages);
        }

        if (branchChanged) {
            if (
                status === "streaming" ||
                status === "submitted" ||
                isComparisonRunning
            ) {
                void handleStopAll({
                    type: "error",
                    message: "已切换分支，自动暂停生成。",
                });
            }
            lastBranchIdRef.current = activeBranchId;
        }
    }, [
        activeBranch,
        activeBranchId,
        handleStopAll,
        handleDiagramXml,
        isComparisonRunning,
        messages,
        setMessages,
        status,
    ]);

    const handleMessageRevert = useCallback(
        ({messageId, text}: { messageId: string; text: string }) => {
            const targetIndex = messages.findIndex(
                (message) => message.id === messageId
            );
            if (targetIndex < 0) {
                return;
            }
            const truncated = messages.slice(0, targetIndex);
            const labelSuffix =
                targetIndex + 1 <= 9
                    ? `0${targetIndex + 1}`
                    : `${targetIndex + 1}`;
            const revertBranch = createBranch({
                parentId: activeBranchId,
                label: `回滚 · 消息 ${labelSuffix}`,
                meta: {
                    type: "history",
                    label: `消息 ${labelSuffix}`,
                },
                diagramXml: activeBranch?.diagramXml ?? null,
                seedMessages: truncated,
                inheritMessages: false,
            });
            setMessages(truncated);
            setInput(text ?? "");
            if (!revertBranch) {
                updateActiveBranchMessages(truncated);
            }
            pruneHistoryByMessageIds(new Set(truncated.map((msg) => msg.id)));
            releaseBranchRequirement();
        },
        [
            activeBranch,
            activeBranchId,
            createBranch,
            messages,
            setMessages,
            setInput,
            updateActiveBranchMessages,
            releaseBranchRequirement,
            pruneHistoryByMessageIds,
        ]
    );

    const renderToolPanel = () => {
        if (!activeToolPanel) return null;

        if (activeToolPanel === "brief") {
            return (
                <FlowPilotBriefLauncher
                    state={briefState}
                    onChange={(next) =>
                        setBriefState((prev) => ({...prev, ...next}))
                    }
                    disabled={status === "streaming"}
                    badges={briefContext.badges}
                    modelEndpoints={modelEndpoints}
                    modelOptions={modelOptions}
                    selectedModelKey={selectedModelKey}
                    onSelectModel={selectModel}
                    onManageModels={() => setIsModelConfigOpen(true)}
                />
            );
        }

        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div
                        className="inline-flex items-center rounded-full bg-slate-100 p-1 overflow-x-auto scrollbar-hide">
                        <button
                            type="button"
                            onClick={() => {
                                setCommandTab("templates");
                                setActiveToolPanel("actions");
                            }}
                            className={cn(
                                "rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition",
                                commandTab === "templates"
                                    ? "bg-white text-slate-900 shadow"
                                    : "text-slate-500"
                            )}
                        >
                            📚 模板库
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setCommandTab("starter");
                                setActiveToolPanel("starter");
                            }}
                            className={cn(
                                "rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition",
                                commandTab === "starter"
                                    ? "bg-white text-slate-900 shadow"
                                    : "text-slate-500"
                            )}
                        >
                            灵感起稿
                        </button>
                        <button
                            type="button"
                            onClick={() => setCommandTab("report")}
                            className={cn(
                                "rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition",
                                commandTab === "report"
                                    ? "bg-white text-slate-900 shadow"
                                    : "text-slate-500"
                            )}
                        >
                            述职模板
                        </button>
                    </div>
                </div>
                {commandTab === "templates" ? (
                    <div className="flex h-full flex-col">
                        <div className="flex-1 overflow-hidden">
                            <TemplateGallery
                                variant="compact"
                                onSelectTemplate={(template) => {
                                    if (status === "streaming") return;
                                    if (!ensureBranchSelectionSettled()) return;
                                    // Apply template brief and send prompt
                                    setBriefState(template.brief);
                                    setInput(template.prompt);
                                    if (files.length > 0) {
                                        handleFileChange([]);
                                    }
                                    closeToolSidebar();
                                }}
                                onExpand={() => setIsTemplateDialogOpen(true)}
                            />
                        </div>
                    </div>
                ) : commandTab === "starter" ? (
                    <QuickActionBar
                        actions={QUICK_ACTIONS}
                        disabled={status === "streaming" || requiresBranchDecision}
                        onSelect={handleQuickAction}
                        variant="plain"
                        title=""
                        subtitle=""
                    />
                ) : commandTab === "report" ? (
                    <ReportBlueprintTray
                        disabled={status === "streaming" || requiresBranchDecision}
                        onUseTemplate={(template) =>
                            handleBlueprintTemplate(template.prompt)
                        }
                    />
                ) : null}
            </div>
        );
    };

    const showSessionStatus = !isCompactMode || !isConversationStarted;
    const isGenerationBusy =
        status === "streaming" || status === "submitted" || isComparisonRunning;
    const shouldShowSidebar = Boolean(activeToolPanel && isToolSidebarOpen);

    return (
        <>
            <Card className="relative flex h-full max-h-full min-h-0 flex-col gap-0 rounded-none py-0 overflow-hidden">
                <CardHeader className="flex shrink-0 flex-col gap-1 border-b border-slate-100/50 px-3 py-1.5">
                    <div
                        className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl backdrop-blur-xl bg-white/60 border border-white/40 px-2.5 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.4)]">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {TOOLBAR_PANELS.map((panel) => {
                                const {label, icon: Icon} = TOOLBAR_ACTIONS[panel];
                                const isActive = activeToolPanel === panel && isToolSidebarOpen;
                                return (
                                    <button
                                        key={panel}
                                        type="button"
                                        onClick={() => toggleToolPanel(panel)}
                                        className={cn(
                                            "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-all duration-200",
                                            isActive
                                                ? "bg-slate-900 text-white shadow-[0_2px_8px_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.15)] scale-[1.02]"
                                                : "text-slate-700 hover:bg-white/40 active:scale-95"
                                        )}
                                        title={label}
                                    >
                                        <Icon className="h-3.5 w-3.5"/>
                                        <span className="leading-none">{label}</span>
                                    </button>
                                );
                            })}
                            <button
                                type="button"
                                onClick={handleShowConversationHistory}
                                className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium text-slate-700 transition-all duration-200 hover:bg-white/40 active:scale-95"
                                title="历史记录"
                            >
                                <History className="h-3.5 w-3.5"/>
                                <span className="leading-none">历史记录</span>
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-medium text-slate-700 transition-all duration-200 hover:bg-white/40 active:scale-95"
                                    >
                                        <MoreHorizontal className="h-4 w-4"/>
                                        <span className="hidden sm:inline">更多</span>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                    <DropdownMenuLabel>工具</DropdownMenuLabel>
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setCommandTab("templates");
                                            toggleToolPanel("actions");
                                        }}
                                    >
                                        <FileText className="mr-2 h-4 w-4"/>
                                        模板库
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => toggleToolPanel("brief")}>
                                        <Sparkles className="mr-2 h-4 w-4"/>
                                        配置（Brief）
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleOpenSvgConvert}>
                                        <Sparkles className="mr-2 h-4 w-4"/>
                                        转绘为 draw.io
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator/>
                                    <DropdownMenuLabel>记录</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={handleShowConversationHistory}>
                                        <History className="mr-2 h-4 w-4"/>
                                        对话历史
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleShowDiagramGallery}>
                                        <LayoutGrid className="mr-2 h-4 w-4"/>
                                        图表画廊
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setIsComparisonConfigOpen(true)}>
                                        <Settings className="mr-2 h-4 w-4"/>
                                        对比配置
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator/>
                                    <DropdownMenuLabel>帮助</DropdownMenuLabel>
                                    <DropdownMenuItem asChild>
                                        <Link
                                            href="/about"
                                            className="flex items-center"
                                        >
                                            <Info className="mr-2 h-4 w-4"/>
                                            关于
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setContactCopyState("idle");
                                            setIsContactDialogOpen(true);
                                        }}
                                    >
                                        <Handshake className="mr-2 h-4 w-4"/>
                                        交流联系
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <a
                                            href="https://github.com/cos43/flowpilot"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center"
                                        >
                                            <FaGithub className="mr-2 h-4 w-4"/>
                                            GitHub
                                        </a>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            {isCollapsible && (
                                <button
                                    type="button"
                                    onClick={onCollapse}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-50"
                                    aria-label="收起聊天"
                                    title="收起聊天"
                                >
                                    <PanelRightClose className="h-4 w-4"/>
                                </button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-1 min-h-0 flex-col overflow-hidden">
                    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
                        {!selectedModel && (
                            <div
                                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-2 text-sm text-amber-900">
                                <div>
                                    FlowPilot 需要至少配置一个模型接口才能开始生成，请先填写 Base URL、API Key 与模型 ID。
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    className="rounded-full bg-amber-900 text-white hover:bg-amber-900/90"
                                    onClick={() => setIsModelConfigOpen(true)}
                                >
                                    立即配置
                                </Button>
                            </div>
                        )}
                        <div className="relative flex flex-1 min-h-0 flex-col overflow-hidden">
                            {comparisonNotice && (
                                <div
                                    className={cn(
                                        "mb-3 flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs",
                                        comparisonNotice.type === "success"
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                            : "border-red-200 bg-red-50 text-red-600"
                                    )}
                                >
                                    {comparisonNotice.type === "success" ? (
                                        <CheckCircle2 className="h-3.5 w-3.5"/>
                                    ) : (
                                        <AlertCircle className="h-3.5 w-3.5"/>
                                    )}
                                    <span className="leading-snug">
                                        {comparisonNotice.message}
                                    </span>
                                </div>
                            )}
                            <div
                                className="py-2 flex-1 min-h-0 max-h-[65vh] overflow-y-auto overflow-x-hidden rounded-xl bg-white px-2.5"
                                style={{maxHeight: '80vh'}}
                            >
                                <ChatMessageDisplay
                                    messages={messages}
                                    error={error}
                                    setInput={setInput}
                                    setFiles={handleFileChange}
                                    activeBranchId={activeBranchId}
                                    onDisplayDiagram={async (xml, { isFinal, mode, toolCallId } = {}) => {
                                        const targetMode: DiagramRenderingMode = mode ?? (isSvgMode ? "svg" : "drawio");

                                        if (targetMode === "svg") {
                                            const fixed = repairSvg(xml);

                                            // 如果是流式更新，使用轻量级的预览层
                                            if (isFinal === false) {
                                                queueStreamingSvgPreview(fixed);
                                                return;
                                            }

                                            // 只有在最终完成时，才清除预览层并加载到编辑器状态
                                            latestStreamingSvgRef.current = null;
                                            if (streamingSvgFrameRef.current !== null) {
                                                cancelAnimationFrame(streamingSvgFrameRef.current);
                                                streamingSvgFrameRef.current = null;
                                            }
                                            if (idleCallbackIdRef.current !== null && typeof window.cancelIdleCallback === "function") {
                                                window.cancelIdleCallback(idleCallbackIdRef.current);
                                                idleCallbackIdRef.current = null;
                                            }
                                            lastPreviewLengthRef.current = 0;
                                            lastPreviewAtRef.current = 0;
                                            setStreamingSvgContent(null);
                                            loadSvgMarkup(fixed, {
                                                skipSnapshot: true,
                                                saveHistory: false,
                                                skipOptimization: true
                                            });
                                            updateActiveBranchDiagram(fixed);
                                            const resultId = toolCallId || `svg-${Date.now()}`;
                                            diagramResultsRef.current.set(resultId, {
                                                xml: fixed,
                                                svg: fixed,
                                                mode: "svg",
                                                runtime: selectedModel ?? undefined,
                                            });
                                            setDiagramResultVersion((prev) => prev + 1);
                                            return;
                                        }

                                        // draw.io 流式预览：合法化 + 局部替换 + 去重，减少 reload 闪屏
                                        try {
                                            if (isFinal === false) {
                                                let merged: string | null = null;
                                                try {
                                                    const safeRoot = convertToLegalXml(xml);
                                                    const baseXml = getLatestDiagramXml() || EMPTY_MXFILE;
                                                    merged = replaceNodes(baseXml, safeRoot);
                                                } catch (err) {
                                                    console.warn("Draw.io streaming normalize failed:", err);
                                                    merged = null;
                                                }
                                                if (!merged || merged === lastDrawioAppliedRef.current) return;
                                                lastDrawioAppliedRef.current = merged;
                                                loadDiagramImmediate(merged);
                                                return;
                                            }
                                            // 最终态：再合法化一次并去重，确保画布落到最终结果
                                            try {
                                                const safeRoot = convertToLegalXml(xml);
                                                const baseXml = getLatestDiagramXml() || EMPTY_MXFILE;
                                                const merged = replaceNodes(baseXml, safeRoot);
                                                if (merged && merged !== lastDrawioAppliedRef.current) {
                                                    lastDrawioAppliedRef.current = merged;
                                                    loadDiagramImmediate(merged);
                                                }
                                            } catch (err) {
                                                console.warn("Draw.io final normalize failed:", err);
                                            }
                                            await handleDiagramXml(xml, {
                                                origin: "display",
                                                modelRuntime: selectedModel ?? undefined,
                                            });
                                        } catch (e) {
                                            console.warn("Draw.io streaming apply failed:", e);
                                        }
                                    }}
                                    onComparisonApply={(result) => {
                                        void handleApplyComparisonResult(result);
                                    }}
                                    onComparisonCopyXml={handleCopyXml}
                                    onComparisonDownload={handleDownloadXml}
                                    onComparisonPreview={(requestId, result) => {
                                        void handlePreviewComparisonResult(requestId, result);
                                    }}
                                    onComparisonRetry={handleRetryComparisonResult}
                                    buildComparisonPreviewUrl={buildComparisonPreviewUrl}
                                    comparisonHistory={comparisonHistory}
                                    activePreview={activeComparisonPreview}
                                    onMessageRevert={handleMessageRevert}
                                    runtimeDiagramError={runtimeError?.message ?? null}
                                    onConsumeRuntimeError={() => setRuntimeError(null)}
                                    onStopAll={() =>
                                        void handleStopAll({
                                            type: "error",
                                            message: "已手动暂停当前生成任务。",
                                        })
                                    }
                                    onRetryGeneration={handleRetryGeneration}
                                    isGenerationBusy={isGenerationBusy}
                                    isComparisonRunning={isComparisonRunning}
                                    diagramResultVersion={diagramResultVersion}
                                    getDiagramResult={getDiagramResult}
                                />
                            </div>
                            <ToolPanelSidebar
                                activePanel={activeToolPanel}
                                isOpen={shouldShowSidebar}
                                onClose={closeToolSidebar}
                            >
                                {renderToolPanel()}
                            </ToolPanelSidebar>
                        </div>
                    </div>
                </CardContent>

                <div className="absolute bottom-3 left-0 right-0 z-10 w-full px-3">
                    <div className="flex w-full flex-col items-center gap-2">
                        <div
                            className="flex items-center justify-center gap-2">
                            <RenderModeToggle
                                value={renderMode}
                                onChange={handleRenderModeChange}
                                disabled={status === "streaming"}
                            />
                        </div>

                        <div className="w-full rounded-2xl shadow-xl">
                            <ChatInputOptimized
                                input={input}
                                status={status}
                                onSubmit={onFormSubmit}
                                onChange={handleInputChange}
                                onClearChat={handleClearChat}
                                files={files}
                                onFileChange={handleFileChange}
                                showHistory={showHistory}
                                onToggleHistory={setShowHistory}
                                isCompactMode={isCompactMode && isConversationStarted}
                                selectedModelKey={selectedModelKey}
                                modelOptions={modelOptions}
                                onModelChange={selectModel}
                                onManageModels={() => setIsModelConfigOpen(true)}
                                onModelStreamingChange={handleModelStreamingChange}
                                comparisonEnabled={isComparisonAllowed}
                                onCompareRequest={async () => {
                                    if (!input.trim()) {
                                        return;
                                    }

                                    // 先添加用户消息
                                    const enrichedInput =
                                        briefContext.prompt.length > 0
                                            ? `${briefContext.prompt}\n\n${input}`
                                            : input;

                                    const parts: Array<
                                        | { type: "text"; text: string; displayText?: string }
                                        | { type: "file"; url: string; mediaType: string }
                                    > = [{type: "text", text: enrichedInput, displayText: input}];

                                    if (files.length > 0) {
                                        const attachments = await serializeAttachments(files);
                                        attachments.forEach(({url, mediaType}) => {
                                            parts.push({
                                                type: "file",
                                                url,
                                                mediaType,
                                            });
                                        });
                                    }

                                    // 生成用户消息 ID
                                    const userMessageId = `user-compare-${Date.now()}`;

                                    // 手动添加用户消息到 messages（这样消息会显示在对话中）
                                    setMessages((prev) => [
                                        ...prev,
                                        {
                                            id: userMessageId,
                                            role: "user",
                                            parts,
                                        } as any,
                                    ]);

                                    // 然后发起对比请求，传入用户消息 ID 作为 anchor
                                    void handleCompareRequest(userMessageId);
                                    setInput("");
                                    setFiles([]);
                                }}
                                onOpenComparisonConfig={() => {
                                    setIsComparisonConfigOpen(true);
                                }}
                                isCompareLoading={isComparisonRunning}
                                interactionLocked={requiresBranchDecision || !selectedModel}
                                renderMode={renderMode}
                                onRenderModeChange={handleRenderModeChange}
                                historyItems={historyItems}
                                onRestoreHistory={handleRestoreHistory}
                                onStop={() =>
                                    handleStopAll({
                                        type: "success",
                                        message: "已手动暂停当前生成任务。",
                                    })
                                }
                                isBusy={isGenerationBusy}
                                onShowDiagramGallery={handleShowDiagramGallery}
                                onConvertSvg={handleOpenSvgConvert}
                            />
                        </div>
                    </div>
                </div>

            </Card>
            <DiagramGalleryDialog
                open={isDiagramGalleryOpen}
                onOpenChange={setIsDiagramGalleryOpen}
                diagramResults={diagramResultsRef.current}
                version={diagramResultVersion}
            />
            <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                <DialogContent className="!max-w-[95vw] w-[95vw] h-[90vh] p-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-4 pb-2">
                        <DialogTitle>全屏模板库</DialogTitle>
                        <DialogDescription>
                            大屏浏览全部模板，包含筛选、预览与快捷应用。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="h-[calc(90vh-96px)]">
                        <TemplateGallery
                            onSelectTemplate={(template) => {
                                if (status === "streaming") return;
                                if (!ensureBranchSelectionSettled()) return;
                                setBriefState(template.brief);
                                setInput(template.prompt);
                                if (files.length > 0) {
                                    handleFileChange([]);
                                }
                                setIsTemplateDialogOpen(false);
                                closeToolSidebar();
                            }}
                        />
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>交流联系</DialogTitle>
                        <DialogDescription>
                            如果你在使用 FlowPilot 或图表创作时遇到问题、希望一起探讨方案，
                            欢迎通过微信联系我。
                        </DialogDescription>
                    </DialogHeader>
                    <div
                        className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-slate-50 p-4 shadow-inner">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-violet-500">
                            微信号
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                            <span className="text-lg font-semibold tracking-wide text-slate-900">
                                leland1999
                            </span>
                            <button
                                type="button"
                                onClick={handleCopyWechat}
                                className={cn(
                                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-medium transition",
                                    contactCopyState === "copied"
                                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                        : "border-violet-200 bg-white text-violet-600 hover:border-violet-300"
                                )}
                            >
                                {contactCopyState === "copied" ? (
                                    <>
                                        <CheckCircle2 className="h-3.5 w-3.5"/>
                                        已复制
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-3.5 w-3.5"/>
                                        复制
                                    </>
                                )}
                            </button>
                        </div>
                        <p className="mt-3 text-xs text-slate-500">
                            简单备注一下问题背景或想聊的主题，我会在方便时尽快回复。
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
            <FlowPilotBriefDialog
                open={isBriefDialogOpen}
                onOpenChange={setIsBriefDialogOpen}
                state={briefState}
                onChange={(next) =>
                    setBriefState((prev) => ({
                        ...prev,
                        ...next,
                    }))
                }
                disabled={status === "streaming"}
            />
            <ModelComparisonConfigDialog
                open={isComparisonConfigOpen}
                onOpenChange={setIsComparisonConfigOpen}
                config={comparisonConfig}
                onConfigChange={setComparisonConfig}
                defaultPrimaryKey={selectedModelKey}
                models={modelOptions}
                onManageModels={() => setIsModelConfigOpen(true)}
            />
            <ModelConfigDialog
                open={isModelConfigOpen}
                onOpenChange={setIsModelConfigOpen}
                endpoints={modelEndpoints}
                onSave={saveEndpoints}
            />
            <ConversationHistoryDialog
                open={isConversationHistoryOpen}
                onOpenChange={setIsConversationHistoryOpen}
                conversations={conversations}
                isLoading={isConversationHistoryLoading}
                onDeleteConversation={deleteConversation}
                onClearAll={clearAllConversations}
                onStartNew={handleStartNewConversation}
                onLoadConversation={handleLoadConversation}
            />
            <SmartSvgConverterDialog
                open={isSmartSvgConverterOpen}
                onOpenChange={setIsSmartSvgConverterOpen}
                onConvert={handleSmartSvgConvert}
                models={modelOptions}
                selectedModelKey={selectedModelKey}
                onModelChange={selectModel}
                initialSvg={prefillSvgForConvert}
            />
        </>
    );
}
