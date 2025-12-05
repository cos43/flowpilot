"use client";

import React, { useCallback, useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square } from "lucide-react";
import { FilePreviewList } from "@/components/file-preview-list";
import { HistoryDialog } from "@/components/history-dialog";
import { ModelSelector } from "@/components/model-selector";
import { cn } from "@/lib/utils";
import type { RuntimeModelOption } from "@/types/model-config";
import { RenderModeToggle } from "@/components/render-mode-toggle";
import { ComparisonQuickAccess } from "@/components/comparison-quick-access";

interface ChatInputOptimizedProps {
    input: string;
    status: "submitted" | "streaming" | "ready" | "error";
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onClearChat: () => void;
    files?: File[];
    onFileChange?: (files: File[]) => void;
    showHistory?: boolean;
    onToggleHistory?: (show: boolean) => void;
    isCompactMode?: boolean;
    selectedModelKey?: string;
    modelOptions?: RuntimeModelOption[];
    onModelChange?: (modelKey: string) => void;
    onManageModels?: () => void;
    onCompareRequest?: () => void;
    onOpenComparisonConfig?: () => void;
    isCompareLoading?: boolean;
    interactionLocked?: boolean;
    // 流式配置回调
    onModelStreamingChange?: (modelKey: string, isStreaming: boolean) => void;
    renderMode?: "drawio" | "svg";
    onRenderModeChange?: (mode: "drawio" | "svg") => void;
    comparisonEnabled?: boolean;
    onStop?: () => void;
    isBusy?: boolean;
    historyItems?: Array<{ svg: string }>;
    onRestoreHistory?: (index: number) => void;
    // 图表画廊相关
    onShowDiagramGallery?: () => void;
    onConvertSvg?: () => void;
}

export function ChatInputOptimized({
    input,
    status,
    onSubmit,
    onChange,
    onClearChat,
    files = [],
    onFileChange = () => { },
    showHistory = false,
    onToggleHistory = () => { },
    isCompactMode = false,
    selectedModelKey,
    modelOptions = [],
    onModelChange = () => { },
    onManageModels,
    onCompareRequest = () => { },
    onOpenComparisonConfig = () => { },
    isCompareLoading = false,
    interactionLocked = false,
    onModelStreamingChange,
    renderMode = "drawio",
    onRenderModeChange,
    comparisonEnabled = true,
    onStop,
    isBusy = false,
    historyItems = [],
    onRestoreHistory,
    // 图表画廊参数
    onShowDiagramGallery,
    onConvertSvg,
}: ChatInputOptimizedProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const controlBarRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isRenderModeIconOnly, setIsRenderModeIconOnly] = useState(false);
    const [shouldHideModelSelector, setShouldHideModelSelector] = useState(false);

    const MAX_VISIBLE_LINES = 5;
    const MAX_TEXTAREA_HEIGHT_PX = 160;
    const RENDER_MODE_ICON_BREAKPOINT = 460;
    const MODEL_SELECTOR_HIDE_BREAKPOINT = 400;

    // Auto-resize textarea based on content
    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            const lineHeight =
                parseFloat(window.getComputedStyle(textarea).lineHeight || "24") ||
                24;
            const maxHeight = Math.min(lineHeight * MAX_VISIBLE_LINES, MAX_TEXTAREA_HEIGHT_PX);
            textarea.style.height = "auto";
            textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
            textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
        }
    }, []);

    useEffect(() => {
        adjustTextareaHeight();
    }, [input, adjustTextareaHeight]);

    // Handle keyboard shortcuts and paste events
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            const form = e.currentTarget.closest("form");
            if (form && input.trim() && status !== "streaming") {
                form.requestSubmit();
            }
        }
    };

    // Handle clipboard paste
    const handlePaste = async (e: React.ClipboardEvent) => {
        if (status === "streaming") return;

        const items = e.clipboardData.items;
        const imageItems = Array.from(items).filter((item) =>
            item.type.startsWith("image/")
        );

        if (imageItems.length > 0) {
            const imageFiles = await Promise.all(
                imageItems.map(async (item) => {
                    const file = item.getAsFile();
                    if (!file) return null;
                    // Create a new file with a unique name
                    return new File(
                        [file],
                        `pasted-image-${Date.now()}.${file.type.split("/")[1]}`,
                        {
                            type: file.type,
                        }
                    );
                })
            );

            const validFiles = imageFiles.filter(
                (file): file is File => file !== null
            );
            if (validFiles.length > 0) {
                onFileChange([...files, ...validFiles]);
            }
        }
    };

    // Handle file changes
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newFiles = Array.from(e.target.files || []);
        onFileChange([...files, ...newFiles]);
    };

    // Remove individual file
    const handleRemoveFile = (fileToRemove: File) => {
        onFileChange(files.filter((file) => file !== fileToRemove));
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleRemoveAllFiles = () => {
        if (files.length === 0) return;
        onFileChange([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // Trigger file input click
    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    // Handle drag events
    const handleDragOver = (e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (status === "streaming") return;

        const droppedFiles = e.dataTransfer.files;

        // Only process image files
        const imageFiles = Array.from(droppedFiles).filter((file) =>
            file.type.startsWith("image/")
        );

        if (imageFiles.length > 0) {
            onFileChange([...files, ...imageFiles]);
        }
    };

    // 监听底部工具栏宽度，窄屏时收起文字与模型选择
    useEffect(() => {
        const container = controlBarRef.current;
        if (!container || typeof ResizeObserver === "undefined") return;

        const updateFlags = (width: number) => {
            const compactRenderToggle = width < RENDER_MODE_ICON_BREAKPOINT;
            const hideModelPicker = width < MODEL_SELECTOR_HIDE_BREAKPOINT;

            setIsRenderModeIconOnly((prev) =>
                prev === compactRenderToggle ? prev : compactRenderToggle
            );
            setShouldHideModelSelector((prev) =>
                prev === hideModelPicker ? prev : hideModelPicker
            );
        };

        updateFlags(container.getBoundingClientRect().width);

        const resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            updateFlags(entry.contentRect.width);
        });

        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, []);

    const showStopButton =
        (status === "streaming" || isBusy) && typeof onStop === "function";

    return (
        <form
            onSubmit={onSubmit}
            className="w-full"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div
                className={cn(
                    "relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/60 border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.4)] transition-all",
                    isDragging && "ring-2 ring-slate-400/50"
                )}
            >
                {files.length > 0 && (
                    <div className="flex flex-col gap-1 border-b border-white/30 px-3 py-2">
                        <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white shadow-sm">
                                {files.length} 个附件
                            </span>
                            <button
                                type="button"
                                onClick={handleRemoveAllFiles}
                                className="rounded-full px-2 py-0.5 text-[11px] text-slate-500 transition-all hover:bg-white/40 hover:text-slate-700"
                            >
                                移除全部
                            </button>
                        </div>
                        <FilePreviewList
                            files={files}
                            onRemoveFile={handleRemoveFile}
                            variant="chip"
                        />
                    </div>
                )}

                <div className="px-3 py-1.5">
                    <Textarea
                        ref={textareaRef}
                        value={input}
                        onChange={onChange}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        placeholder="描述你想让流程图如何调整，支持拖拽或粘贴图片作为参考素材"
                        disabled={status === "streaming"}
                        aria-label="聊天输入框"
                        className="h-auto min-h-[48px] max-h-[160px] resize-none border-0 !border-none bg-transparent p-0 text-sm leading-5 text-slate-900 outline-none shadow-none focus-visible:border-0 focus-visible:ring-0 focus-visible:outline-none focus-visible:!border-none focus-visible:!outline-none focus-visible:shadow-none overflow-y-auto"
                    />
                </div>

                <div
                    ref={controlBarRef}
                    className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1"
                >
                    <div className="flex flex-wrap items-center gap-1.5">
                        <ModelSelector
                            selectedModelKey={selectedModelKey}
                            onModelChange={onModelChange}
                            models={modelOptions}
                            onManage={onManageModels}
                            disabled={status === "streaming" || interactionLocked}
                            onModelStreamingChange={onModelStreamingChange}
                            compact
                        />
                    </div>

                    <div className="flex items-center gap-1.5">
                        {comparisonEnabled && (
                            <ComparisonQuickAccess
                                disabled={
                                    status === "streaming" ||
                                    (!input.trim() && !isCompareLoading) ||
                                    interactionLocked
                                }
                                isCompareLoading={isCompareLoading}
                                onCompareRequest={onCompareRequest}
                                onOpenComparisonConfig={onOpenComparisonConfig}
                                compact={false}
                            />
                        )}
                        <Button
                            type={showStopButton ? "button" : "submit"}
                            onClick={showStopButton ? onStop : undefined}
                            disabled={
                                showStopButton
                                    ? false
                                    : status === "streaming" ||
                                    !input.trim() ||
                                    interactionLocked
                            }
                            className={cn(
                                "h-[28px] rounded-full text-[11px] font-medium shadow-[0_2px_8px_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.15)] transition-all active:scale-95 disabled:opacity-60 disabled:active:scale-100",
                                showStopButton
                                    ? "min-w-[32px] gap-1.5 border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                    : "w-[32px] justify-center bg-slate-900 text-white hover:bg-slate-800"
                            )}
                            size="sm"
                            aria-label={showStopButton ? "终止对话" : "发送消息"}
                        >
                            {showStopButton ? (
                                <>
                                    <Square className="h-3.5 w-3.5" />
                                </>
                            ) : (
                                <Send className="h-3.5 w-3.5" />
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
                accept="image/*"
                multiple
                disabled={status === "streaming" || interactionLocked}
            />

            {/* 原有的图表版本历史对话框 */}
            <HistoryDialog
                showHistory={showHistory}
                onToggleHistory={onToggleHistory}
                items={historyItems}
                onRestore={onRestoreHistory}
            />
        </form>
    );
}
