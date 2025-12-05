import type { LucideIcon } from "lucide-react";
import type { RuntimeModelConfig } from "@/types/model-config";

export type ToolPanel = "brief" | "actions" | "converter" | "starter";
export type DiagramRenderingMode = "drawio" | "svg";

export interface ToolbarActionDefinition {
    label: string;
    description: string;
    icon: LucideIcon;
}

export interface DiagramUpdateMeta {
    origin: "display" | "edit";
    modelRuntime?: RuntimeModelConfig;
    toolCallId?: string;
}

export interface DiagramResultEntry {
    xml: string;
    svg?: string;
    mode: DiagramRenderingMode;
    runtime?: RuntimeModelConfig;
}

export type ComparisonNotice = {
    type: "success" | "error";
    message: string;
};