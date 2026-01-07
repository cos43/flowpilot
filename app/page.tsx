"use client";
import React, { useState, useEffect } from "react";
import { DrawIoEmbed } from "react-drawio";
import ChatPanelOptimized from "@/components/chat-panel-optimized";
import { useDiagram } from "@/contexts/diagram-context";
import { useLocale } from "@/contexts/locale-context";
import { cn } from "@/lib/utils";
import { MessageSquare, Minimize2 } from "lucide-react";
import { useDrawioDiagnostics } from "@/hooks/use-drawio-diagnostics";
import { WorkspaceNav } from "@/components/workspace-nav";
import type { DiagramRenderingMode } from "@/features/chat-panel/types";
import { SvgPreviewPane } from "@/components/svg-preview-pane";
import { ExcalidrawEditor } from "@/components/excalidraw-editor";

export default function Home() {
    const { drawioRef, handleDiagramExport, setRuntimeError, excalidrawJson, setExcalidrawJson } = useDiagram();
    const { t } = useLocale();
    const [isMobile, setIsMobile] = useState(false);
    const [drawioError, setDrawioError] = useState<string | null>(null);
    const [isDrawioLoading, setIsDrawioLoading] = useState(true);
    const [isChatVisible, setIsChatVisible] = useState(true);
    const [chatWidthPercent, setChatWidthPercent] = useState(34);
    const [isResizingChat, setIsResizingChat] = useState(false);
    const [renderMode, setRenderMode] = useState<DiagramRenderingMode>("svg");
    const resizeRafRef = React.useRef<number | null>(null);
    const pendingChatPercentRef = React.useRef(chatWidthPercent);

    // 可配置的 DrawIO baseUrl，支持环境变量或使用默认值
    // 如果 embed.diagrams.net 无法访问，可以尝试：
    // - https://app.diagrams.net (官方备用地址)
    // - 或者使用本地部署的 draw.io
    // 可配置的 DrawIO baseUrl，支持环境变量或使用默认值
    // 如果 embed.diagrams.net 无法访问，可以尝试：
    // - https://app.diagrams.net (官方备用地址)
    // - 或者使用本地部署的 draw.io
    const rawDrawioBaseUrl = process.env.NEXT_PUBLIC_DRAWIO_BASE_URL || "https://embed.diagrams.net";
    const [drawioBaseUrl, setDrawioBaseUrl] = useState(rawDrawioBaseUrl);

    useEffect(() => {
        if (rawDrawioBaseUrl.startsWith("/")) {
            setDrawioBaseUrl(window.location.origin + rawDrawioBaseUrl);
        }
    }, [rawDrawioBaseUrl]);

    useDrawioDiagnostics({
        baseUrl: drawioBaseUrl,
        onRuntimeError: (payload) => {
            if (renderMode !== "drawio") return;
            setRuntimeError(payload);
        },
        onRuntimeSignal: (event) => {
            if (renderMode !== "drawio") return;
            if (event?.event === "load") {
                setRuntimeError(null);
            }
        },
    });

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        // Check on mount
        checkMobile();

        // Add event listener for resize
        window.addEventListener("resize", checkMobile);

        // Cleanup
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // 监听 DrawIO 加载超时
    useEffect(() => {
        // 设置超时检测 - 如果 15 秒后仍未加载成功，显示错误
        const timeout = setTimeout(() => {
            if (isDrawioLoading && renderMode === "drawio") {
                setDrawioError(t("drawio.loadTimeout"));
                setIsDrawioLoading(false);
            }
        }, 15000); // 15秒超时

        return () => {
            clearTimeout(timeout);
        };
    }, [isDrawioLoading, t]);

    const handleDrawioLoad = () => {
        setIsDrawioLoading(false);
        setDrawioError(null);
    };

    const mainContentRef = React.useRef<HTMLDivElement>(null);
    const showDrawio = renderMode === "drawio";

    useEffect(() => {
        // Scroll to main content on mount to hide the top nav
        if (isMobile) return;
        if (mainContentRef.current) {
            mainContentRef.current.scrollIntoView({ behavior: "instant" });
        }
    }, [isMobile]);

    useEffect(() => {
        if (!isResizingChat) return;

        const handleMove = (event: PointerEvent) => {
            if (!mainContentRef.current || !isChatVisible) return;
            const rect = mainContentRef.current.getBoundingClientRect();
            const offsetX = event.clientX - rect.left;
            const minChatPx = 320;
            const minCanvasPx = 520;
            const clampedX = Math.min(
                Math.max(offsetX, minCanvasPx),
                rect.width - minChatPx
            );
            const nextChatPercent = ((rect.width - clampedX) / rect.width) * 100;
            const clampedPercent = Math.min(
                50,
                Math.max(26, nextChatPercent)
            );
            if (Math.abs(clampedPercent - pendingChatPercentRef.current) < 0.25) {
                return;
            }
            pendingChatPercentRef.current = clampedPercent;
            if (resizeRafRef.current === null) {
                resizeRafRef.current = window.requestAnimationFrame(() => {
                    setChatWidthPercent(pendingChatPercentRef.current);
                    resizeRafRef.current = null;
                });
            }
        };

        const handleUp = () => {
            setIsResizingChat(false);
            document.body.classList.remove("select-none");
        };

        window.addEventListener("pointermove", handleMove, { passive: true });
        window.addEventListener("pointerup", handleUp, { passive: true });
        window.addEventListener("pointercancel", handleUp, { passive: true });
        window.addEventListener("blur", handleUp);
        window.addEventListener("mouseleave", handleUp);

        return () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
            window.removeEventListener("pointercancel", handleUp);
            window.removeEventListener("blur", handleUp);
            window.removeEventListener("mouseleave", handleUp);
        };
    }, [isResizingChat, isChatVisible]);

    useEffect(() => {
        if (!isChatVisible) {
            setIsResizingChat(false);
            document.body.classList.remove("select-none");
        }
    }, [isChatVisible]);

    useEffect(() => {
        pendingChatPercentRef.current = chatWidthPercent;
    }, [chatWidthPercent]);

    useEffect(() => {
        return () => {
            if (resizeRafRef.current !== null) {
                cancelAnimationFrame(resizeRafRef.current);
            }
        };
    }, []);

    const handleResizeChatStart = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isChatVisible || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        document.body.classList.add("select-none");
        setIsResizingChat(true);
    };

    const RESIZER_WIDTH = 10;
    // 修改网格布局逻辑，始终包含聊天面板的空间，但在不可见时设置为 0
    const gridTemplateColumns = `${100 - (isChatVisible ? chatWidthPercent : 0)}fr ${isChatVisible ? RESIZER_WIDTH : 0}px ${isChatVisible ? chatWidthPercent : 0}fr`;

    const mobileContent = (
        <div className="flex min-h-screen flex-col bg-gray-100">
            <WorkspaceNav />
            <div className="flex flex-1 items-center justify-center px-6">
                <div className="text-center rounded-2xl border border-gray-200 bg-white/90 p-8 shadow-sm">
                    <h1 className="text-2xl font-semibold text-gray-800">
                        {t("workspace.mobileWarning")}
                    </h1>
                    <p className="mt-2 text-sm text-gray-500">
                        {t("workspace.mobileHint")}
                    </p>
                </div>
            </div>
        </div>
    );

    const desktopContent = (
        <section className="flex min-h-screen flex-col">
            {/* <WorkspaceNav /> */}
            <div
                ref={mainContentRef}
                className="grid h-dvh min-h-0 flex-1"
                style={{ gridTemplateColumns }}
            >
                <div className="relative flex h-full min-h-0 min-w-0 p-1">
                    <div
                        className={cn(
                            "pointer-events-none",
                            isChatVisible
                                ? "absolute right-4 top-4 z-30"
                                : "fixed right-6 top-24 z-40"
                        )}
                    >
                        <button
                            type="button"
                            aria-label={isChatVisible ? t("workspace.focusCanvas") : t("workspace.showChat")}
                            onClick={() => setIsChatVisible((prev) => !prev)}
                            className={cn(
                                "pointer-events-auto inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition",
                                isChatVisible
                                    ? "border-gray-200 bg-white/90 text-gray-700 shadow-sm hover:bg-white"
                                    : "border-blue-500 bg-blue-600 text-white shadow-lg hover:bg-blue-500/90"
                            )}
                        >
                            {isChatVisible ? (
                                <>
                                    <Minimize2 className="h-3.5 w-3.5" />
                                    {t("workspace.focusCanvas")}
                                </>
                            ) : (
                                <>
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    {t("workspace.showChat")}
                                </>
                            )}
                        </button>
                    </div>
                    {showDrawio ? (
                        drawioError ? (
                            <div className="flex items-center justify-center h-full bg-white rounded border-2 border-red-200">
                                <div className="text-center p-8 max-w-md">
                                    <h2 className="text-xl font-semibold text-red-600 mb-4">
                                        {t("drawio.loadFailed")}
                                    </h2>
                                    <p className="text-gray-700 mb-4">{drawioError}</p>
                                    <div className="text-sm text-gray-600 text-left bg-gray-50 p-4 rounded">
                                        <p className="font-semibold mb-2">{t("drawio.solutions")}</p>
                                        <ol className="list-decimal list-inside space-y-1">
                                            <li>{t("drawio.solution1")}</li>
                                            <li>{t("drawio.solution2")}</li>
                                            <li className="ml-4 font-mono text-xs bg-white p-2 rounded mt-2">
                                                NEXT_PUBLIC_DRAWIO_BASE_URL=https://app.diagrams.net
                                            </li>
                                            <li>{t("drawio.solution3")}</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            { isDrawioLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
                                    <div className="text-center">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                        <p className="text-gray-600">{t("drawio.loadingEditor")}</p>
                                    </div>
                                </div>
                            )}
                    {drawioBaseUrl.startsWith("http") && (
                        <DrawIoEmbed
                            ref={drawioRef}
                            baseUrl={drawioBaseUrl}
                            onExport={handleDiagramExport}
                            onLoad={handleDrawioLoad}
                            urlParameters={{
                                spin: true,
                                libraries: false,
                                saveAndExit: false,
                                noExitBtn: true,
                            }}
                        />
                    )}
                </>
                )
                ) : renderMode === "excalidraw" ? (
                <div className="h-full w-full bg-white">
                    <ExcalidrawEditor
                        initialData={(() => {
                            if (!excalidrawJson) {
                                console.log("[Page] No excalidrawJson, using undefined");
                                return undefined;
                            }
                            try {
                                const parsed = JSON.parse(excalidrawJson);
                                console.log("[Page] Passing initialData to ExcalidrawEditor:", {
                                    elementsCount: parsed.elements?.length,
                                    hasAppState: !!parsed.appState
                                });
                                return parsed;
                            } catch (e) {
                                console.error("[Page] Failed to parse excalidrawJson:", e);
                                return undefined;
                            }
                        })()}
                        onChange={(elements, appState) => {
                            // 只在用户实际编辑时保存，避免循环更新
                            const newJson = JSON.stringify({ elements, appState });

                            // 避免不必要的状态更新
                            if (newJson !== excalidrawJson) {
                                console.log("[Page] Excalidraw onChange - saving:", {
                                    elementsCount: elements.length,
                                    jsonLength: newJson.length
                                });
                                setExcalidrawJson(newJson);
                            } else {
                                console.log("[Page] Excalidraw onChange - no change, skipping save");
                            }
                        }}
                    />
                </div>
                ) : (
                <SvgPreviewPane />
                    )}
            </div>
            {/* 分隔器 - 始终渲染但只在可见时显示 */}
            <div
                role="separator"
                aria-orientation="vertical"
                onPointerDown={handleResizeChatStart}
                className={cn(
                    "h-full items-center justify-center border-x border-slate-100 bg-white/60 transition hover:bg-slate-100 active:bg-slate-200 cursor-col-resize",
                    isChatVisible ? "flex" : "hidden",
                    isResizingChat && "bg-blue-50 border-blue-200"
                )}
                style={{ width: isChatVisible ? RESIZER_WIDTH : 0 }}
            >
                <div className="h-10 w-1 rounded-full bg-slate-300" />
            </div>
            {/* Chat Panel - 始终渲染，通过位置控制显示 */}
            <div
                className={cn(
                    "h-full min-h-0 p-1 transition-all duration-300",
                    isChatVisible
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none"
                )}
            >
                <ChatPanelOptimized
                    onCollapse={() => setIsChatVisible(false)}
                    isCollapsible
                    renderMode={renderMode}
                    onRenderModeChange={setRenderMode}
                />
            </div>
        </div>
        </section >
    );

    return (
        <div className="bg-gray-100">
            {isMobile ? mobileContent : desktopContent}
        </div>
    );
}
