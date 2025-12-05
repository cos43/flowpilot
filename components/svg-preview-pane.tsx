"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
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
        const observer = new ResizeObserver(() => updateScale());
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }
        return () => observer.disconnect();
    }, [doc.width, doc.height, svgMarkup, hasRealSvg]);

    const handleZoom = useCallback((delta: number) => {
        setUserScale((prev) => {
            const next = Math.min(3, Math.max(0.4, Number((prev + delta).toFixed(2))));
            return next;
        });
    }, []);

    const content = hasRealSvg && svgMarkup ? svgMarkup : DEFAULT_WELCOME_SVG;

    return (
        <div className="relative flex h-full w-full flex-col rounded-xl bg-white">
            <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 shadow-sm">
                <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent("flowpilot:convert-svg"));
                    }}
                >
                    转绘为 draw.io 可编辑
                </button>
                <div className="h-5 w-px bg-slate-300"></div>
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
