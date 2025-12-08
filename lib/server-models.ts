import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
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
        if (hostname.includes("googleapis") || hostname.includes("duckcoding")) {
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

    const trimmedBaseUrl = runtime.baseUrl.trim();
    const provider = deriveProvider(trimmedBaseUrl);
    const label = runtime.label || runtime.modelId;
    const isGemini = runtime.modelId.toLowerCase().startsWith("gemini-");
    const isOpenRouter = provider === "openrouter";

    // Special handling for Gemini models via Google-compatible endpoints (not OpenRouter)
    if (isGemini && !isOpenRouter) {
        // Google SDK expects base URL to end with /v1beta usually, or we let it handle defaults if standard.
        // For custom proxies like duckcoding, they often map to the standard Google API structure.
        // If the user provided a base URL ending in /v1 (common OpenAI style) but it's actually for Google SDK,
        // we might need to adjust or trust the user provided the correct Google-style base path if they know what they are doing.
        // However, the provided example `https://jp.duckcoding.com` suggests we might need to append `/v1beta` 
        // if the SDK doesn't do it automatically, OR the proxy handles it.
        // The SDK `createGoogleGenerativeAI` takes a `baseURL`. 
        // Let's assume the user enters the root domain or the OpenAI-compat path.
        // BUT, we are switching to native Google SDK.
        // If the user entered `https://jp.duckcoding.com/v1` (OpenAI style), stripping `/v1` might be safer if we want to target the root 
        // and let the SDK append `/models/...`. 
        // Actually, for `createGoogleGenerativeAI`, `baseURL` is the API base URL. 
        // If we use the proxy root `https://jp.duckcoding.com`, the SDK appends `/v1beta` (default) or whatever version.

        let googleBaseUrl = trimmedBaseUrl;
        // If URL ends in /v1/chat/completions or just /v1, we probably want to strip it to get the root for Google SDK
        // which constructs its own paths.
        googleBaseUrl = googleBaseUrl.replace(/\/v1\/chat\/completions\/?$/, "").replace(/\/v1\/?$/, "");

        // Ensure it ends with /v1beta if it's a known proxy that needs it, or just pass the root.
        // The Google SDK default baseURL is `https://generativelanguage.googleapis.com/v1beta`.
        // If we pass `https://jp.duckcoding.com`, it effectively replaces the host.
        // We should append `/v1beta` if the proxy expects it there.
        // Based on the curl test `https://jp.duckcoding.com/v1beta/models/...`, the base is `https://jp.duckcoding.com/v1beta`.

        if (!googleBaseUrl.endsWith("/v1beta")) {
            googleBaseUrl = googleBaseUrl.replace(/\/$/, "") + "/v1beta";
        }

        const google = createGoogleGenerativeAI({
            apiKey: runtime.apiKey,
            baseURL: googleBaseUrl,
        });

        return {
            id: runtime.modelId,
            label,
            description: undefined,
            provider,
            slug: runtime.modelId,
            model: google(runtime.modelId),
        };
    }

    // Default to OpenAI compatible client
    const normalizedBaseUrl = trimmedBaseUrl.replace(/\/$/, "");
    const client = createOpenAI({
        apiKey: runtime.apiKey,
        baseURL: normalizedBaseUrl,
    });

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
