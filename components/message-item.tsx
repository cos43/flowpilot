"use client";

import { memo, useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { UIMessage } from "ai";
import { ComparisonHistoryEntry } from "@/types/comparison";
import { TokenUsageDisplay } from "./token-usage-display";

interface MessageItemProps {
    message: UIMessage;
    isUser: boolean;
    isExpanded: boolean;
    isCopied: boolean;
    fullMessageText: string;
    displayableContentParts: any[];
    fallbackText: string;
    hasBubbleContent: boolean;
    toolParts: any[];
    anchoredEntries: ComparisonHistoryEntry[];
    renderToolPart: (part: any, metadata?: any) => React.ReactNode;
    renderComparisonEntry: (entry: ComparisonHistoryEntry, keyBase: string) => React.ReactNode;
    onCopyMessage: (messageId: string, text: string) => void;
    onToggleExpanded: (messageId: string, currentExpanded: boolean) => void;
    onMessageRevert?: (payload: { messageId: string; text: string }) => void;
}

export const MessageItem = memo(({
    message,
    isUser,
    isExpanded,
    isCopied,
    fullMessageText,
    displayableContentParts,
    fallbackText,
    hasBubbleContent,
    toolParts,
    anchoredEntries,
    renderToolPart,
    renderComparisonEntry,
    onCopyMessage,
    onToggleExpanded,
    onMessageRevert,
}: MessageItemProps) => {
    const shouldCollapse = fullMessageText.length > 500;
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const messageMetadata = (message as any)?.metadata || {};
    const usageInfo = messageMetadata?.usage;
    const durationMs = messageMetadata?.durationMs as number | undefined;

    return (
        <div className="mb-5 flex flex-col gap-2">
            {hasBubbleContent && (
                <div
                    className={cn(
                        "flex w-full",
                        isUser ? "justify-end" : "justify-start"
                    )}
                >
                    <div className="relative max-w-[min(480px,80%)] group">
                        <div
                            className={cn(
                                "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                                "whitespace-pre-wrap break-all",
                                isUser
                                    ? "bg-slate-900 text-white shadow-[0_2px_8px_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.15)]"
                                    : "backdrop-blur-xl bg-white/60 border border-white/40 text-slate-900 shadow-[0_8px_32px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.4)]",
                                !isExpanded && shouldCollapse && "max-h-[200px] overflow-hidden relative"
                            )}
                        >
                            {displayableContentParts.map((part: any, index: number) => {
                                switch (part.type) {
                                    case "text":
                                        const textToShow =
                                            part.displayText ?? part.text ?? "";
                                        return (
                                            <div key={index} className="mb-1 last:mb-0 whitespace-pre-wrap break-all">
                                                {textToShow}
                                            </div>
                                        );
                                    case "file":
                                        // 对于 SVG，在界面上显示为普通图片预览（避免直接渲染 SVG 太大）
                                        // 但实际的 part.url 中仍保留完整的 SVG code 给大模型使用
                                        if (part.mediaType === "image/svg+xml" && part.url?.startsWith("data:image/svg+xml")) {
                                            return (
                                                <div key={index} className="mt-3 inline-flex">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewImage(part.url)}
                                                        className="group relative flex items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100 transition-colors"
                                                        style={{ width: 160, height: 120 }}
                                                        title="点击放大预览 SVG"
                                                    >
                                                        <img
                                                            src={part.url}
                                                            alt={`svg-${index}`}
                                                            className="max-w-full max-h-full object-contain p-2"
                                                        />
                                                    </button>
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={index} className="mt-3 inline-flex">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewImage(part.url)}
                                                    className="group relative block overflow-hidden rounded-lg border border-slate-200 bg-white hover:border-slate-300"
                                                    style={{ width: 160, height: 120 }}
                                                    title="点击放大预览"
                                                >
                                                    <Image
                                                        src={part.url}
                                                        fill
                                                        alt={`file-${index}`}
                                                        sizes="160px"
                                                        className="object-contain"
                                                    />
                                                </button>
                                            </div>
                                        );
                                    default:
                                        return null;
                                }
                            })}
                            {!displayableContentParts.length && fallbackText && (
                                <div>{fallbackText}</div>
                            )}
                            {!isExpanded && shouldCollapse && (
                                <div
                                    className={cn(
                                        "absolute bottom-0 left-0 right-0 h-20 pointer-events-none",
                                        isUser
                                            ? "bg-gradient-to-t from-slate-900 to-transparent"
                                            : "bg-gradient-to-t from-white to-transparent"
                                    )}
                                />
                            )}
                        </div>

                        {previewImage && (
                            <div
                                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                                onClick={() => setPreviewImage(null)}
                            >
                                <div
                                    className="relative max-h-[90vh] max-w-[90vw] rounded-2xl bg-white p-3 shadow-2xl"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        type="button"
                                        className="absolute right-2 top-2 rounded-full bg-slate-800 px-2 py-1 text-xs font-semibold text-white shadow hover:bg-slate-900 z-10"
                                        onClick={() => setPreviewImage(null)}
                                    >
                                        关闭
                                    </button>
                                    <div className="flex items-center justify-center" style={{ maxHeight: '80vh', maxWidth: '85vw' }}>
                                        {previewImage.startsWith('data:image/svg+xml') ? (
                                            <img
                                                src={previewImage}
                                                alt="svg-preview"
                                                className="max-h-full max-w-full object-contain"
                                            />
                                        ) : (
                                            <div className="relative h-[70vh] w-[78vw] max-w-5xl">
                                                <Image
                                                    src={previewImage}
                                                    alt="full-preview"
                                                    fill
                                                    sizes="90vw"
                                                    className="object-contain"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className={cn(
                            "flex items-center gap-1.5 mt-1.5",
                            isUser ? "justify-end" : "justify-start"
                        )}>
                            <button
                                type="button"
                                onClick={() => onCopyMessage(message.id, fullMessageText)}
                                className={cn(
                                    "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all backdrop-blur-xl",
                                    isUser
                                        ? "text-slate-700 bg-white/90 border border-white/60 hover:bg-white hover:text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.15)] active:scale-95"
                                        : "text-slate-600 bg-white/60 border border-white/40 hover:bg-white/80 hover:text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.06)] active:scale-95",
                                    isCopied && "!text-emerald-600 !bg-emerald-50/90 !border-emerald-200/40"
                                )}
                                title="复制消息"
                            >
                                {isCopied ? (
                                    <>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>已复制</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        <span>复制</span>
                                    </>
                                )}
                            </button>

                                    {shouldCollapse && (
                                <button
                                    type="button"
                                            onClick={() => onToggleExpanded(message.id, isExpanded)}
                                    className={cn(
                                        "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all backdrop-blur-xl",
                                        isUser
                                            ? "text-slate-700 bg-white/90 border border-white/60 hover:bg-white hover:text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.15)] active:scale-95"
                                            : "text-slate-600 bg-white/60 border border-white/40 hover:bg-white/80 hover:text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.06)] active:scale-95"
                                    )}
                                >
                                    {isExpanded ? (
                                        <>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                            </svg>
                                            <span>收起</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                            <span>展开</span>
                                        </>
                                    )}
                                </button>
                            )}
                            {isUser && onMessageRevert && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        onMessageRevert({
                                            messageId: message.id,
                                            text: fullMessageText,
                                        })
                                    }
                                    className={cn(
                                        "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all backdrop-blur-xl",
                                        isUser
                                            ? "text-slate-700 bg-white/90 border border-white/60 hover:bg-white hover:text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.15)] active:scale-95"
                                            : "text-slate-600 bg-white/60 border border-white/40 hover:bg-white/80 hover:text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.06)] active:scale-95"
                                    )}
                                    title="回滚到此处"
                                >
                                    <svg
                                        className="w-3.5 h-3.5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M15 3h4v4m-9 9l9-9m-9 0h4"
                                        />
                                    </svg>
                                    <span>Revert</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {!isUser && (usageInfo || durationMs !== undefined) && (
                <div
                    className={cn(
                        "mt-1.5 flex",
                        "justify-start"
                    )}
                >
                    <TokenUsageDisplay
                        usage={usageInfo}
                        durationMs={durationMs}
                        compact
                    />
                </div>
            )}
            {toolParts.map((part: any) => (
                <div
                    key={part.toolCallId}
                    className={cn(
                        "flex w-full",
                        isUser ? "justify-end" : "justify-start"
                    )}
                >
                    {renderToolPart(part, message.metadata)}
                </div>
            ))}
            {anchoredEntries.length > 0 && (
                <div className="mt-2 flex flex-col gap-3">
                    {anchoredEntries.map((entry, index) =>
                        renderComparisonEntry(entry, `comparison-anchored-${entry.requestId}-${index}`)
                    )}
                </div>
            )}
        </div>
    );
});

MessageItem.displayName = "MessageItem";
