import type {
    PptBrief,
    PptBlueprint,
    SlideBlueprint,
    SlideJobResult,
    StyleOverrides,
} from "@/types/ppt";
import type { RuntimeModelConfig } from "@/types/model-config";
import type { DiagramRenderingMode } from "@/features/chat-panel/types";

export interface BlueprintRequestPayload {
    brief: PptBrief;
    modelRuntime: RuntimeModelConfig;
}

export interface SlideRenderContext {
    storyArc: string;
    themeGuidelines: PptBlueprint["themeGuidelines"];
    previousSlide?: {
        title: string;
        narrative: string;
        bullets: string[];
    } | null;
    nextSlide?: {
        title: string;
        narrative: string;
    } | null;
}

export interface SlideRenderPayload {
    slide: SlideBlueprint;
    blueprintContext: SlideRenderContext;
    styleLocks: StyleOverrides;
    modelRuntime: RuntimeModelConfig;
    renderMode?: DiagramRenderingMode;
}

export async function requestPptBlueprint({
    brief,
    modelRuntime,
}: BlueprintRequestPayload): Promise<PptBlueprint> {
    const response = await fetch("/api/ppt/blueprint", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            brief,
            modelRuntime,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
            errorText || "生成 PPT 骨架失败，请检查模型配置或稍后再试。"
        );
    }

    const data = await response.json();
    if (!data?.blueprint) {
        throw new Error("未返回有效的 PPT 骨架，请重试。");
    }
    return data.blueprint as PptBlueprint;
}

export async function requestSlideRender(
    payload: SlideRenderPayload
): Promise<SlideJobResult> {
    const response = await fetch("/api/ppt/render-slide", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
            errorText || "生成幻灯片内容失败，请稍后重试或更换模型。"
        );
    }
    const data = await response.json();
    if (!data?.result) {
        throw new Error("模型未返回可用的幻灯片 XML。");
    }
    return data.result as SlideJobResult;
}
