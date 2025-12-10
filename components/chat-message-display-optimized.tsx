"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { svgToDataUrl } from "@/lib/svg";
import ExamplePanel from "./chat-example-panel";
import { UIMessage } from "ai";
import {
    ComparisonCardResult,
    ComparisonHistoryEntry,
} from "@/types/comparison";
import { TokenUsageDisplay } from "./token-usage-display";
import type { DiagramResultEntry } from "@/features/chat-panel/types";
import { MessageItem } from "./message-item";

const LARGE_TOOL_INPUT_CHAR_THRESHOLD = 3000;
const CHAR_COUNT_FORMATTER = new Intl.NumberFormat("zh-CN");
// 智能图表生成超时检测时间（毫秒）- 5分钟
const DIAGRAM_GENERATION_TIMEOUT_MS = 300000;

function stripThink(text: string): string {
    if (!text) return "";
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
    cleaned = cleaned.replace(/<\/?think>/gi, "");
    return cleaned.trim();
}

interface ChatMessageDisplayProps {
    messages: UIMessage[];
    error?: Error | null;
    setInput: (input: string) => void;
    setFiles: (files: File[]) => void;
    onDisplayDiagram?: (
        xml: string,
        meta: { toolCallId?: string; isFinal?: boolean; mode?: "drawio" | "svg" | "excalidraw" }
    ) => void | Promise<void>;
    onStreamingText?: (payload: {
        raw: string;
        clean: string;
        svg?: string | null;
        messageId?: string;
        isFinal: boolean;
    }) => void;
    onStreamingApply?: (content: string, callId: string, mode: "drawio" | "svg" | "excalidraw") => void;
    onComparisonApply?: (result: ComparisonCardResult) => void;
    onComparisonCopyXml?: (xml: string) => void;
    onComparisonDownload?: (result: ComparisonCardResult) => void;
    onComparisonPreview?: (requestId: string, result: ComparisonCardResult) => void;
    buildComparisonPreviewUrl?: (xml: string) => string | null;
    onComparisonRetry?: (
        entry: ComparisonHistoryEntry,
        result: ComparisonCardResult
    ) => void;
    comparisonHistory?: ComparisonHistoryEntry[];
    activePreview?: { requestId: string; resultId: string } | null;
    onMessageRevert?: (payload: { messageId: string; text: string }) => void;
    activeBranchId?: string;
    runtimeDiagramError?: string | null;
    onConsumeRuntimeError?: () => void;
    onStopAll?: () => void;
    onRetryGeneration?: () => void;
    isGenerationBusy?: boolean;
    isComparisonRunning?: boolean;
    diagramResultVersion?: number;
    getDiagramResult?: (
        toolCallId: string
    ) => DiagramResultEntry | undefined;
}

// 优化：使用 memo 避免不必要的重渲染
const DiagramToolCard = memo(({
    part,
    onCopy,
    onStopAll,
    isGenerationBusy,
    isComparisonRunning,
    diagramResult,
    onStreamingApply,
    onRetry,
    messageMetadata,
}: {
    part: any;
    onCopy: (xml: string, callId: string) => Promise<void>;
    onStopAll?: () => void;
    isGenerationBusy?: boolean;
    isComparisonRunning?: boolean;
    diagramResult?: DiagramResultEntry;
    onStreamingApply?: (content: string, callId: string, mode: "drawio" | "svg" | "excalidraw") => void;
    onRetry?: () => void;
    messageMetadata?: {
        usage?: {
            inputTokens?: number;
            outputTokens?: number;
            totalTokens?: number;
        };
        durationMs?: number;
    };
}) => {
    const callId = part.toolCallId;
    const { state, input, output } = part;
    const toolName = (part.type?.replace("tool-", "") as string) || "display_diagram";
    const [copiedKind, setCopiedKind] = useState<"xml" | "svg" | null>(null);
    const [toolCallError, setToolCallError] = useState<string | null>(null);
    const previousContentRef = useRef<string>("");
    const [localState, setLocalState] = useState<string>(state || "pending");
    const [autoCompletedByStreamEnd, setAutoCompletedByStreamEnd] = useState(false);
    const [showTimeoutHint, setShowTimeoutHint] = useState(false);
    const streamingStartTimeRef = useRef<number | null>(null);

    const diagramMode: "drawio" | "svg" | "excalidraw" = diagramResult?.mode ?? (toolName === "display_svg" ? "svg" : "drawio");
    const displaySvg = diagramResult?.svg || (typeof input?.svg === "string" ? input.svg : null);
    const displayDiagramXml = diagramResult?.xml ||
        (typeof input?.xml === "string" ? input.xml : null);
    const displayContent = useMemo(() => {
        // 优先使用当前模式对应的内容，其次尝试另一种格式兜底
        if (diagramMode === "svg") {
            return displaySvg || displayDiagramXml;
        }
        return displayDiagramXml || displaySvg;
    }, [diagramMode, displayDiagramXml, displaySvg]);
    const hasDisplayContent = useMemo(
        () => typeof displayContent === "string" && displayContent.trim().length > 0,
        [displayContent]
    );
    // 同步外部状态
    useEffect(() => {
        if (state) {
            setLocalState(state);
            // 重置超时提示
            if (state !== "input-streaming") {
                setShowTimeoutHint(false);
                streamingStartTimeRef.current = null;
            }
        }
    }, [state]);

    // 记录 streaming 开始时间
    useEffect(() => {
        if (localState === "input-streaming" && streamingStartTimeRef.current === null) {
            streamingStartTimeRef.current = Date.now();
        }
    }, [localState]);

    // 超时检测机制（5分钟）
    useEffect(() => {
        if (localState !== "input-streaming" || !streamingStartTimeRef.current) {
            return;
        }

        const timer = setTimeout(() => {
            const elapsed = Date.now() - (streamingStartTimeRef.current || 0);
            if (elapsed >= DIAGRAM_GENERATION_TIMEOUT_MS && localState === "input-streaming") {
                // 5分钟后仍在 streaming 状态，显示超时提示
                setShowTimeoutHint(true);
            }
        }, DIAGRAM_GENERATION_TIMEOUT_MS);

        return () => clearTimeout(timer);
    }, [localState]);

    // 流结束自动完成机制：
    // 当整体流式响应结束（isGenerationBusy 从 true 变为 false）且工具调用仍处于 input-streaming 状态时，
    // 自动将状态更新为 output-available，避免因 token 限制导致的状态卡死
    useEffect(() => {
        if (
            !isGenerationBusy &&
            !isComparisonRunning &&
            localState === "input-streaming" &&
            hasDisplayContent
        ) {
            // 流已结束，但工具调用状态仍为 streaming，自动标记为完成
            setLocalState("output-available");
            setAutoCompletedByStreamEnd(true);
            // 确保最后一次更新被应用
            if (onStreamingApply) {
                onStreamingApply(displayContent!, callId, diagramMode);
            }
        }
    }, [isGenerationBusy, isComparisonRunning, localState, hasDisplayContent, displayContent, onStreamingApply, callId, diagramMode]);

    // 流式渲染：在streaming状态下实时应用图表
    const lastStreamingUpdateRef = useRef<number>(0);
    useEffect(() => {
        if (
            localState === "input-streaming" &&
            hasDisplayContent &&
            displayContent !== previousContentRef.current &&
            onStreamingApply
        ) {
            const now = Date.now();
            // Increase throttle to 800ms to prevent browser freeze during heavy rendering
            if (now - lastStreamingUpdateRef.current > 800) {
                previousContentRef.current = displayContent!;
                lastStreamingUpdateRef.current = now;
                onStreamingApply(displayContent!, callId, diagramMode);
            }
        }
    }, [diagramMode, localState, hasDisplayContent, displayContent, callId, onStreamingApply]);

    const handleCopyClick = useCallback(async () => {
        if (!displayDiagramXml) return;
        await onCopy(displayDiagramXml, callId);
        setCopiedKind("xml");
        setTimeout(() => setCopiedKind(null), 2000);
    }, [displayDiagramXml, callId, onCopy]);

    const handleCopySvgClick = useCallback(async () => {
        if (!displaySvg) return;
        await onCopy(displaySvg, callId);
        setCopiedKind("svg");
        setTimeout(() => setCopiedKind(null), 2000);
    }, [displaySvg, callId, onCopy]);

    const handleStopClick = useCallback(() => {
        if (onStopAll) {
            setLocalState("stopped");
            onStopAll();
        }
    }, [onStopAll]);

    const handleRetryClick = useCallback(() => {
        if (onRetry) {
            setLocalState("pending");
            setToolCallError(null);
            setAutoCompletedByStreamEnd(false);
            setShowTimeoutHint(false);
            streamingStartTimeRef.current = null;
            onRetry();
        }
    }, [onRetry]);

    const handleManualComplete = useCallback(() => {
        if (hasDisplayContent) {
            setLocalState("output-available");
            setAutoCompletedByStreamEnd(true);
            setShowTimeoutHint(false);
        }
    }, [hasDisplayContent]);

    const currentState = localState || state;

    const statusLabel = currentState === "output-available"
        ? "已完成"
        : currentState === "output-error"
            ? "生成失败"
            : currentState === "input-streaming"
                ? "生成中"
                : currentState === "stopped"
                    ? "已暂停"
                    : currentState || "等待中";

    const statusClass = cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
        currentState === "output-available" &&
        "border-emerald-200 bg-emerald-50 text-emerald-700",
        (currentState === "output-error" || toolCallError) &&
        "border-red-200 bg-red-50 text-red-700",
        currentState === "input-streaming" &&
        "border-blue-200 bg-blue-50 text-blue-700",
        currentState === "stopped" &&
        "border-amber-200 bg-amber-50 text-amber-700",
        currentState !== "output-available" &&
        currentState !== "output-error" &&
        currentState !== "input-streaming" &&
        currentState !== "stopped" &&
        "border-slate-200 bg-slate-50 text-slate-500"
    );

    const statusMessage = (() => {
        if (toolCallError) return toolCallError;
        if (currentState === "output-error") {
            return output || "图表生成失败，请修改提示词或重新上传素材后重试。";
        }
        if (currentState === "stopped") {
            return "图表生成已暂停，可以点击「重新生成」继续。";
        }
        if (currentState === "output-available") {
            if (autoCompletedByStreamEnd) {
                return "流式输出已结束，图表已自动应用到画布。";
            }
            return "图表生成完成，已实时渲染到画布。";
        }
        if (currentState === "input-streaming") {
            return "AI 正在生成图表，画布实时更新中…";
        }
        return "等待模型输出图表内容…";
    })();

    return (
        <div
            className="my-2 w-full max-w-[min(520px,80%)] rounded-lg bg-white/80 border border-slate-200/60 px-4 py-3 text-xs text-slate-600"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {toolName === "display_diagram" || toolName === "display_svg" ? "图表生成完成" : "工具执行完成"}
                    </div>
                </div>
                <span className={statusClass}>{statusLabel}</span>
            </div>
            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-[13px] leading-relaxed text-slate-700">
                {statusMessage}
            </div>
            {diagramMode === "svg" && currentState === "output-available" && displaySvg && (
                <div className="mt-2">
                    <details className="group">
                        <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-700">
                            <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            查看 SVG 预览
                        </summary>
                        <div className="mt-2 rounded-lg border border-slate-100 bg-white/90 p-2">
                            <div className="relative h-48 w-full overflow-auto rounded-lg bg-slate-50 flex items-center justify-center">
                                <div
                                    className="max-h-full max-w-full"
                                    dangerouslySetInnerHTML={{ __html: displaySvg }}
                                />
                            </div>
                        </div>
                    </details>
                </div>
            )}
            {/* 超时提示 */}
            {showTimeoutHint && currentState === "input-streaming" && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <div className="flex items-start gap-2">
                        <svg className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                            <div className="font-medium">长时间无响应</div>
                            <div className="mt-0.5 text-amber-700">
                                流式输出可能已结束，但状态未更新。如果画布已显示图表，可以点击下方按钮应用当前结果。
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
                {currentState === "input-streaming" && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                        <span>实时渲染中</span>
                    </div>
                )}
                {(currentState === "stopped" || currentState === "output-error") && onRetry && (
                    <button
                        type="button"
                        onClick={handleRetryClick}
                        className="inline-flex items-center rounded-full border border-slate-900 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white"
                    >
                        重新生成
                    </button>
                )}
                {displayDiagramXml && diagramMode === "drawio" && (
                    <button
                        type="button"
                        onClick={handleCopyClick}
                        className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                    >
                        {copiedKind === "xml" ? "已复制 XML" : "复制 XML"}
                    </button>
                )}
                {displaySvg && (
                    <button
                        type="button"
                        onClick={handleCopySvgClick}
                        className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                    >
                        {copiedKind === "svg" ? "已复制 SVG" : "复制 SVG"}
                    </button>
                )}
                {currentState === "input-streaming" && onStopAll && (
                    <button
                        type="button"
                        onClick={handleStopClick}
                        className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:border-red-300 hover:bg-red-100"
                    >
                        暂停生成
                    </button>
                )}
                {/* 超时手动完成按钮 */}
                {showTimeoutHint && currentState === "input-streaming" && hasDisplayContent && (
                    <button
                        type="button"
                        onClick={handleManualComplete}
                        className="inline-flex items-center rounded-full border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                    >
                        应用当前图表
                    </button>
                )}
            </div>
            {/* Token 使用信息显示 - 仅在完成时显示 (已隐藏以节省空间) */}
            {/* {currentState === "output-available" && messageMetadata && (
                <div className="mt-3">
                    <TokenUsageDisplay
                        usage={messageMetadata.usage}
                        durationMs={messageMetadata.durationMs}
                        compact
                    />
                </div>
            )} */}
        </div>
    );
});
DiagramToolCard.displayName = "DiagramToolCard";

export function ChatMessageDisplay({
    messages,
    error,
    setInput,
    setFiles,
    onDisplayDiagram,
    onStreamingText,
    onStreamingApply,
    onComparisonApply,
    onComparisonCopyXml,
    onComparisonDownload,
    onComparisonPreview,
    buildComparisonPreviewUrl,
    onComparisonRetry,
    comparisonHistory = [],
    activePreview = null,
    onMessageRevert,
    activeBranchId,
    runtimeDiagramError,
    onConsumeRuntimeError,
    onStopAll: onStopAllProp, // Renamed to avoid potential conflict
    onRetryGeneration,
    isGenerationBusy = false,
    isComparisonRunning = false,
    diagramResultVersion = 0,
    getDiagramResult,
}: ChatMessageDisplayProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLElement | null>(null);
    const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
    const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [generationElapsedTime, setGenerationElapsedTime] = useState(0);
    const generationStartTimeRef = useRef<number | null>(null);
    const appliedTextSvgMessageIdsRef = useRef<Set<string>>(new Set());
    const textSvgCacheRef = useRef<Map<string, string>>(new Map());
    const appliedTextDrawioMessageIdsRef = useRef<Set<string>>(new Set());
    const textDrawioCacheRef = useRef<Map<string, string>>(new Map());
    const appliedTextExcalidrawMessageIdsRef = useRef<Set<string>>(new Set());
    const textExcalidrawCacheRef = useRef<Map<string, string>>(new Map());
    const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

    // 流式渲染回调
    const handleStreamingApply = useCallback((content: string, toolCallId: string, mode: "drawio" | "svg" | "excalidraw" = "drawio") => {
        if (!content || typeof onDisplayDiagram !== "function") {
            return;
        }

        // 在流式传输期间，绝对不要调用 expensive 的 convertToLegalXml
        // 该函数的正则在处理未闭合标签时会导致严重的性能回溯，造成浏览器卡死
        // Draw.io 引擎本身对不完整的 XML 有一定的容错能力；SVG 预览也需要最大限度原样透传
        const finalContent = content;

        // 在streaming状态下直接应用，不使用async/await避免阻塞
        const result = onDisplayDiagram(finalContent, { toolCallId, isFinal: false, mode });
        if (result && typeof result.catch === 'function') {
            result.catch((error) => {
                console.error("流式渲染失败:", error);
            });
        }
        // 调用外部传入的流式应用回调（用于 Excalidraw 等）
        if (onStreamingApply) {
            onStreamingApply(finalContent, toolCallId, mode);
        }
    }, [onDisplayDiagram, onStreamingApply]);

    // 识别滚动容器，并在用户上滑时暂停自动滚动
    useEffect(() => {
        if (!messagesEndRef.current) return;
        let parent = messagesEndRef.current.parentElement;
        let scrollable: HTMLElement | null = null;
        while (parent) {
            const style = window.getComputedStyle(parent);
            if (style.overflowY === "auto" || style.overflowY === "scroll") {
                scrollable = parent as HTMLElement;
                break;
            }
            parent = parent.parentElement;
        }
        if (!scrollable) return;
        scrollContainerRef.current = scrollable;

        const handleScroll = () => {
            const { scrollTop, clientHeight, scrollHeight } = scrollable;
            const atBottom = scrollTop + clientHeight >= scrollHeight - 120;
            setAutoScrollEnabled(atBottom);
        };

        handleScroll(); // 初始化一次
        scrollable.addEventListener("scroll", handleScroll, { passive: true });
        return () => scrollable.removeEventListener("scroll", handleScroll);
    }, []);

    // 监听生成状态，更新耗时计时器
    useEffect(() => {
        if (isGenerationBusy) {
            // 开始生成
            if (generationStartTimeRef.current === null) {
                generationStartTimeRef.current = Date.now();
                setGenerationElapsedTime(0);
            }

            // 每秒更新一次耗时
            const timer = setInterval(() => {
                if (generationStartTimeRef.current !== null) {
                    const elapsed = Date.now() - generationStartTimeRef.current;
                    setGenerationElapsedTime(elapsed);
                }
            }, 100); // 100ms 更新一次，更流畅

            return () => clearInterval(timer);
        } else {
            // 生成结束，重置计时器
            generationStartTimeRef.current = null;
            setGenerationElapsedTime(0);
        }
    }, [isGenerationBusy]);

    // 优化：使用 useMemo 缓存计算结果
    const diagramResults = useMemo(() => {
        const results = new Map<string, DiagramResultEntry>();
        messages.forEach((message) => {
            if (!message.parts) return;
            message.parts.forEach((part: any) => {
                if (typeof part.type !== "string") return;
                const toolName = part.type.replace("tool-", "");
                if (toolName !== "display_diagram" && toolName !== "display_svg") return;
                const toolCallId = part.toolCallId;
                if (!toolCallId) return;
                const result = getDiagramResult?.(toolCallId);
                if (result) {
                    results.set(toolCallId, result);
                }
            });
        });
        return results;
    }, [messages, getDiagramResult, diagramResultVersion]);

    // 是否已有工具卡片负责展示生成状态（用于隐藏额外的“正在绘制中…”提示）
    const hasLiveToolCard = useMemo(() => {
        return messages.some((message) =>
            message.parts?.some((part: any) => {
                if (typeof part?.type !== "string") return false;
                if (!part.type.startsWith("tool-")) return false;
                const state = part.state;
                return state === "input-streaming" || state === "pending" || state === "required";
            })
        );
    }, [messages]);

    // 优化：简化复制函数
    const handleCopyDiagramXml = useCallback(async (xml: string, toolCallId: string) => {
        if (!xml || typeof navigator === "undefined") return;
        try {
            await navigator.clipboard.writeText(xml);
        } catch (error) {
            console.error("复制 XML 失败：", error);
        }
    }, []);

    useEffect(() => {
        if (!autoScrollEnabled || !messagesEndRef.current) return;

        // Manually find the scrollable container to avoid window scrolling
        let parent: HTMLElement | null = scrollContainerRef.current;

        if (!parent) {
            parent = messagesEndRef.current.parentElement as HTMLElement | null;
            while (parent) {
                const style = window.getComputedStyle(parent);
                if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                    break;
                }
                parent = parent.parentElement as HTMLElement | null;
            }
        }

        if (parent) {
            parent.scrollTo({
                top: parent.scrollHeight,
                behavior: 'smooth'
            });
            return;
        }

        // Fallback
        messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [messages, autoScrollEnabled]);

    // 当后端禁用工具（如 linkflow），但模型直接在文本中输出 SVG / Draw.io XML 时，尝试自动抓取并应用
    useEffect(() => {
        if (typeof onDisplayDiagram !== "function") return;
        // 找到最新的 assistant 消息
        const reversed = [...messages].reverse();
        for (const msg of reversed) {
            if (msg.role !== "assistant" || !msg.id) continue;
            const hasToolPart = msg.parts?.some((part: any) => typeof part?.type === "string" && part.type.startsWith("tool-"));
            if (hasToolPart) continue;
            const textParts = (msg.parts || []).filter((part: any) => part?.type === "text");
            const rawOriginal = textParts.map((p: any) => (p.text ?? p.displayText ?? "")).join("\n");
            const raw = stripThink(rawOriginal);
            if (!rawOriginal || typeof rawOriginal !== "string") continue;

            // 先尝试解析 Draw.io（mxGraph）内容
            const extractDrawioPayload = (text: string) => {
                // 围栏块（```drawio/```xml）
                const fenced = text.match(/```(?:drawio|xml)?[\t ]*\n?([\s\S]*?)```/i);
                if (fenced?.[1]) {
                    return fenced[1];
                }
                const fencedStart = text.match(/```(?:drawio|xml)?[\t ]*\n?/i);
                if (fencedStart) {
                    const startIdx = (fencedStart.index ?? 0) + fencedStart[0].length;
                    const rest = text.slice(startIdx);
                    const earlyCloseIdx = rest.indexOf("```");
                    return earlyCloseIdx >= 0 ? rest.slice(0, earlyCloseIdx) : rest;
                }

                // 内联块
                const inline =
                    text.match(/<mxfile[\s\S]*?(<\/mxfile>|$)/i)?.[0] ||
                    text.match(/<mxGraphModel[\s\S]*?(<\/mxGraphModel>|$)/i)?.[0] ||
                    text.match(/<root[\s\S]*?(<\/root>|$)/i)?.[0];
                return inline || null;
            };

            const normalizeDrawioRoot = (payload: string | null): string | null => {
                if (!payload) return null;
                const trimmed = payload.trim();
                if (!trimmed) return null;

                // 优先提取 <root> ... </root>
                const rootMatch = trimmed.match(/<root[\s\S]*?(<\/root>|$)/i);
                if (rootMatch?.[0]) {
                    let root = rootMatch[0];
                    if (!/<\/root>/i.test(root)) {
                        root += "</root>";
                    }
                    return root;
                }

                // 回退：提取所有 mxCell，构造最小可用 root
                const cellMatches = trimmed.match(/<mxCell\b[\s\S]*?(?:\/>|<\/mxCell>)/gi);
                if (cellMatches && cellMatches.length > 0) {
                    return `<root>${cellMatches.join("\n")}</root>`;
                }
                return null;
            };

            const buildSafeDrawioXml = (content: string | null): string | null => {
                if (!content) return null;
                const trimmed = content.trim();
                if (!trimmed) return null;

                // 提取 root 内部
                let inner = trimmed;
                const rootMatch = trimmed.match(/<root[\s\S]*?<\/root>/i);
                if (rootMatch?.[0]) {
                    inner = rootMatch[0]
                        .replace(/^<root[^>]*>/i, "")
                        .replace(/<\/root>/i, "");
                }

                // 直接返回 <root>…</root> 补丁，由合并器补基础节点
                return `<root>${inner}</root>`;
            };

            const drawioPayloadRaw = extractDrawioPayload(raw);
            const drawioRoot = normalizeDrawioRoot(drawioPayloadRaw);

            if (drawioRoot) {
                const cachedDrawio = textDrawioCacheRef.current.get(msg.id);
                const alreadyFinalDrawio = appliedTextDrawioMessageIdsRef.current.has(msg.id);
                const isStreaming = isGenerationBusy;
                const needsApply =
                    drawioRoot !== cachedDrawio || (!isStreaming && !alreadyFinalDrawio);

                if (needsApply) {
                    const safeXml = buildSafeDrawioXml(drawioRoot);
                    if (!safeXml) continue;
                    textDrawioCacheRef.current.set(msg.id, safeXml);
                    const isFinal = !isStreaming;
                    if (isFinal) {
                        appliedTextDrawioMessageIdsRef.current.add(msg.id);
                    }
                    onDisplayDiagram(safeXml, { isFinal: !isStreaming, mode: "drawio", toolCallId: msg.id });
                    break;
                }
                if (!isStreaming && !alreadyFinalDrawio && cachedDrawio) {
                    appliedTextDrawioMessageIdsRef.current.add(msg.id);
                }
            }

            // Excalidraw JSON Extraction
            const extractExcalidrawPayload = (text: string) => {
                // Markdown code block with json tag
                const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
                if (fenced?.[1]) {
                     const content = fenced[1].trim();
                     if (content.startsWith("{") && (content.includes('"type": "excalidraw"') || content.includes('"elements":'))) {
                         return content;
                     }
                }
                
                // Open code block
                const fencedStart = text.match(/```(?:json)?\s*\n?/i);
                if (fencedStart) {
                    const startIdx = (fencedStart.index ?? 0) + fencedStart[0].length;
                    const rest = text.slice(startIdx).trim();
                    if (rest.startsWith("{")) {
                        // Check if it looks like Excalidraw JSON start
                         if (rest.includes('"type": "excalidraw"') || rest.includes('"elements":') || rest.includes('"version":')) {
                             return rest;
                         }
                    }
                }
                return null;
            };

            const excalidrawPayload = extractExcalidrawPayload(raw);
            if (excalidrawPayload) {
                const cachedExcalidraw = textExcalidrawCacheRef.current.get(msg.id);
                const alreadyFinalExcalidraw = appliedTextExcalidrawMessageIdsRef.current.has(msg.id);
                const isStreaming = isGenerationBusy;
                const needsApply = excalidrawPayload !== cachedExcalidraw || (!isStreaming && !alreadyFinalExcalidraw);

                if (needsApply) {
                    textExcalidrawCacheRef.current.set(msg.id, excalidrawPayload);
                    const isFinal = !isStreaming;
                    if (isFinal) {
                        appliedTextExcalidrawMessageIdsRef.current.add(msg.id);
                    }
                    // Pass raw partial JSON to be repaired downstream
                    onDisplayDiagram(excalidrawPayload, { isFinal, mode: "excalidraw", toolCallId: msg.id });
                    
                    // Allow falling through to SVG check? No, usually mutually exclusive.
                    break; 
                }
                 if (!isStreaming && !alreadyFinalExcalidraw && cachedExcalidraw) {
                    appliedTextExcalidrawMessageIdsRef.current.add(msg.id);
                }
            }

            // 兼容流式输出：允许缺少结尾 ``` 或闭合 </svg> 的场景
            const extractSvgPayload = (text: string) => {
                // 完整的围栏代码块
                const fenced = text.match(/```svg[\t ]*\n?([\s\S]*?)```/i);
                if (fenced?.[1]) return fenced[1];

                // 仅有开头 ```svg，尚未闭合，取其后的全部内容
                const fencedStart = text.match(/```svg[\t ]*\n?/i);
                if (fencedStart) {
                    const startIdx = (fencedStart.index ?? 0) + fencedStart[0].length;
                    const rest = text.slice(startIdx);
                    const earlyCloseIdx = rest.indexOf("```");
                    return earlyCloseIdx >= 0 ? rest.slice(0, earlyCloseIdx) : rest;
                }

                // 内联 <svg>，允许未闭合的 </svg>
                const inlineMatch = text.match(/<svg[\s\S]*?(<\/svg>|$)/i);
                if (inlineMatch?.[0]) return inlineMatch[0];

                return null;
            };

            const svgPayload = extractSvgPayload(raw);
            if (!svgPayload) continue;

            const cached = textSvgCacheRef.current.get(msg.id);
            const alreadyFinalized = appliedTextSvgMessageIdsRef.current.has(msg.id);
            const isStreaming = isGenerationBusy;
            const needsApply =
                svgPayload !== cached || (!isStreaming && !alreadyFinalized);

            if (!needsApply) {
                if (!isStreaming && !alreadyFinalized && cached) {
                    appliedTextSvgMessageIdsRef.current.add(msg.id);
                }
                continue;
            }

            textSvgCacheRef.current.set(msg.id, svgPayload);
            const isFinal = !isStreaming;
            if (isFinal) {
                appliedTextSvgMessageIdsRef.current.add(msg.id);
            }
            if (onStreamingText) {
                onStreamingText({
                    raw: rawOriginal,
                    clean: raw,
                    svg: svgPayload,
                    messageId: msg.id,
                    isFinal,
                });
            }
            onDisplayDiagram(svgPayload, { isFinal, mode: "svg", toolCallId: msg.id });
            break;
        }
    }, [messages, onDisplayDiagram, isGenerationBusy, onStreamingText]);

    // 流式结束后，如果 draw.io 文本已缓存但未最终应用，补一次最终渲染
    useEffect(() => {
        if (isGenerationBusy) return;
        if (typeof onDisplayDiagram !== "function") return;
        const reversed = [...messages].reverse();
        for (const msg of reversed) {
            if (msg.role !== "assistant" || !msg.id) continue;
            
            // Check DrawIO
            const cachedDrawio = textDrawioCacheRef.current.get(msg.id);
            if (cachedDrawio) {
                const alreadyFinal = appliedTextDrawioMessageIdsRef.current.has(msg.id);
                if (!alreadyFinal) {
                    appliedTextDrawioMessageIdsRef.current.add(msg.id);
                    onDisplayDiagram(cachedDrawio, { isFinal: true, mode: "drawio", toolCallId: msg.id });
                    break;
                }
            }

            // Check Excalidraw
            const cachedExcalidraw = textExcalidrawCacheRef.current.get(msg.id);
            if (cachedExcalidraw) {
                const alreadyFinal = appliedTextExcalidrawMessageIdsRef.current.has(msg.id);
                if (!alreadyFinal) {
                    appliedTextExcalidrawMessageIdsRef.current.add(msg.id);
                    onDisplayDiagram(cachedExcalidraw, { isFinal: true, mode: "excalidraw", toolCallId: msg.id });
                    break;
                }
            }
        }
    }, [isGenerationBusy, messages, onDisplayDiagram]);

    // Handle tool invocations and default collapse behavior
    useEffect(() => {
        const forceCollapseIds = new Set<string>();
        const defaultCollapseIds = new Set<string>();

        messages.forEach((message) => {
            if (!message.parts) return;
            message.parts.forEach((part: any) => {
                if (!part.type?.startsWith("tool-")) return;
                const toolCallId = part.toolCallId;
                if (!toolCallId) return;
                const { state } = part;

                if (state === "output-available") {
                    forceCollapseIds.add(toolCallId);
                }

                if (part.type === "tool-display_diagram") {
                    const xmlInput =
                        typeof part.input?.xml === "string" ? part.input.xml : null;

                    if (
                        xmlInput &&
                        xmlInput.length >= LARGE_TOOL_INPUT_CHAR_THRESHOLD
                    ) {
                        defaultCollapseIds.add(toolCallId);
                    }
                }
            });
        });

        if (forceCollapseIds.size === 0 && defaultCollapseIds.size === 0) {
            return;
        }

        setExpandedTools((prev) => {
            let changed = false;
            const next = { ...prev };

            forceCollapseIds.forEach((id) => {
                if (next[id] !== false) {
                    next[id] = false;
                    changed = true;
                }
            });

            defaultCollapseIds.forEach((id) => {
                if (!(id in next)) {
                    next[id] = false;
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    }, [messages]);

    const renderToolPart = (part: any, messageMetadata?: any) => {
        const callId = part.toolCallId;
        const { state, input, output } = part;
        const toolName = part.type?.replace("tool-", "");
        const isDisplayDiagramTool = toolName === "display_diagram" || toolName === "display_svg";

        if (isDisplayDiagramTool) {
            const diagramResult = diagramResults.get(callId);
            return (
                <DiagramToolCard
                    key={callId}
                    part={part}
                    onCopy={handleCopyDiagramXml}
                    onStopAll={onStopAllProp}
                    isGenerationBusy={isGenerationBusy}
                    isComparisonRunning={isComparisonRunning}
                    diagramResult={diagramResult}
                    onStreamingApply={handleStreamingApply}
                    onRetry={onRetryGeneration}
                    messageMetadata={messageMetadata}
                />
            );
        }

        // 其他工具的渲染逻辑保持不变
        const storedExpansion = expandedTools[callId];
        const isExpanded = storedExpansion !== undefined ? storedExpansion : true;

        const toggleExpanded = () => {
            setExpandedTools((prev) => ({
                ...prev,
                [callId]: !isExpanded,
            }));
        };

        const renderInputContent = () => {
            if (!input || !isExpanded) return null;

            if (
                toolName === "edit_diagram" &&
                Array.isArray(input?.edits) &&
                input.edits.length > 0
            ) {
                return (
                    <div className="mt-1 flex max-h-80 flex-col gap-2 overflow-auto pr-1">
                        {input.edits.map((edit: any, index: number) => (
                            <div
                                key={`${callId}-edit-${index}`}
                                className="rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1.5"
                            >
                                <div className="text-[10px] font-semibold text-slate-600">
                                    编辑 #{index + 1}
                                </div>
                                {edit.search ? (
                                    <div className="mt-1">
                                        <div className="text-[10px] uppercase text-slate-500">
                                            Search
                                        </div>
                                        <pre className="mt-0.5 whitespace-pre-wrap break-all font-mono text-[10px] text-slate-600">
                                            {edit.search}
                                        </pre>
                                    </div>
                                ) : null}
                                {edit.replace ? (
                                    <div className="mt-1">
                                        <div className="text-[10px] uppercase text-slate-500">
                                            Replace
                                        </div>
                                        <pre className="mt-0.5 whitespace-pre-wrap break-all font-mono text-[10px] text-slate-600">
                                            {edit.replace}
                                        </pre>
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                );
            }

            const serialized =
                typeof input === "string"
                    ? input
                    : JSON.stringify(input, null, 2);
            return (
                <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-slate-500">
                    输入：{serialized}
                </pre>
            );
        };

        return (
            <div
                key={callId}
                className="my-2 w-full max-w-[min(520px,80%)] rounded-lg  bg-white/95 px-3 py-2.5 text-xs leading-relaxed text-slate-600"
            >
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <div className="text-[11px] font-medium text-slate-700">工具：{toolName}</div>
                        <div className="flex items-center gap-2">
                            {input && Object.keys(input).length > 0 && (
                                <button
                                    onClick={toggleExpanded}
                                    className="text-[11px] text-slate-500 transition hover:text-slate-700"
                                >
                                    {isExpanded ? "隐藏参数" : "显示参数"}
                                </button>
                            )}
                        </div>
                    </div>
                    {renderInputContent()}
                    <div className="mt-1.5 text-xs">
                        {state === "input-streaming" ? (
                            <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                        ) : state === "output-available" ? (
                            <div className="text-emerald-600">
                                {output || (toolName === "display_diagram"
                                    ? "图表生成完成"
                                    : toolName === "edit_diagram"
                                        ? "图表编辑完成"
                                        : "工具执行完成")}
                            </div>
                        ) : state === "output-error" ? (
                            <div className="text-red-600">
                                {output || (toolName === "display_diagram"
                                    ? "生成图表时出错"
                                    : toolName === "edit_diagram"
                                        ? "编辑图表时出错"
                                        : "工具执行出错")}
                            </div>
                        ) : null}
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                        <div className="mb-1 text-[11px] font-semibold text-slate-600">
                            执行状态：{state}
                        </div>
                        {output && (
                            <div className="text-[11px] text-slate-700 whitespace-pre-wrap break-words">
                                {typeof output === "string"
                                    ? output
                                    : JSON.stringify(output, null, 2)}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderComparisonEntry = useCallback((
        entry: ComparisonHistoryEntry,
        keyBase: string
    ) => {
        const formattedDate =
            entry.timestamp && !Number.isNaN(Date.parse(entry.timestamp))
                ? new Date(entry.timestamp).toLocaleString()
                : undefined;
        const isEntryLoading = entry.status === "loading";
        const isCancelled = entry.status === "cancelled";
        const hasSuccessfulResults = entry.results.some(result => result.status === "ok");
        const isWaitingForSelection = !isEntryLoading && !isCancelled && hasSuccessfulResults && !entry.adoptedResultId;

        const successfulResults = entry.results.filter(result => result.status === "ok" && result.branchId);
        const currentResultIndex = successfulResults.findIndex(result => result.id === entry.adoptedResultId);
        const hasMultipleOptions = successfulResults.length > 1;
        const showSwitcher = !isWaitingForSelection && hasMultipleOptions && currentResultIndex >= 0;
        const canStopComparison =
            isEntryLoading && typeof onStopAllProp === "function";

        return (
            <div key={`${keyBase}-comparison`} className="mt-2 w-full">
                <div className="w-full rounded-lg bg-white/80 border border-slate-200/60 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex flex-col gap-0.5">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                模型对比
                            </div>
                            {formattedDate && (
                                <div className="text-[10px] text-slate-400">
                                    {formattedDate}
                                </div>
                            )}
                            {isEntryLoading && (
                                <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                                    正在生成…
                                </div>
                            )}
                            {isCancelled && (
                                <div className="inline-flex items-center gap-1.5 text-[11px] text-amber-700">
                                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                                    已暂停
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {showSwitcher && (
                                <div className="flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-200 px-2 py-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const prevIndex = (currentResultIndex - 1 + successfulResults.length) % successfulResults.length;
                                            onComparisonApply?.(successfulResults[prevIndex]);
                                        }}
                                        className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-200 transition"
                                        aria-label="切换到上一个结果"
                                    >
                                        <svg className="h-3.5 w-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>
                                    <span className="text-[11px] font-medium text-slate-600 min-w-[32px] text-center">
                                        {currentResultIndex + 1}/{successfulResults.length}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const nextIndex = (currentResultIndex + 1) % successfulResults.length;
                                            onComparisonApply?.(successfulResults[nextIndex]);
                                        }}
                                        className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-200 transition"
                                        aria-label="切换到下一个结果"
                                    >
                                        <svg className="h-3.5 w-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                            {canStopComparison && (
                                <button
                                    type="button"
                                    onClick={onStopAllProp}
                                    className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                                >
                                    暂停生成
                                </button>
                            )}
                        </div>
                    </div>

                    {isWaitingForSelection && (
                        <div className="mb-3 rounded-md bg-amber-50/80 px-3 py-2 text-sm border border-amber-200/40">
                            <div className="flex items-start gap-2">
                                <svg className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <div className="flex-1">
                                    <div className="font-medium text-amber-900 text-xs">
                                        请选择一个结果继续
                                    </div>
                                    <div className="text-amber-700 text-[11px] mt-0.5">
                                        点击卡片「设为画布」，选择后可用右上角切换器在结果间切换
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 横向滚动容器 */}
                    <div className="w-full overflow-x-auto">
                        <div
                            className="flex gap-3 pb-2"
                            style={{
                                width: `${entry.results.length * 360 + (entry.results.length - 1) * 12}px`,
                                overflowX: 'auto',
                                scrollBehavior: 'smooth',
                            }}
                        >
                            {entry.results.map((result, resultIndex) => {
                                const cardKey = `${keyBase}-${result.id ?? resultIndex}`;
                                const trimmedEncodedXml = result.encodedXml?.trim();
                                const trimmedXml = result.xml?.trim();
                                const rawXmlForPreview =
                                    trimmedEncodedXml && trimmedEncodedXml.length > 0
                                        ? trimmedEncodedXml
                                        : trimmedXml && trimmedXml.length > 0
                                            ? trimmedXml
                                            : "";
                                const previewUrl =
                                    result.status === "ok" &&
                                        rawXmlForPreview &&
                                        buildComparisonPreviewUrl
                                        ? buildComparisonPreviewUrl(rawXmlForPreview)
                                        : null;
                                const previewSvg = result.previewSvg?.trim();
                                const previewImageSrc = result.previewImage?.trim()?.length
                                    ? result.previewImage
                                    : null;
                                const hasPreview =
                                    result.status === "ok" &&
                                    (Boolean(previewSvg) ||
                                        Boolean(previewImageSrc) ||
                                        Boolean(previewUrl));
                                const isActive =
                                    activePreview?.requestId === entry.requestId &&
                                    activePreview?.resultId === result.id;
                                const isActiveBranch =
                                    activeBranchId && result.branchId === activeBranchId;
                                const badgeLabel = isActiveBranch
                                    ? "使用中"
                                    : null;

                                return (
                                    <div
                                        key={cardKey}
                                        className={cn(
                                            "group relative flex flex-col rounded-lg overflow-hidden transition-all duration-200 border flex-shrink-0",
                                            result.status === "ok"
                                                ? "bg-white border-slate-200/60"
                                                : result.status === "loading"
                                                    ? "bg-slate-50 border-slate-200/40"
                                                    : result.status === "cancelled"
                                                        ? "bg-amber-50/50 border-amber-200/40"
                                                        : "bg-red-50/50 border-red-200/40",
                                            isActive && "ring-1 ring-blue-400"
                                        )}
                                        style={{ width: '260px', height: '200px' }}
                                    >
                                        {/* 预览图区域 */}
                                        <div className="relative bg-slate-50/30" style={{ height: '150px' }}>
                                            <div
                                                role={result.status === "ok" ? "button" : undefined}
                                                tabIndex={result.status === "ok" ? 0 : -1}
                                                onClick={() =>
                                                    result.status === "ok" &&
                                                    onComparisonPreview?.(entry.requestId, result)
                                                }
                                                className={cn(
                                                    "flex h-full w-full justify-center items-center overflow-hidden p-2",
                                                    result.status === "ok" && "cursor-pointer"
                                                )}
                                            >
                                                {result.status === "ok" ? (
                                                    hasPreview ? (
                                                        <>
                                                            {previewSvg ? (
                                                                <div
                                                                    className="h-full w-full flex items-center justify-center"
                                                                    dangerouslySetInnerHTML={{ __html: previewSvg }}
                                                                />
                                                            ) : previewImageSrc ? (
                                                                <div className="relative h-full w-full">
                                                                    <Image
                                                                        src={previewImageSrc}
                                                                        alt={`comparison-preview-${cardKey}`}
                                                                        fill
                                                                        className="object-contain"
                                                                        sizes="200px"
                                                                        unoptimized
                                                                    />
                                                                </div>
                                                            ) : previewUrl ? (
                                                                <iframe
                                                                    src={previewUrl}
                                                                    title={`diagram-preview-${cardKey}`}
                                                                    className="h-full w-full border-0"
                                                                    loading="lazy"
                                                                    allowFullScreen
                                                                />
                                                            ) : (
                                                                <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                                                                    暂无预览
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                                                            暂无预览
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                                                        {result.status === "loading"
                                                            ? "正在生成…"
                                                            : result.status === "cancelled"
                                                                ? "已暂停"
                                                                : "生成失败"}
                                                    </div>
                                                )}
                                            </div>

                                            {/* 左上角标签 */}
                                            <div className="absolute left-2 top-2">
                                                <span className="inline-flex items-center rounded-md bg-white/90 backdrop-blur-sm border border-slate-200/50 px-2 py-1 text-[11px] font-medium text-slate-700">
                                                    {result.slot === "A" ? "模型 A" : "模型 B"}
                                                </span>
                                            </div>

                                            {/* 右上角使用中标签 */}
                                            {badgeLabel && (
                                                <div className="absolute right-2 top-2">
                                                    <span className="inline-flex items-center rounded-md bg-blue-500 px-2 py-1 text-[11px] font-medium text-white">
                                                        ✓ {badgeLabel}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Hover 遮罩层和按钮 */}
                                            {result.status === "ok" && (
                                                <div className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-gradient-to-t from-slate-900/70 via-slate-900/30 to-transparent opacity-0 transition-opacity duration-200 sm:flex sm:group-hover:opacity-100">
                                                    <div className="pointer-events-auto flex gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="secondary"
                                                            className="h-8 rounded-md px-3 text-xs font-medium bg-white/95 hover:bg-white"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                onComparisonPreview?.(
                                                                    entry.requestId,
                                                                    result
                                                                );
                                                            }}
                                                        >
                                                            预览
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            className="h-8 rounded-md bg-blue-500 px-3 text-xs font-medium text-white hover:bg-blue-600"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                onComparisonApply?.(result);
                                                            }}
                                                            disabled={!result.xml && !result.svg}
                                                        >
                                                            设为画布
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* 底部信息区 */}
                                        <div className="px-3 py-2 bg-white border-t border-slate-100">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-xs font-medium text-slate-900 truncate">
                                                    {result.label || result.modelId}
                                                </div>
                                                {result.status === "ok" && (
                                                    <div className="flex gap-1.5 sm:hidden">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 rounded-md px-2 text-[11px]"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                onComparisonPreview?.(
                                                                    entry.requestId,
                                                                    result
                                                                );
                                                            }}
                                                        >
                                                            预览
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            className="h-6 rounded-md bg-blue-500 px-2 text-[11px] text-white hover:bg-blue-600"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                onComparisonApply?.(result);
                                                            }}
                                                            disabled={!result.xml && !result.svg}
                                                        >
                                                            设为画布
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Token 使用信息 */}
                                            {result.status === "ok" && (result.usage || result.durationMs !== undefined) && (
                                                <TokenUsageDisplay
                                                    usage={result.usage}
                                                    durationMs={result.durationMs}
                                                    compact
                                                />
                                            )}
                                        </div>

                                        {/* 错误状态 */}
                                        {result.status === "error" && (
                                            <div className="px-3 py-2 bg-red-50 border-t border-red-100">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="text-[11px] text-red-700 leading-relaxed">
                                                        {result.error ?? "调用模型失败，请稍后重试或调整提示词。"}
                                                    </div>
                                                    {onComparisonRetry && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 w-fit rounded-md px-2 text-[11px] font-medium border-red-200 text-red-700 hover:bg-red-100"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                onComparisonRetry(entry, result);
                                                            }}
                                                        >
                                                            重新生成
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* 加载状态 */}
                                        {result.status === "loading" && (
                                            <div className="px-3 py-2 bg-slate-50 border-t border-slate-100">
                                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                                    <div className="h-2.5 w-2.5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin"></div>
                                                    正在生成…
                                                </div>
                                            </div>
                                        )}

                                        {/* 暂停状态 */}
                                        {result.status === "cancelled" && (
                                            <div className="px-3 py-2 bg-amber-50 border-t border-amber-100">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="text-[11px] text-amber-700 leading-relaxed">
                                                        {result.error ?? "生成已暂停"}
                                                    </div>
                                                    {onComparisonRetry && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 w-fit rounded-md px-2 text-[11px] font-medium border-amber-200 text-amber-700 hover:bg-amber-100"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                onComparisonRetry(entry, result);
                                                            }}
                                                        >
                                                            重新生成
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }, [activeBranchId, activePreview, buildComparisonPreviewUrl, onComparisonApply, onComparisonPreview, onComparisonRetry, onStopAllProp]);

    const resolveMessageText = useCallback((message: UIMessage): string => {
        if (typeof (message as any).content === "string") {
            return (message as any).content;
        }
        if (Array.isArray((message as any).parts)) {
            return (message as any).parts
                .filter(
                    (part: any) =>
                        part.type === "text" &&
                        (typeof part.text === "string" || typeof part.displayText === "string")
                )
                .map(
                    (part: any) =>
                        stripThink(
                            (typeof part.displayText === "string" && part.displayText.length > 0
                                ? part.displayText
                                : part.text) ?? ""
                        )
                )
                .join("\n")
                .trim();
        }
        return "";
    }, []);

    const handleCopyMessage = useCallback(async (messageId: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, []);

    const toggleMessageExpanded = useCallback((messageId: string, currentExpanded: boolean) => {
        setExpandedMessages(prev => ({
            ...prev,
            [messageId]: !currentExpanded
        }));
    }, []);

    const leadingComparisons = useMemo(
        () => comparisonHistory.filter((entry) => !entry.anchorMessageId),
        [comparisonHistory]
    );

    const anchoredComparisons = useMemo(() => {
        const map = new Map<string, ComparisonHistoryEntry[]>();
        comparisonHistory.forEach((entry) => {
            if (!entry.anchorMessageId) return;
            const bucket = map.get(entry.anchorMessageId) ?? [];
            bucket.push(entry);
            map.set(entry.anchorMessageId, bucket);
        });
        return map;
    }, [comparisonHistory]);

    const renderedAnchors = useRef(new Set<string>());

    // Reset renderedAnchors on each render

    renderedAnchors.current.clear();



    const showExamplePanel = (

        messages.length === 0 &&

        leadingComparisons.length === 0 &&

        comparisonHistory.length === 0

    );



    return (
        <div className="pr-4">
            {showExamplePanel ? (
                <div className="py-2">
                    <ExamplePanel
                        setInput={setInput}
                        setFiles={setFiles}
                    />
                </div>
            ) : (
                <>

                    {leadingComparisons.map((entry, index) => (

                        <div

                            key={`comparison-leading-${index}`}

                            className="mb-5 text-left"

                        >

                            {renderComparisonEntry(entry, `comparison-leading-${index}`)}

                        </div>

                    ))}

                    {messages.map((message) => {

                        const isUser = message.role === "user";

                        const parts = Array.isArray(message.parts) ? message.parts : [];

                        const toolParts = parts.filter((part: any) =>

                            part.type?.startsWith("tool-")

                        );

                        const contentParts = parts.filter(

                            (part: any) => !part.type?.startsWith("tool-")

                        );

                        const augmentedContentParts = contentParts.flatMap((part: any) => {

                            if (part.type === "text") {

                                const rawText = stripThink(part.text ?? "");
                                // 尝试匹配 markdown 代码块中的 SVG（支持多种换行符）
                                const codeBlockMatch = rawText.match(/```svg\s*\n([\s\S]*?)```/i);
                                // 如果代码块匹配失败，且文本中包含 <svg 标签，尝试直接提取 SVG 内容
                                let svgPayload = codeBlockMatch?.[1];

                                if (!svgPayload && rawText.includes("<svg")) {
                                    // 尝试提取从 <svg 到 </svg> 的内容
                                    const svgMatch = rawText.match(/(<svg[\s\S]*?<\/svg>)/i);
                                    if (svgMatch) {
                                        svgPayload = svgMatch[1];
                                    }
                                }

                                const dataUrl = svgPayload ? svgToDataUrl(svgPayload.trim()) : null;
                                const base = {
                                    ...part,
                                    displayText:
                                        part.displayText ??
                                        (rawText.trim().length > 0 ? rawText : "SVG 转绘请求"),
                                };
                                if (dataUrl) {
                                    return [
                                        base,
                                        { type: "file", url: dataUrl, mediaType: "image/svg+xml" },
                                    ];
                                }
                            }

                            return [part];

                        });

                        const displayableContentParts = augmentedContentParts.filter((part: any) => {

                            if (part.type === "text") {

                                const textToShow = (part.displayText ?? part.text ?? "").trim();

                                return textToShow.length > 0;

                            }

                            return true;

                        });

                        const fallbackText =

                            augmentedContentParts.length === 0 ? resolveMessageText(message) : "";

                        const hasBubbleContent =

                            displayableContentParts.length > 0 || fallbackText.length > 0;



                        const anchoredEntries = anchoredComparisons.get(message.id) ?? [];

                        if (anchoredEntries.length > 0) {

                            renderedAnchors.current.add(message.id);

                        }



                        const fullMessageText = resolveMessageText(message);

                        const isExpanded = expandedMessages[message.id] ?? !(fullMessageText.length > 500);

                        const isCopied = copiedMessageId === message.id;



                        return (

                            <MessageItem

                                key={message.id}

                                message={message}

                                isUser={isUser}

                                isExpanded={isExpanded}

                                isCopied={isCopied}

                                fullMessageText={fullMessageText}

                                displayableContentParts={displayableContentParts}

                                fallbackText={fallbackText}

                                hasBubbleContent={hasBubbleContent}

                                toolParts={toolParts}

                                anchoredEntries={anchoredEntries}

                                renderToolPart={renderToolPart}

                                renderComparisonEntry={renderComparisonEntry}

                                onCopyMessage={handleCopyMessage}

                                onToggleExpanded={toggleMessageExpanded}

                                onMessageRevert={onMessageRevert}

                            />

                        );

                    })}

                    {Array.from(anchoredComparisons.entries())

                        .filter(([anchorId]) => !renderedAnchors.current.has(anchorId))

                        .flatMap(([, entries]) => entries)

                        .map((entry, index) => (

                            <div

                                key={`comparison-orphan-${entry.requestId}-${index}`}

                                className="mb-5 text-left"

                            >

                                {renderComparisonEntry(

                                    entry,

                                    `comparison-orphan-${entry.requestId}-${index}`

                                )}

                            </div>

                        ))}

                </>

            )}
            {/* 显示生成中的 loading 提示 */}
            {isGenerationBusy && !hasLiveToolCard && (() => {
                // 格式化耗时显示
                const formatElapsedTime = (ms: number) => {
                    const seconds = Math.floor(ms / 1000);
                    const minutes = Math.floor(seconds / 60);
                    const remainingSeconds = seconds % 60;

                    if (minutes > 0) {
                        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
                    }
                    return `${seconds}s`;
                };

                const elapsedDisplay = formatElapsedTime(generationElapsedTime);

                return (
                    <div className="flex justify-start mb-5">
                        <div className="inline-flex items-center gap-3 rounded-2xl backdrop-blur-xl bg-white/60 border border-white/40 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.4)]">
                            <div className="flex space-x-1">
                                <div className="h-2 w-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="h-2 w-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="h-2 w-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm text-slate-700 font-medium">
                                    正在绘制中...
                                </span>
                                <span className="text-xs text-slate-500 font-mono">
                                    {elapsedDisplay}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })()}
            {error && (
                <div className="text-red-500 text-sm mt-2">
                    错误：{error.message}
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
    );
}
