// Comparison related shared types
import type { RuntimeModelConfig } from "@/types/model-config";

export type ComparisonResultStatus = "loading" | "ok" | "error" | "cancelled";

export interface ComparisonModelConfig {
    models: string[]; // 存储模型 key 的数组，最多 5 个
}

export interface ComparisonModelMeta {
    key: string;
    id: string;
    label: string;
    provider: string;
    slot: string; // 改为 string，支持 "A" | "B" | "C" | "D" | "E"
    runtime: RuntimeModelConfig;
}

export interface ComparisonCardResult {
    id: string;
    modelId: string;
    label: string;
    provider: string;
    slot: string; // 改为 string，支持 "A" | "B" | "C" | "D" | "E"
    status: ComparisonResultStatus;
    runtime?: RuntimeModelConfig;
    summary?: string;
    xml?: string;
    svg?: string;
    mode?: "drawio" | "svg" | "excalidraw";
    encodedXml?: string;
    previewSvg?: string;
    previewImage?: string;
    error?: string;
    branchId?: string;
    // Token 使用信息
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
    };
    durationMs?: number;
}

export interface ComparisonHistoryEntry {
    requestId: string;
    prompt: string;
    timestamp: string;
    badges: string[];
    models: ComparisonModelMeta[];
    status: "loading" | "ready" | "cancelled";
    results: ComparisonCardResult[];
    anchorMessageId?: string | null;
    adoptedResultId?: string | null;
}
