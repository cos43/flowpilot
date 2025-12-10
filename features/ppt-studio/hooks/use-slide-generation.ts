"use client";

import { useCallback, useMemo, useState } from "react";
import { usePptStudio } from "@/contexts/ppt-studio-context";
import type { RuntimeModelConfig } from "@/types/model-config";
import { requestSlideRender } from "../utils/api-client";
import type { SlideBlueprint } from "@/types/ppt";
import type { DiagramRenderingMode } from "@/features/chat-panel/types";

interface UseSlideGenerationOptions {
    modelRuntime?: RuntimeModelConfig;
}

interface SlideGenerationResult {
    generateSlides: (slideIds?: string[]) => Promise<void>;
    generatePendingSlides: () => Promise<void>;
    isRunning: boolean;
    lastError: string | null;
}

export function useSlideGeneration({
    modelRuntime,
}: UseSlideGenerationOptions): {
    generatePendingSlides: (renderMode?: DiagramRenderingMode) => Promise<void>;
    lastError: string | null;
    generateSlides: (slideIds?: string[], renderMode?: DiagramRenderingMode) => Promise<void>;
    isRunning: boolean;
    runGeneration: (targets: SlideBlueprint[], renderMode?: DiagramRenderingMode) => Promise<void>
} {
    const {
        blueprint,
        slideJobs,
        updateSlideJob,
        styleLocks,
        setStep,
    } = usePptStudio();
    const [isRunning, setIsRunning] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);

    const slides = blueprint?.slides ?? [];

    const pendingSlideIds = useMemo(
        () =>
            slides
                .filter((slide) => {
                    const job = slideJobs[slide.id];
                    return !job || job.status !== "ready";
                })
                .map((slide) => slide.id),
        [slides, slideJobs]
    );

    const runGeneration = useCallback(
        async (targets: SlideBlueprint[], renderMode: DiagramRenderingMode = "drawio") => {
            if (!blueprint) {
                throw new Error("尚未生成 PPT 骨架。");
            }
            if (!modelRuntime) {
                throw new Error("请先配置可用的模型接口。");
            }
            if (targets.length === 0) {
                return;
            }

            setIsRunning(true);
            setLastError(null);
            setStep("render");

            targets.forEach((slide) =>
                updateSlideJob(slide.id, {
                    status: "queued",
                    error: undefined,
                    result: undefined,
                })
            );

            const queue = [...targets];
            const concurrency = Math.min(3, queue.length);

            const getContextForSlide = (slideId: string) => {
                const index = slides.findIndex((slide) => slide.id === slideId);
                const previous = index > 0 ? slides[index - 1] : null;
                const next = index < slides.length - 1 ? slides[index + 1] : null;
                return {
                    storyArc: blueprint.storyArc,
                    themeGuidelines: blueprint.themeGuidelines,
                    previousSlide: previous
                        ? {
                              title: previous.title,
                              narrative: previous.narrative,
                              bullets: previous.bullets,
                          }
                        : null,
                    nextSlide: next
                        ? {
                              title: next.title,
                              narrative: next.narrative,
                          }
                        : null,
                };
            };

            const runWorker = async () => {
                while (queue.length > 0) {
                    const current = queue.shift();
                    if (!current) {
                        break;
                    }
                    updateSlideJob(current.id, {
                        status: "generating",
                        startedAt: Date.now(),
                        error: undefined,
                    });
                    try {
                        const context = getContextForSlide(current.id);
                        const result = await requestSlideRender({
                            slide: current,
                            blueprintContext: context,
                            styleLocks,
                            modelRuntime,
                            renderMode,
                        });
                        updateSlideJob(current.id, {
                            status: "ready",
                            finishedAt: Date.now(),
                            error: undefined,
                            result,
                        });
                    } catch (error) {
                        const message =
                            error instanceof Error
                                ? error.message
                                : "未知错误，请稍后重试。";
                        updateSlideJob(current.id, {
                            status: "failed",
                            finishedAt: Date.now(),
                            error: message,
                        });
                        setLastError(message);
                    }
                }
            };

            const workers = Array.from({ length: concurrency }).map(() =>
                runWorker()
            );

            await Promise.all(workers);
            setIsRunning(false);
        },
        [blueprint, modelRuntime, slides, styleLocks, updateSlideJob, setStep]
    );

    const generateSlides = useCallback(
        async (slideIds?: string[], renderMode: DiagramRenderingMode = "drawio") => {
            if (!blueprint) {
                throw new Error("尚未生成 PPT 骨架。");
            }
            const targets = slideIds?.length
                ? slides.filter((slide) => slideIds.includes(slide.id))
                : slides;
            await runGeneration(targets, renderMode);
        },
        [blueprint, slides, runGeneration]
    );

    const generatePendingSlides = useCallback(async (renderMode: DiagramRenderingMode = "drawio") => {
        if (!blueprint) return;
        const targets = slides.filter((slide) =>
            pendingSlideIds.includes(slide.id)
        );
        await runGeneration(targets, renderMode);
    }, [blueprint, slides, pendingSlideIds, runGeneration]);

    return {
        generateSlides,
        generatePendingSlides,
        isRunning,
        lastError,
        runGeneration,
    };
}
