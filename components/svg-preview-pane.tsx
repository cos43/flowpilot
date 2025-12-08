"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, ZoomIn, ZoomOut, Maximize2, FileImage, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSvgEditor } from "@/contexts/svg-editor-context";
import { DEFAULT_WELCOME_SVG } from "@/data/default-welcome-svg";

export function SvgPreviewPane() {
    const { doc, exportSvgMarkup, streamingSvgContent, elements, previewSvgMarkup, rawSvgMarkup } = useSvgEditor();
    const [userScale, setUserScale] = useState(1);
    const [baseScale, setBaseScale] = useState(1);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const svgMarkup = useMemo(() => {
        const content = streamingSvgContent || rawSvgMarkup || previewSvgMarkup || exportSvgMarkup();
        return typeof content === "string" && content.includes("<svg") ? content : "";
    }, [streamingSvgContent, rawSvgMarkup, previewSvgMarkup, exportSvgMarkup]);

    const hasRealSvg = useMemo(
        () => Boolean(streamingSvgContent || rawSvgMarkup || previewSvgMarkup || (elements?.length ?? 0) > 0),
        [streamingSvgContent, rawSvgMarkup, previewSvgMarkup, elements]
    );

    // Reset user scale when内容变化
    useEffect(() => {
        setUserScale(1);
    }, [svgMarkup]);

    // Auto-fit only for welcome SVG; real diagrams keep their natural scale (user adjustable).
    useEffect(() => {
        const updateScale = () => {
            const node = containerRef.current;
            if (!node) return;
            const { clientWidth, clientHeight } = node;
            const targetWidth = hasRealSvg ? doc.width : 980;
            const targetHeight = hasRealSvg ? doc.height : 540;
            if (!targetWidth || !targetHeight) return;

            const padding = 24; // align with container padding (p-6)
            const fit = Math.min(
                (clientWidth - padding * 2) / targetWidth,
                (clientHeight - padding * 2) / targetHeight
            );
            const clamped = Number.isFinite(fit) && fit > 0 ? Math.min(Math.max(fit, 0.2), 3) : 1;
            setBaseScale(hasRealSvg ? 1 : clamped);
        };

        updateScale();

        // Some mobile webviews (e.g. older WeChat/Android) lack ResizeObserver; fall back to window resize.
        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", updateScale);
            return () => window.removeEventListener("resize", updateScale);
        }

        const observer = new ResizeObserver(() => updateScale());
        const node = containerRef.current;
        if (node) {
            observer.observe(node);
        }
        return () => observer.disconnect();
    }, [doc.width, doc.height, svgMarkup, hasRealSvg]);

    const handleZoom = useCallback((delta: number) => {
        setUserScale((prev) => {
            const next = Math.min(3, Math.max(0.4, Number((prev + delta).toFixed(2))));
            return next;
        });
    }, []);

    const handleSave = useCallback(async (format: "svg" | "png") => {
        const content = exportSvgMarkup();
        if (!content) return;

        if (format === "svg") {
            const blob = new Blob([content], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `flowpilot-export-${Date.now()}.svg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else if (format === "png") {
            const img = new Image();
            const blob = new Blob([content], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);

            img.onload = () => {
                const canvas = document.createElement("canvas");
                // Use higher resolution for better quality
                const scale = 2;
                canvas.width = (doc.width || 800) * scale;
                canvas.height = (doc.height || 600) * scale;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;

                // Fill white background
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.scale(scale, scale);
                ctx.drawImage(img, 0, 0);

                const pngUrl = canvas.toDataURL("image/png");
                const a = document.createElement("a");
                a.href = pngUrl;
                a.download = `flowpilot-export-${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            };

            img.src = url;
        }
    }, [exportSvgMarkup, doc.width, doc.height]);

    const content = hasRealSvg && svgMarkup ? svgMarkup : DEFAULT_WELCOME_SVG;

    return (
        <div className="relative flex h-full w-full flex-col rounded-xl bg-white">
            <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 shadow-sm">
                {hasRealSvg && (
                    <>
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent("flowpilot:convert-svg"));
                            }}
                        >
                            转绘为 draw.io 可编辑
                        </button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-200 transition-colors outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    保存
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="w-36">
                                <DropdownMenuItem onClick={() => handleSave("svg")} className="gap-2 text-xs">
                                    <FileCode className="h-3.5 w-3.5 text-slate-500" />
                                    SVG 矢量图
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSave("png")} className="gap-2 text-xs">
                                    <FileImage className="h-3.5 w-3.5 text-slate-500" />
                                    PNG 图片
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="h-5 w-px bg-slate-300"></div>
                    </>
                )}
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
                        onClick={() => handleZoom(-0.15)}
                        aria-label="缩小"
                    >
                        <ZoomOut className="h-4 w-4" />
                    </button>
                    <span className="min-w-[52px] text-center text-[11px] font-semibold text-slate-600">
                        {(userScale * baseScale * 100).toFixed(0)}%
                    </span>
                    <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
                        onClick={() => handleZoom(0.15)}
                        aria-label="放大"
                    >
                        <ZoomIn className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
                        onClick={() => setUserScale(1)}
                        aria-label="重置"
                    >
                        <Maximize2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div
                ref={containerRef}
                className="relative h-full w-full overflow-auto bg-slate-50/40"
                onWheel={(e) => {
                    if (e.ctrlKey) {
                        e.preventDefault();
                        handleZoom(e.deltaY > 0 ? -0.08 : 0.08);
                    }
                }}
            >
                <div className="flex h-full w-full items-center justify-center p-6">
                    <div
                        className={cn("w-full h-full max-w-full max-h-full overflow-hidden flex items-center justify-center")}
                        style={{ transform: `scale(${userScale * baseScale})`, transformOrigin: "center center" }}
                    >
                        <div
                            className={
                                hasRealSvg
                                    ? "max-w-full max-h-full"
                                    : "w-full h-full [&_svg]:w-full [&_svg]:h-full [&_svg]:max-h-full [&_svg]:max-w-full [&_svg]:object-contain"
                            }
                            dangerouslySetInnerHTML={{ __html: content }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
