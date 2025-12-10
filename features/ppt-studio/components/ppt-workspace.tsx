"use client";

import { useState } from "react";
import JSZip from "jszip";
import { AlertTriangle } from "lucide-react";
import { usePptStudio } from "@/contexts/ppt-studio-context";
import { PptStepper } from "./ppt-stepper";
import { BriefForm } from "./brief-form";
import { BlueprintEditor } from "./blueprint-editor";
import { SlideComposer } from "./slide-composer";
import { useSlideGeneration } from "../hooks/use-slide-generation";
import { requestPptBlueprint } from "../utils/api-client";
import type { RuntimeModelOption } from "@/types/model-config";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DiagramRenderingMode } from "@/features/chat-panel/types";

interface PptWorkspaceProps {
    models: RuntimeModelOption[];
    selectedModelKey?: string;
    onModelChange: (key: string) => void;
    onManageModels: () => void;
}

const sanitizeFileName = (value: string) =>
    value.replace(/[^a-zA-Z0-9\u4e00-\u9fa5-_]+/g, "-").slice(0, 60);

export function PptWorkspace({
    models,
    selectedModelKey,
    onModelChange,
    onManageModels,
}: PptWorkspaceProps) {
    const {
        step,
        setStep,
        brief,
        blueprint,
        setBlueprint,
        slideJobs,
    } = usePptStudio();
    const selectedModel = models.find((model) => model.key === selectedModelKey);
    const modelRuntime = selectedModel
        ? {
              modelId: selectedModel.modelId,
              baseUrl: selectedModel.baseUrl,
              apiKey: selectedModel.apiKey,
              label: selectedModel.label,
          }
        : undefined;

    const [isGeneratingBlueprint, setIsGeneratingBlueprint] = useState(false);
    const [blueprintError, setBlueprintError] = useState<string | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [isBundling, setIsBundling] = useState(false);
    const [isExportingPptx, setIsExportingPptx] = useState(false);
    const [renderMode, setRenderMode] = useState<DiagramRenderingMode>("drawio");

    const {
        generateSlides,
        generatePendingSlides,
        isRunning: isRendering,
    } = useSlideGeneration({
        modelRuntime,
    });

    const handleBlueprintRequest = async () => {
        if (!modelRuntime) {
            setBlueprintError("请先配置模型接口。");
            return;
        }
        setBlueprintError(null);
        setIsGeneratingBlueprint(true);
        try {
            const result = await requestPptBlueprint({
                brief,
                modelRuntime,
            });
            setBlueprint(result);
            setStep("blueprint");
            setRenderError(null);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "生成骨架失败，请稍后再试。";
            setBlueprintError(message);
        } finally {
            setIsGeneratingBlueprint(false);
        }
    };

    const handleProceedToRender = () => {
        if (!blueprint) return;
        setStep("render");
    };

    const withRenderError = async (runner: () => Promise<void>) => {
        try {
            setRenderError(null);
            await runner();
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "生成过程中出现错误。";
            setRenderError(message);
        }
    };

    const handleExportBundle = async () => {
        if (!blueprint) return;
        const readySlides = blueprint.slides.filter(
            (slide) => slideJobs[slide.id]?.result?.xml
        );
        if (readySlides.length === 0) {
            setExportError("暂未有完成的幻灯片可导出。");
            return;
        }
        setExportError(null);
        setIsBundling(true);
        try {
            const zip = new JSZip();
            readySlides.forEach((slide, index) => {
                const job = slideJobs[slide.id];
                const xml = job?.result?.xml;
                if (!xml) return;
                const filename = `${String(index + 1).padStart(2, "0")}-${sanitizeFileName(slide.title)}.drawio`;
                zip.file(filename, xml);
            });
            const blob = await zip.generateAsync({ type: "blob" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${sanitizeFileName(brief.topic || "FlowPilot")}-slides.zip`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error("Failed to export PPT bundle:", error);
            setExportError("导出失败，请重试或下载单页 XML。");
        } finally {
            setIsBundling(false);
        }
    };

    const handleExportPptx = async () => {
        if (!blueprint) return;
        const readySlides = blueprint.slides.filter(
            (slide) => slideJobs[slide.id]?.result?.xml
        );
        if (readySlides.length === 0) {
            setExportError("暂未有完成的幻灯片可导出。");
            return;
        }
        setExportError(null);
        setIsExportingPptx(true);
        try {
            const response = await fetch("/api/ppt/export", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    topic: brief.topic || "FlowPilot Deck",
                    slides: readySlides.map((slide) => ({
                        id: slide.id,
                        title: slide.title,
                        bullets: slide.bullets,
                        narrative: slide.narrative,
                        xml: slideJobs[slide.id]?.result?.xml,
                    })),
                }),
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || "导出 PPTX 失败");
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${sanitizeFileName(brief.topic || "FlowPilot")}.pptx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to export PPTX:", error);
            setExportError(
                error instanceof Error ? error.message : "导出 PPTX 失败，请稍后重试。"
            );
        } finally {
            setIsExportingPptx(false);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6">
            <aside className="hidden w-[260px] lg:block">
                <PptStepper />
            </aside>
            <section className="flex-1 space-y-4 pb-8">
                {blueprintError && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-600">
                        <AlertTriangle className="mr-2 inline h-4 w-4" />
                        {blueprintError}
                    </div>
                )}
                {exportError && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-700">
                        <AlertTriangle className="mr-2 inline h-4 w-4" />
                        {exportError}
                    </div>
                )}
                {step === "brief" && (
                    <BriefForm
                        onGenerateBlueprint={handleBlueprintRequest}
                        isGenerating={isGeneratingBlueprint}
                        models={models}
                        selectedModelKey={selectedModelKey}
                        onModelChange={onModelChange}
                        onManageModels={onManageModels}
                        hasBlueprint={Boolean(blueprint)}
                    />
                )}
                {step === "blueprint" && (
                    <BlueprintEditor
                        onProceed={handleProceedToRender}
                        onRegenerate={handleBlueprintRequest}
                        isBusy={isGeneratingBlueprint}
                    />
                )}
                {step === "render" && (
                    <SlideComposer
                        onGenerateAll={() =>
                            withRenderError(() => generateSlides(undefined, renderMode))
                        }
                        onGeneratePending={() =>
                            withRenderError(() => generatePendingSlides(renderMode))
                        }
                        onGenerateSingle={(slideId) =>
                            withRenderError(() => generateSlides([slideId], renderMode))
                        }
                        isGenerating={isRendering}
                        onExportBundle={handleExportBundle}
                        onExportPptx={handleExportPptx}
                        isBundling={isBundling}
                        isExportingPptx={isExportingPptx}
                        models={models}
                        selectedModelKey={selectedModelKey}
                        onModelChange={onModelChange}
                        onManageModels={onManageModels}
                        renderError={renderError}
                        renderMode={renderMode}
                        onRenderModeChange={setRenderMode}
                    />
                )}
                {!blueprint && step !== "brief" && (
                    <Card className="border-dashed border-slate-300 bg-white/50 p-6 text-center text-sm text-slate-500">
                        当前没有可编辑的骨架，请返回第一步生成 PPT 草案。
                        <Button
                            type="button"
                            className="mt-3 rounded-full"
                            onClick={() => setStep("brief")}
                        >
                            返回资料填写
                        </Button>
                    </Card>
                )}
            </section>
        </div>
    );
}
