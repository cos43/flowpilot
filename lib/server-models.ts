import { createOpenAI } from "@ai-sdk/openai";
import type { RuntimeModelConfig } from "@/types/model-config";
import type { ModelProvider } from "@/lib/model-constants";

export interface ResolvedModel {
    id: string;
    label: string;
    description?: string;
    provider: ModelProvider;
    slug: string;
    model: any;
}

const deriveProvider = (baseUrl: string): ModelProvider => {
    try {
        const hostname = new URL(baseUrl).hostname;
        if (hostname.includes("googleapis")) {
            return "google";
        }
        if (hostname.includes("openrouter")) {
            return "openrouter";
        }
        if (hostname.includes("openai")) {
            return "openai";
        }
    } catch {
        // ignore parse error
    }
    return "custom";
};

export function resolveChatModel(
    runtime?: RuntimeModelConfig
): ResolvedModel {
    if (
        !runtime ||
        !runtime.modelId ||
        !runtime.baseUrl ||
        !runtime.apiKey
    ) {
        throw new Error("模型配置缺失，请先在客户端完成接口配置。");
    }

    const normalizedBaseUrl = runtime.baseUrl.trim().replace(/\/$/, "");

    const client = createOpenAI({
        apiKey: runtime.apiKey,
        baseURL: normalizedBaseUrl,
    });

    const provider = deriveProvider(runtime.baseUrl);
    const label = runtime.label || runtime.modelId;

    return {
        id: runtime.modelId,
        label,
        description: undefined,
        provider,
        slug: runtime.modelId,
        model: client.chat(runtime.modelId),
    };
}

export const isLinkflowEndpoint = (baseUrl?: string): boolean =>
    typeof baseUrl === "string" && baseUrl.toLowerCase().includes("linkflow");

export const LINKFLOW_DEFAULT_MAX_OUTPUT_TOKENS = 64000;

export const getLinkflowOverrides = (baseUrl?: string) =>
    isLinkflowEndpoint(baseUrl)
        ? { maxOutputTokens: LINKFLOW_DEFAULT_MAX_OUTPUT_TOKENS }
        : {};

export function applyLinkflowSystemWorkaround<TMessage extends { role: string; content: any }>({
    baseUrl,
    system,
    messages,
    prompt,
}: {
    baseUrl?: string;
    system?: string;
    messages?: TMessage[];
    prompt?: string;
}): { system?: string; messages?: TMessage[]; prompt?: string } {
    if (!isLinkflowEndpoint(baseUrl) || !system) {
        return { system, messages, prompt };
    }

    const systemInstruction = `System instructions (treat as system-level, do not echo):\n${system.trim()}`;
    const systemAsUser = {
        role: "user",
        content: [{ type: "text", text: systemInstruction }],
    } as TMessage;

    if (messages && messages.length > 0) {
        return {
            system: undefined,
            messages: [systemAsUser, ...messages],
            prompt,
        };
    }

    return {
        system: undefined,
        messages,
        prompt: prompt ? `${systemInstruction}\n\n${prompt}` : systemInstruction,
    };
}
