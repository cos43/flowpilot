"use client";

import React, { useState, useRef, useEffect } from "react";
import {
    Upload,
    FileCode,
    ClipboardPaste,
    X,
    Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useModelRegistry } from "@/hooks/use-model-registry";
import { ModelSelector } from "@/components/model-selector";
import { Badge } from "@/components/ui/badge";
import type { RuntimeModelOption } from "@/types/model-config";
import { svgToDataUrl } from "@/lib/svg";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface SmartSvgConverterDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConvert: (svgContent: string, modelKey: string) => void;
    models?: RuntimeModelOption[];
    selectedModelKey?: string;
    onModelChange?: (key: string) => void;
    initialSvg?: string;
}

export function SmartSvgConverterDialog({
    open,
    onOpenChange,
    onConvert,
    models,
    selectedModelKey,
    onModelChange,
    initialSvg,
}: SmartSvgConverterDialogProps) {
    // Use props if available, otherwise fall back to hook (for standalone usage)
    const registry = useModelRegistry();
    
    const effectiveModels = models || registry.models;
    const effectiveSelectedKey = selectedModelKey || registry.selectedModelKey;
    const effectiveOnModelChange = onModelChange || registry.selectModel;

    const [svgContent, setSvgContent] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Downscale the SVG into a lightweight thumbnail so the modal shows the full composition
    useEffect(() => {
        if (!svgContent.trim()) {
            setPreviewUrl(null);
            return;
        }

        const dataUrl = svgToDataUrl(svgContent);
        if (!dataUrl) {
            setPreviewUrl(null);
            return;
        }

        // Use the raw data URL as a quick fallback while generating the thumbnail
        setPreviewUrl(dataUrl);

        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (cancelled) return;
            const naturalWidth = img.naturalWidth || img.width || 1;
            const naturalHeight = img.naturalHeight || img.height || 1;
            const maxWidth = 520;
            const maxHeight = 340;
            const scale = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);
            const targetWidth = Math.max(1, Math.round(naturalWidth * scale));
            const targetHeight = Math.max(1, Math.round(naturalHeight * scale));
            const canvas = document.createElement("canvas");
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                setPreviewUrl(dataUrl);
                return;
            }
            ctx.clearRect(0, 0, targetWidth, targetHeight);
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            const thumbnail = canvas.toDataURL("image/png");
            setPreviewUrl(thumbnail || dataUrl);
        };
        img.onerror = () => {
            if (!cancelled) setPreviewUrl(dataUrl);
        };
        img.src = dataUrl;

        return () => {
            cancelled = true;
        };
    }, [svgContent]);

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setSvgContent("");
            setError(null);
            setPreviewUrl(null);
        } else if (initialSvg && initialSvg.includes("<svg")) {
            setSvgContent(initialSvg);
            setError(null);
        }
    }, [open, initialSvg]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_FILE_SIZE) {
            setError("文件大小不能超过 5MB");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            setSvgContent(content);
            setError(null);
        };
        reader.readAsText(file);
    };

    const handleStart = () => {
        if (!svgContent.trim()) return;
        if (!effectiveSelectedKey) {
            setError("请先选择一个模型");
            return;
        }
        onConvert(svgContent, effectiveSelectedKey);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-[800px] flex flex-col p-0 gap-0">
                <div className="p-6 pb-2">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Sparkles className="h-5 w-5 text-violet-600" />
                            智能 SVG 转换器
                            <Badge variant="secondary" className="bg-violet-100 text-violet-700 hover:bg-violet-100">
                                Beta
                            </Badge>
                        </DialogTitle>
                        <DialogDescription>
                             利用大模型将 SVG 矢量图转换为完全可编辑的 Draw.io 流程图。
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 pt-4 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                    <FileCode className="h-4 w-4" />
                                    原始 SVG
                                </h3>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload className="h-3 w-3 mr-1" />
                                        上传
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => {
                                            navigator.clipboard.readText().then(text => {
                                                if (text.includes("<svg")) setSvgContent(text);
                                                else setError("剪贴板内容不是有效的 SVG");
                                            });
                                        }}
                                    >
                                        <ClipboardPaste className="h-3 w-3 mr-1" />
                                        粘贴
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="relative h-[300px] rounded-lg border border-slate-200 bg-white overflow-hidden group">
                                {svgContent ? (
                                    <>
                                        <div className="absolute inset-0 p-4 flex items-center justify-center bg-slate-50">
                                            {previewUrl ? (
                                                <img
                                                    src={previewUrl}
                                                    alt="svg-preview"
                                                    className="h-full w-full object-contain rounded-md shadow-sm bg-white"
                                                    draggable={false}
                                                />
                                            ) : (
                                                <div className="text-center text-xs text-slate-500 leading-relaxed px-4">
                                                    SVG 预览生成失败，请检查代码是否完整。
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => setSvgContent("")}
                                            className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100"
                                        >
                                            <X className="h-4 w-4 text-slate-500" />
                                        </button>
                                    </>
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-8 text-center border-2 border-dashed border-slate-100 m-2 rounded-md">
                                        <FileCode className="h-8 w-8 mb-2 opacity-50" />
                                        <p className="text-sm">粘贴 SVG 代码或上传文件</p>
                                    </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".svg"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                             <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-700">选择模型</label>
                            </div>
                             <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-4">
                                 <p className="text-xs text-slate-500 leading-relaxed">
                                    建议选择具备较强代码理解与空间推理能力的模型（如 Claude 3.5 Sonnet, GPT-4o）。
                                    模型将分析 SVG 路径、颜色与结构，并将其重构为 Draw.io 原生组件。
                                 </p>
                                 <ModelSelector
                                    selectedModelKey={effectiveSelectedKey}
                                    onModelChange={effectiveOnModelChange}
                                    models={effectiveModels}
                                    onManage={() => {}}
                                />
                             </div>
                             
                             {error && (
                                <div className="rounded-md bg-red-50 p-3 border border-red-100">
                                    <p className="text-xs text-red-600 font-medium">{error}</p>
                                </div>
                            )}
                             
                             <div className="mt-auto pt-4 flex justify-end gap-3">
                                <Button 
                                    variant="outline" 
                                    onClick={() => onOpenChange(false)}
                                >
                                    取消
                                </Button>
                                <Button 
                                    onClick={handleStart}
                                    disabled={!svgContent || !effectiveSelectedKey}
                                    className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    开始转绘
                                </Button>
                             </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
