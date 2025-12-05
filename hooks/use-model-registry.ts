"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { nanoid } from "nanoid";
import {
    EndpointModelConfig,
    EndpointModelDraft,
    ModelEndpointConfig,
    ModelEndpointDraft,
    ModelRegistryState,
    RuntimeModelOption,
} from "@/types/model-config";
import { getDefaultEndpoints, filterUserEndpoints, isEndpointFromEnv } from "@/lib/env-models";

const STORAGE_KEY = "flowpilot.modelRegistry.v1";

const deriveProviderHint = (baseUrl: string): string => {
    if (!baseUrl) return "Custom Endpoint";
    try {
        const url = new URL(baseUrl);
        return url.hostname.replace(/^www\./, "");
    } catch {
        return baseUrl;
    }
};

const normalizeModel = (
    model: EndpointModelDraft,
    timestamp: number
): EndpointModelConfig | null => {
    const modelId = (model.modelId ?? "").trim();
    if (!modelId) {
        return null;
    }
    const label = (model.label ?? "").trim() || modelId;
    return {
        id: model.id && model.id.trim().length > 0 ? model.id : nanoid(8),
        modelId,
        label,
        description: model.description?.trim() || undefined,
        isStreaming: model.isStreaming ?? false, // 默认非流式
        maxDuration: model.maxDuration ?? 300, // 默认300秒
        isValidated: model.isValidated,
        validationTime: model.validationTime,
        createdAt: model.createdAt ?? timestamp,
        updatedAt: timestamp,
    };
};

const normalizeEndpoint = (
    draft: ModelEndpointDraft,
    timestamp: number
): ModelEndpointConfig | null => {
    const baseUrl = (draft.baseUrl ?? "").trim();
    const apiKey = (draft.apiKey ?? "").trim();
    if (!baseUrl || !apiKey) {
        return null;
    }

    const models = (draft.models ?? [])
        .map((model) => normalizeModel(model, timestamp))
        .filter((model): model is EndpointModelConfig => Boolean(model));

    if (models.length === 0) {
        return null;
    }

    return {
        id: draft.id && draft.id.trim().length > 0 ? draft.id : nanoid(12),
        name: (draft.name ?? "").trim() || deriveProviderHint(baseUrl),
        baseUrl,
        apiKey,
        models,
        createdAt: draft.createdAt ?? timestamp,
        updatedAt: timestamp,
    };
};

const buildModelKey = (endpointId: string, modelId: string) =>
    `${endpointId}:${modelId}`;



const determineNextSelection = (
    previousKey: string | undefined,
    endpoints: ModelEndpointConfig[]
): string | undefined => {
    if (
        previousKey &&
        endpoints.some((endpoint) =>
            endpoint.models.some(
                (model) => buildModelKey(endpoint.id, model.id) === previousKey
            )
        )
    ) {
        return previousKey;
    }
    const firstEndpoint = endpoints[0];
    if (!firstEndpoint || firstEndpoint.models.length === 0) {
        return undefined;
    }
    return buildModelKey(firstEndpoint.id, firstEndpoint.models[0].id);
};

const flattenModels = (
    endpoints: ModelEndpointConfig[]
): RuntimeModelOption[] => {
    return endpoints.flatMap((endpoint) =>
        endpoint.models.map((model) => ({
            key: buildModelKey(endpoint.id, model.id),
            modelId: model.modelId,
            label: model.label,
            baseUrl: endpoint.baseUrl,
            apiKey: endpoint.apiKey,
            endpointId: endpoint.id,
            endpointName: endpoint.name,
            providerHint: deriveProviderHint(endpoint.baseUrl),
            isStreaming: model.isStreaming ?? false, // 添加流式配置
            maxDuration: model.maxDuration ?? 300, // 添加最大请求时长配置
        }))
    );
};



// Default configuration
const createDefaultConfig = (): ModelRegistryState => {
    const endpoints = getDefaultEndpoints();
    const firstEndpoint = endpoints[0];
    const firstModel = firstEndpoint?.models[0];
    
    return {
        endpoints,
        selectedModelKey: firstEndpoint && firstModel 
            ? buildModelKey(firstEndpoint.id, firstModel.id)
            : undefined,
    };
};

type StateUpdater = (prev: ModelRegistryState) => ModelRegistryState;

export function useModelRegistry() {
    const [state, setState] = useState<ModelRegistryState>({
        endpoints: [],
        selectedModelKey: undefined,
    });
    const [isReady, setIsReady] = useState(false);

    const setAndPersist = useCallback((updater: StateUpdater) => {
        setState((prev) => {
            const next = updater(prev);
            if (typeof window !== "undefined") {
                // 只保存用户配置的端点，环境变量端点不保存到 localStorage
                const userEndpoints = filterUserEndpoints(next.endpoints);
                const persistState = {
                    endpoints: userEndpoints,
                    selectedModelKey: next.selectedModelKey,
                };
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistState));
            }
            return next;
        });
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            let initialState: ModelRegistryState;
            
            // 获取环境变量端点（总是从环境变量读取，不从 localStorage 读取）
            const envEndpoints = getDefaultEndpoints();
            
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === "object") {
                    const userEndpoints = Array.isArray(parsed.endpoints)
                        ? parsed.endpoints
                        : [];
                    
                    // 合并环境变量端点和用户端点
                    const allEndpoints = [...envEndpoints, ...userEndpoints];
                    
                    const normalizedSelection = determineNextSelection(
                        typeof parsed.selectedModelKey === "string"
                            ? parsed.selectedModelKey
                            : undefined,
                        allEndpoints
                    );
                    initialState = {
                        endpoints: allEndpoints,
                        selectedModelKey: normalizedSelection,
                    };
                    
                    setState(initialState);
                    if (initialState.selectedModelKey !== parsed.selectedModelKey) {
                        const persistState = {
                            endpoints: filterUserEndpoints(initialState.endpoints),
                            selectedModelKey: initialState.selectedModelKey,
                        };
                        window.localStorage.setItem(
                            STORAGE_KEY,
                            JSON.stringify(persistState)
                        );
                    }
                } else {
                    // Invalid format, use default config
                    initialState = {
                        endpoints: envEndpoints,
                        selectedModelKey: determineNextSelection(undefined, envEndpoints),
                    };
                    setState(initialState);
                    window.localStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify({
                            endpoints: [],
                            selectedModelKey: initialState.selectedModelKey,
                        })
                    );
                }
            } else {
                // First time use, use env endpoints only
                initialState = {
                    endpoints: envEndpoints,
                    selectedModelKey: determineNextSelection(undefined, envEndpoints),
                };
                setState(initialState);
                window.localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify({
                        endpoints: [],
                        selectedModelKey: initialState.selectedModelKey,
                    })
                );
            }
        } catch (error) {
            console.error("Failed to load model registry:", error);
            // On error, use env endpoints
            const envEndpoints = getDefaultEndpoints();
            const fallbackState = {
                endpoints: envEndpoints,
                selectedModelKey: determineNextSelection(undefined, envEndpoints),
            };
            setState(fallbackState);
            try {
                window.localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify({
                        endpoints: [],
                        selectedModelKey: fallbackState.selectedModelKey,
                    })
                );
            } catch (e) {
                console.error("Failed to save fallback state:", e);
            }
        } finally {
            setIsReady(true);
        }
    }, []);

    const models = useMemo(
        () => flattenModels(state.endpoints),
        [state.endpoints]
    );

    const selectModel = useCallback(
        (modelKey: string) => {
            if (!modelKey) return;
            const exists = models.some((model) => model.key === modelKey);
            if (!exists) {
                return;
            }
            setAndPersist((prev) => ({
                ...prev,
                selectedModelKey: modelKey,
            }));
        },
        [models, setAndPersist]
    );

    const saveEndpoints = useCallback(
        (drafts: ModelEndpointDraft[]) => {
            setAndPersist((prev) => {
                const timestamp = Date.now();
                const normalized = drafts
                    .map((draft) => normalizeEndpoint(draft, timestamp))
                    .filter(
                        (endpoint): endpoint is ModelEndpointConfig =>
                            Boolean(endpoint)
                    );
                
                // 获取环境变量端点
                const envEndpoints = getDefaultEndpoints();
                
                // 合并环境变量端点和用户配置端点
                const allEndpoints = [...envEndpoints, ...normalized];
                
                return {
                    endpoints: allEndpoints,
                    selectedModelKey: determineNextSelection(
                        prev.selectedModelKey,
                        allEndpoints
                    ),
                };
            });
        },
        [setAndPersist]
    );

    const clearRegistry = useCallback(() => {
        setAndPersist(() => {
            // 清除时保留环境变量端点
            const envEndpoints = getDefaultEndpoints();
            return {
                endpoints: envEndpoints,
                selectedModelKey: determineNextSelection(undefined, envEndpoints),
            };
        });
    }, [setAndPersist]);

    const selectedModel = useMemo(() => {
        if (!state.selectedModelKey) {
            return undefined;
        }
        return models.find((model) => model.key === state.selectedModelKey);
    }, [models, state.selectedModelKey]);

    return {
        isReady,
        hasConfiguredModels: models.length > 0,
        endpoints: state.endpoints,
        userEndpoints: filterUserEndpoints(state.endpoints), // 只返回用户配置的端点
        models,
        selectedModelKey: state.selectedModelKey,
        selectedModel,
        selectModel,
        saveEndpoints,
        clearRegistry,
    };
}
