"use client";

import { Sparkles, Palette, PenTool } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DiagramRenderingMode } from "@/features/chat-panel/types";

interface RenderModeToggleProps {
    value: DiagramRenderingMode;
    onChange?: (mode: DiagramRenderingMode) => void;
    disabled?: boolean;
    className?: string;
    iconOnly?: boolean;
}

const MODES: Array<{
    id: DiagramRenderingMode;
    label: string;
    hint: string;
    Icon: typeof Sparkles;
}> = [
        {
            id: "svg",
            label: "SVG",
            hint: "生成高保真 SVG 预览，适合直接插入文档或导出高清图",
            Icon: Sparkles,
        },
        {
            id: "drawio",
            label: "draw.io",
            hint: "生成可编辑的 draw.io 图，便于继续细调和二次修改",
            Icon: Palette,
        },
        {
            id: "excalidraw",
            label: "Excalidraw",
            hint: "手绘风格白板，适合快速构思和草图绘制",
            Icon: PenTool,
        },
    ];

export function RenderModeToggle({
    value,
    onChange,
    disabled = false,
    className,
    iconOnly = false,
}: RenderModeToggleProps) {
    return (
        <div
            className={cn(
                "relative flex items-center gap-1.5 overflow-visible rounded-full p-1 text-[10px] font-semibold backdrop-blur-xl",
                // iOS 16 液态玻璃质感
                "bg-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.4)]",
                "border border-white/40",
                disabled && "cursor-not-allowed opacity-70",
                className
            )}
        >
            {MODES.map((mode, index) => {
                const isActive = value === mode.id;
                const Icon = mode.Icon;
                const button = (
                    <button
                        key={mode.id}
                        type="button"
                        aria-label={mode.label}
                        aria-pressed={isActive}
                        onClick={() => {
                            if (disabled) return;
                            onChange?.(mode.id);
                        }}
                        disabled={disabled}
                        className={cn(
                            "relative flex items-center py-1.5 rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-0",
                            iconOnly
                                ? "px-2.5 min-w-[32px] justify-center"
                                : "gap-1.5 px-3",
                            isActive
                                ? "bg-slate-900 text-white shadow-[0_2px_8px_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.15)] scale-[1.02]"
                                : "text-slate-700 hover:bg-white/40 active:scale-95"
                        )}
                    >
                        <Icon className={cn(
                            "transition-all",
                            iconOnly ? "h-3.5 w-3.5" : "h-3.5 w-3.5"
                        )} />
                        {!iconOnly && <span className="font-medium">{mode.label}</span>}
                    </button>
                );

                return (
                    <Tooltip key={mode.id}>
                        <TooltipTrigger asChild>{button}</TooltipTrigger>
                        <TooltipContent side="top">{mode.hint}</TooltipContent>
                    </Tooltip>
                );
            })}
        </div>
    );
}
