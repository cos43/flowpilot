import { useCallback, useEffect, useRef } from "react";

import { EMPTY_MXFILE } from "@/lib/diagram-templates";
import { ensureRootXml, mergeRootXml } from "@/lib/utils";
import { mergeRootPatch } from "@/lib/drawio/mergeRootPatch";
import type { RuntimeErrorPayload } from "@/types/diagram";
import type { DiagramUpdateMeta } from "../types";

interface UseDiagramOrchestratorParams {
    chartXML?: string | null;
    onDisplayChart: (xml: string) => void;
    updateActiveBranchDiagram: (xml: string | null) => void;
    runtimeError?: RuntimeErrorPayload | null;
    setRuntimeError?: (error: RuntimeErrorPayload | null) => void;
}

export function useDiagramOrchestrator({
    chartXML,
    onDisplayChart,
    updateActiveBranchDiagram,
}: UseDiagramOrchestratorParams) {
    const latestDiagramXmlRef = useRef<string>(chartXML || EMPTY_MXFILE);

    useEffect(() => {
        if (chartXML && chartXML.length > 0) {
            latestDiagramXmlRef.current = chartXML;
        }
    }, [chartXML]);

    const applyRootToCanvas = useCallback(
        (rootXml: string) => {
            const baseXml = latestDiagramXmlRef.current || chartXML || EMPTY_MXFILE;
            const merged = mergeRootXml(baseXml, rootXml);
            latestDiagramXmlRef.current = merged;
            onDisplayChart(merged);
            updateActiveBranchDiagram(merged);
            return merged;
        },
        [chartXML, onDisplayChart, updateActiveBranchDiagram]
    );

    const tryApplyRoot = useCallback(
        async (xml: string) => {
            const normalized = ensureRootXml(xml);
            applyRootToCanvas(normalized);
        },
        [applyRootToCanvas]
    );

    const applyRootPatch = useCallback(
        (patchRoot: string) => {
            const baseXml = latestDiagramXmlRef.current || chartXML || EMPTY_MXFILE;
            const merged = mergeRootPatch(baseXml, patchRoot);
            latestDiagramXmlRef.current = merged;
            onDisplayChart(merged);
            updateActiveBranchDiagram(merged);
            return merged;
        },
        [chartXML, onDisplayChart, updateActiveBranchDiagram]
    );

    const handleDiagramXml = useCallback(
        async (xml: string, _meta: DiagramUpdateMeta) => {
            await tryApplyRoot(xml);
        },
        [tryApplyRoot]
    );

    const updateLatestDiagramXml = useCallback((xml: string) => {
        latestDiagramXmlRef.current = xml;
    }, []);

    const getLatestDiagramXml = useCallback(() => {
        return latestDiagramXmlRef.current || chartXML || EMPTY_MXFILE;
    }, [chartXML]);

    return {
        handleDiagramXml,
        tryApplyRoot,
        applyRootPatch,
        updateLatestDiagramXml,
        getLatestDiagramXml,
    };
}
