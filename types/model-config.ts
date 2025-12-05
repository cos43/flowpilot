export interface EndpointModelConfig {
    id: string;
    modelId: string;
    label: string;
    description?: string;
    isStreaming?: boolean; // 该模型是否使用流式输出，默认 false
    maxDuration?: number; // 最大请求时长（秒），默认 300
    isValidated?: boolean; // 模型是否已验证通过
    validationTime?: number; // 最后验证时间
    createdAt: number;
    updatedAt: number;
}

export interface ModelEndpointConfig {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    models: EndpointModelConfig[];
    createdAt: number;
    updatedAt: number;
    isFromEnv?: boolean; // 标记是否来自环境变量
}

export interface RuntimeModelConfig {
    modelId: string;
    baseUrl: string;
    apiKey: string;
    label?: string;
    enableStreaming?: boolean; // 是否启用流式输出，默认 false
    maxDuration?: number; // 最大请求时长（秒），默认 300
}

export interface RuntimeModelOption extends RuntimeModelConfig {
    key: string;
    endpointId: string;
    endpointName: string;
    providerHint: string;
    isStreaming?: boolean; // 继承模型的流式配置
    maxDuration?: number; // 继承模型的最大请求时长配置
}

export interface ModelRegistryState {
    endpoints: ModelEndpointConfig[];
    selectedModelKey?: string;
}

export type EndpointModelDraft = Omit<EndpointModelConfig, "createdAt" | "updatedAt"> & {
    createdAt?: number;
    updatedAt?: number;
};

export type ModelEndpointDraft = Omit<ModelEndpointConfig, "createdAt" | "updatedAt" | "models"> & {
    createdAt?: number;
    updatedAt?: number;
    models: EndpointModelDraft[];
};

// 验证结果类型
export interface ModelValidationResult {
    success: boolean;
    message?: string;
    error?: string;
    details?: {
        modelId: string;
        responseTime: string;
        tokensUsed: {
            input: number;
            output: number;
            total: number;
        };
        testResponse: string;
    } | string;
    modelId?: string;
    baseUrl?: string;
}
