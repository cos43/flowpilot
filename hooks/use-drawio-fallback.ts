"use client";

import { useState, useEffect, useCallback } from "react";

interface UseDrawioFallbackOptions {
    /** 主DrawIO URL（从环境变量读取） */
    primaryUrl?: string;
    /** 备用DrawIO URL */
    fallbackUrl?: string;
    /** 加载超时时间（毫秒），默认15秒 */
    timeout?: number;
    /** 是否启用自动降级，默认true */
    enableFallback?: boolean;
    /** 当发生降级时的回调 */
    onFallback?: (from: string, to: string) => void;
}

interface UseDrawioFallbackReturn {
    /** 当前使用的DrawIO URL */
    currentUrl: string;
    /** 是否正在加载 */
    isLoading: boolean;
    /** 错误信息 */
    error: string | null;
    /** 是否已降级到备用URL */
    isFallback: boolean;
    /** 手动重试主URL */
    retryPrimary: () => void;
    /** 手动触发加载成功 */
    handleLoad: () => void;
    /** 手动触发加载失败 */
    handleError: (errorMessage?: string) => void;
}

const DEFAULT_PRIMARY_URL = "https://embed.diagrams.net";
const DEFAULT_FALLBACK_URL = "https://app.diagrams.net";
const DEFAULT_TIMEOUT = 15000; // 15秒

/**
 * DrawIO加载失败自动降级Hook
 * 
 * 功能：
 * 1. 优先使用环境变量配置的主URL
 * 2. 如果主URL加载超时或失败，自动切换到备用URL
 * 3. 支持手动重试主URL
 * 4. 提供加载状态和错误信息
 * 
 * @example
 * ```tsx
 * const { currentUrl, isLoading, error, isFallback, handleLoad } = useDrawioFallback({
 *   primaryUrl: process.env.NEXT_PUBLIC_DRAWIO_BASE_URL,
 *   fallbackUrl: "https://app.diagrams.net",
 *   timeout: 15000,
 *   onFallback: (from, to) => {
 *     console.warn(`DrawIO降级：${from} -> ${to}`);
 *   }
 * });
 * 
 * <DrawIoEmbed
 *   baseUrl={currentUrl}
 *   onLoad={handleLoad}
 * />
 * ```
 */
export function useDrawioFallback(options: UseDrawioFallbackOptions = {}): UseDrawioFallbackReturn {
    const {
        primaryUrl: initialPrimaryUrl = process.env.NEXT_PUBLIC_DRAWIO_BASE_URL || DEFAULT_PRIMARY_URL,
        fallbackUrl = DEFAULT_FALLBACK_URL,
        timeout = DEFAULT_TIMEOUT,
        enableFallback = true,
        onFallback,
    } = options;

    const [primaryUrl, setPrimaryUrl] = useState(initialPrimaryUrl);

    // State definitions
    const [currentUrl, setCurrentUrl] = useState(primaryUrl);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFallback, setIsFallback] = useState(false);
    const [hasAttemptedFallback, setHasAttemptedFallback] = useState(false);

    // Effect to handle relative URLs for primaryUrl
    useEffect(() => {
        if (initialPrimaryUrl.startsWith("/")) {
            setPrimaryUrl(window.location.origin + initialPrimaryUrl);
        }
    }, [initialPrimaryUrl]);

    // Update currentUrl when primaryUrl is resolved
    useEffect(() => {
        if (!isFallback) {
            setCurrentUrl(primaryUrl);
        }
    }, [primaryUrl, isFallback]);

    // 触发降级逻辑
    const triggerFallback = useCallback(() => {
        if (!enableFallback || hasAttemptedFallback) {
            setError("DrawIO加载失败，且备用URL也已尝试过");
            setIsLoading(false);
            return;
        }

        console.warn(`[DrawIO Fallback] 主URL加载失败: ${primaryUrl}，切换到备用URL: ${fallbackUrl}`);

        setCurrentUrl(fallbackUrl);
        setIsFallback(true);
        setHasAttemptedFallback(true);
        setError(null);
        setIsLoading(true);

        // 触发回调
        onFallback?.(primaryUrl, fallbackUrl);
    }, [enableFallback, hasAttemptedFallback, primaryUrl, fallbackUrl, onFallback]);

    // 加载超时检测
    useEffect(() => {
        if (!isLoading) {
            return;
        }

        const timer = setTimeout(() => {
            if (isLoading) {
                console.error(`[DrawIO Fallback] 加载超时 (${timeout}ms): ${currentUrl}`);

                if (!isFallback && enableFallback) {
                    triggerFallback();
                } else {
                    setError(`DrawIO加载超时（${timeout / 1000}秒）`);
                    setIsLoading(false);
                }
            }
        }, timeout);

        return () => clearTimeout(timer);
    }, [isLoading, currentUrl, isFallback, enableFallback, timeout, triggerFallback]);

    // 手动处理加载成功
    const handleLoad = useCallback(() => {
        console.log(`[DrawIO Fallback] 加载成功: ${currentUrl}${isFallback ? " (备用URL)" : ""}`);
        setIsLoading(false);
        setError(null);
    }, [currentUrl, isFallback]);

    // 手动处理加载失败
    const handleError = useCallback((errorMessage?: string) => {
        const message = errorMessage || `加载 DrawIO 失败: ${currentUrl}`;
        console.error(`[DrawIO Fallback] ${message}`);

        if (!isFallback && enableFallback) {
            triggerFallback();
        } else {
            setError(message);
            setIsLoading(false);
        }
    }, [currentUrl, isFallback, enableFallback, triggerFallback]);

    // 重试主URL
    const retryPrimary = useCallback(() => {
        console.log(`[DrawIO Fallback] 重试主URL: ${primaryUrl}`);
        setCurrentUrl(primaryUrl);
        setIsFallback(false);
        setHasAttemptedFallback(false);
        setError(null);
        setIsLoading(true);
    }, [primaryUrl]);

    return {
        currentUrl,
        isLoading,
        error,
        isFallback,
        retryPrimary,
        handleLoad,
        handleError,
    };
}
