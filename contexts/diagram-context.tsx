"use client";

import React, { createContext, useContext, useRef, useState, useCallback } from "react";
import type { DrawIoEmbedRef } from "react-drawio";
import { extractDiagramXML } from "../lib/utils";
import { EMPTY_MXFILE } from "@/lib/diagram-templates";
import { RuntimeErrorPayload } from "@/types/diagram";

interface DiagramContextType {
    chartXML: string;
    latestSvg: string;
    diagramHistory: { svg: string; xml: string }[];
    activeVersionIndex: number;
    loadDiagram: (chart: string) => void;
    loadDiagramImmediate: (chart: string) => void;
    handleExport: () => void;
    resolverRef: React.Ref<((value: { xml: string; svg: string }) => void) | null>;
    drawioRef: React.Ref<DrawIoEmbedRef | null>;
    handleDiagramExport: (data: any) => void;
    clearDiagram: () => void;
    restoreDiagramAt: (index: number) => void;
    fetchDiagramXml: (options?: { saveHistory?: boolean }) => Promise<string>;
    fetchDiagramData: (options?: { saveHistory?: boolean }) => Promise<{ xml: string; svg: string }>;
    runtimeError: RuntimeErrorPayload | null;
    setRuntimeError: (error: RuntimeErrorPayload | null) => void;
}

const DiagramContext = createContext<DiagramContextType | undefined>(undefined);

export function DiagramProvider({ children }: { children: React.ReactNode }) {
    const [chartXML, setChartXML] = useState<string>("");
    const [latestSvg, setLatestSvg] = useState<string>("");
    const [diagramHistory, setDiagramHistory] = useState<
        { svg: string; xml: string }[]
    >([]);
    const [activeVersionIndex, setActiveVersionIndex] = useState<number>(-1);
    const drawioRef = useRef<DrawIoEmbedRef | null>(null);
    const resolverRef = useRef<((value: { xml: string; svg: string }) => void) | null>(null);
    const saveHistoryRef = useRef<boolean>(true);
    const exportTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const loadDiagramTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [runtimeError, setRuntimeError] = useState<RuntimeErrorPayload | null>(
        null
    );

    const handleExport = () => {
        if (drawioRef.current) {
            drawioRef.current.exportDiagram({
                format: "xmlsvg",
            });
        }
    };

    // 🚀 性能优化：默认防抖；提供即时加载用于流式预览
    const loadDiagramImmediate = useCallback((chart: string) => {
        if (loadDiagramTimeoutRef.current) {
            clearTimeout(loadDiagramTimeoutRef.current);
            loadDiagramTimeoutRef.current = null;
        }
        if (drawioRef.current) {
            drawioRef.current.load({ xml: chart });
        }
    }, []);

    const loadDiagram = useCallback((chart: string) => {
        if (loadDiagramTimeoutRef.current) {
            clearTimeout(loadDiagramTimeoutRef.current);
        }

        loadDiagramTimeoutRef.current = setTimeout(() => {
            loadDiagramImmediate(chart);
        }, 1000); // 1s 防抖，减少卡顿
    }, [loadDiagramImmediate]);

    const handleDiagramExport = (data: any) => {
        const shouldSaveHistory = saveHistoryRef.current;
        saveHistoryRef.current = true;

        const extractedXML = extractDiagramXML(data.data);
        setChartXML(extractedXML);
        setLatestSvg(data.data);

        // 🔧 修复：避免保存空白或重复的版本
        // 1. 检查是否是空白画布（只有基础结构，没有实际内容）
        const isEmptyDiagram = !extractedXML ||
            extractedXML.trim() === '' ||
            extractedXML.includes('<root>') && !extractedXML.includes('mxCell id="2"');

        // 2. 检查是否与上一个版本相同
        const lastVersion = diagramHistory[diagramHistory.length - 1];
        const isDuplicate = lastVersion && lastVersion.xml === extractedXML;

        // 只有在非空且非重复的情况下才保存到历史
        if (shouldSaveHistory && !isEmptyDiagram && !isDuplicate) {
            setDiagramHistory((prev) => {
                const updated = [
                    ...prev,
                    {
                        svg: data.data,
                        xml: extractedXML,
                    },
                ];
                setActiveVersionIndex(updated.length - 1);
                return updated;
            });
        }

        if (resolverRef.current) {
            resolverRef.current({ xml: extractedXML, svg: data.data });
            resolverRef.current = null;
        }
        if (exportTimeoutRef.current) {
            clearTimeout(exportTimeoutRef.current);
            exportTimeoutRef.current = null;
        }
    };

    const clearDiagram = () => {
        loadDiagram(EMPTY_MXFILE);
        setChartXML(EMPTY_MXFILE);
        setLatestSvg("");
        setDiagramHistory([]);
        setActiveVersionIndex(-1);
    };

    const restoreDiagramAt = (index: number) => {
        const entry = diagramHistory[index];
        if (!entry) {
            return;
        }
        loadDiagram(entry.xml);
        setChartXML(entry.xml);
        setLatestSvg(entry.svg);
        setActiveVersionIndex(index);
    };

    const fetchDiagramData = (options?: { saveHistory?: boolean }) => {
        return new Promise<{ xml: string; svg: string }>((resolve, reject) => {
            if (!drawioRef.current) {
                saveHistoryRef.current = true;
                reject(new Error("DrawIO 尚未初始化，暂时无法导出画布。"));
                return;
            }
            resolverRef.current = resolve;
            saveHistoryRef.current = options?.saveHistory !== false;
            handleExport();
            if (exportTimeoutRef.current) {
                clearTimeout(exportTimeoutRef.current);
            }
            exportTimeoutRef.current = setTimeout(() => {
                if (resolverRef.current === resolve) {
                    resolverRef.current = null;
                    saveHistoryRef.current = true;
                    reject(
                        new Error(
                            "导出画布超时（10 秒无响应），请稍后重试。"
                        )
                    );
                }
            }, 10000);
        });
    };

    const fetchDiagramXml = async (options?: { saveHistory?: boolean }) => {
        const data = await fetchDiagramData(options);
        return data.xml;
    };

    return (
        <DiagramContext.Provider
            value={{
                chartXML,
                latestSvg,
                diagramHistory,
                activeVersionIndex,
                loadDiagram,
                loadDiagramImmediate,
                handleExport,
                resolverRef,
                drawioRef,
                handleDiagramExport,
                clearDiagram,
                restoreDiagramAt,
                fetchDiagramXml,
                fetchDiagramData,
                runtimeError,
                setRuntimeError,
            }}
        >
            {children}
        </DiagramContext.Provider>
    );
}

export function useDiagram() {
    const context = useContext(DiagramContext);
    if (context === undefined) {
        throw new Error("useDiagram must be used within a DiagramProvider");
    }
    return context;
}
