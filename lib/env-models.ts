import { nanoid } from "nanoid";
import type { ModelEndpointConfig } from "@/types/model-config";

interface EnvModelConfig {
    modelId: string;
    label?: string;
    description?: string;
    isStreaming?: boolean;
}

interface EnvEndpointConfig {
    name: string;
    baseUrl: string;
    apiKey: string;
    models: EnvModelConfig[];
}

// 用于标记环境变量模型的特殊前缀
const ENV_MODEL_PREFIX = "__ENV__";

/**
 * 从环境变量解析默认模型配置
 * @returns 解析后的模型端点配置数组，如果解析失败返回 null
 */
export function parseDefaultModelsFromEnv(): ModelEndpointConfig[] | null {
    // 在客户端使用 NEXT_PUBLIC_ 前缀的环境变量
    const envValue = typeof window !== 'undefined'
        ? process.env.NEXT_PUBLIC_DEFAULT_MODELS
        : process.env.NEXT_PUBLIC_DEFAULT_MODELS;

    if (!envValue || envValue.trim() === "") {
        return null;
    }

    try {
        const parsed = JSON.parse(envValue) as EnvEndpointConfig[];

        if (!Array.isArray(parsed) || parsed.length === 0) {
            console.warn("NEXT_PUBLIC_DEFAULT_MODELS is not a valid array");
            return null;
        }

        const timestamp = Date.now();
        const endpoints: ModelEndpointConfig[] = [];

        for (const endpoint of parsed) {
            // 验证必填字段
            if (!endpoint.baseUrl?.trim() || !endpoint.apiKey?.trim()) {
                console.warn("Skipping endpoint with missing baseUrl or apiKey:", endpoint);
                continue;
            }

            if (!Array.isArray(endpoint.models) || endpoint.models.length === 0) {
                console.warn("Skipping endpoint with no models:", endpoint);
                continue;
            }

            const validModels = endpoint.models
                .filter((model) => model.modelId?.trim())
                .map((model) => ({
                    id: nanoid(8),
                    modelId: model.modelId.trim(),
                    label: model.label?.trim() || model.modelId.trim(),
                    description: model.description?.trim(),
                    isStreaming: model.isStreaming ?? false,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                }));

            if (validModels.length === 0) {
                console.warn("No valid models found for endpoint:", endpoint);
                continue;
            }

            // 标记为环境变量来源的端点，使用特殊 ID 前缀
            endpoints.push({
                id: `${ENV_MODEL_PREFIX}${nanoid(12)}`,
                name: endpoint.name?.trim() || "未命名",
                baseUrl: endpoint.baseUrl.trim(),
                apiKey: endpoint.apiKey.trim(),
                models: validModels.map(m => ({
                    ...m,
                    id: `${ENV_MODEL_PREFIX}${m.id}` // 模型 ID 也标记
                })),
                createdAt: timestamp,
                updatedAt: timestamp,
                isFromEnv: true, // 添加环境变量标记
            });
        }

        return endpoints.length > 0 ? endpoints : null;
    } catch (error) {
        console.error("Failed to parse NEXT_PUBLIC_DEFAULT_MODELS from env:", error);
        return null;
    }
}

/**
 * 获取默认模型配置（环境变量优先，否则使用硬编码默认值）
 */
export function getDefaultEndpoints(): ModelEndpointConfig[] {
    // 优先使用环境变量配置
    const envEndpoints = parseDefaultModelsFromEnv();
    if (envEndpoints) {
        console.log("Using NEXT_PUBLIC_DEFAULT_MODELS from environment variables");
        return envEndpoints;
    }

    // 回退到硬编码默认配置
    console.log("Using hardcoded default model configuration");
    const timestamp = Date.now();
    const defaultEndpointId = nanoid(12);
    const defaultModelId = nanoid(8);

    return [
    ];
}

/**
 * 检查端点是否来自环境变量
 */
export function isEndpointFromEnv(endpointId: string): boolean {
    return endpointId.startsWith(ENV_MODEL_PREFIX);
}

/**
 * 检查模型是否来自环境变量
 */
export function isModelFromEnv(modelId: string): boolean {
    return modelId.startsWith(ENV_MODEL_PREFIX);
}

/**
 * 过滤掉环境变量端点，只返回用户配置的端点
 */
export function filterUserEndpoints(endpoints: ModelEndpointConfig[]): ModelEndpointConfig[] {
    return endpoints.filter(endpoint => !isEndpointFromEnv(endpoint.id));
}

/**
 * 获取仅来自环境变量的端点
 */
export function getEnvOnlyEndpoints(endpoints: ModelEndpointConfig[]): ModelEndpointConfig[] {
    return endpoints.filter(endpoint => isEndpointFromEnv(endpoint.id));
}
