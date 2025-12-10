"use client";

import React, { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
// Import Excalidraw styles
import "@excalidraw/excalidraw/index.css";

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = dynamic(
    async () => (await import("@excalidraw/excalidraw")).Excalidraw,
    {
        ssr: false,
        loading: () => (
            <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        ),
    }
);

interface ExcalidrawEditorProps {
    initialData?: any;
    onChange?: (elements: any[], appState: any) => void;
}

class ExcalidrawErrorBoundary extends React.Component<React.PropsWithChildren<{}>, { hasError: boolean }> {
    constructor(props: React.PropsWithChildren<{}>) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("Excalidraw crashed:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-full w-full items-center justify-center bg-slate-50 text-slate-400 text-sm">
                    渲染组件出错，请刷新重试
                </div>
            );
        }
        return this.props.children;
    }
}

export function ExcalidrawEditor({ initialData, onChange }: ExcalidrawEditorProps) {
    const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

    console.log("[ExcalidrawEditor] Render - initialData:", initialData ? {
        elementsCount: initialData.elements?.length,
        hasAppState: !!initialData.appState
    } : "undefined");

    const sanitizeData = (data: any) => {
        if (!data) return data;
        // Deep clone to avoid mutating original
        const sanitized = { ...data };
        
        // Ensure elements is an array and filter out invalid items
        if (!Array.isArray(sanitized.elements)) {
            sanitized.elements = [];
        } else {
            // Filter out null/undefined/non-object elements
            // And ensure they have at least a 'type' property if possible
            sanitized.elements = sanitized.elements
                .filter((el: any) => {
                    if (!el || typeof el !== 'object' || Array.isArray(el)) return false;
                    if (typeof el.type !== 'string' || typeof el.id !== 'string') return false;

                    // Additional checks for specific types to prevent crashes
                    // Linear elements must have points array
                    if (['line', 'arrow', 'draw', 'freedraw'].includes(el.type)) {
                        if (!Array.isArray(el.points) || el.points.length === 0) return false;
                        // Check if points are valid [x, y] arrays
                        const arePointsValid = el.points.every((p: any) => 
                            Array.isArray(p) && 
                            p.length >= 2 && 
                            typeof p[0] === 'number' && 
                            typeof p[1] === 'number'
                        );
                        if (!arePointsValid) return false;
                    }
                    
                    // Text elements must have text string
                    if (el.type === 'text') {
                        if (typeof el.text !== 'string') return false;
                    }
                    
                    return true;
                })
                .map((el: any) => {
                    // Clone to avoid mutation and ensure defaults
                    const newEl = { ...el };
                    
                    if (!Array.isArray(newEl.groupIds)) {
                        newEl.groupIds = [];
                    }
                    
                    if (!Array.isArray(newEl.boundElements)) {
                        newEl.boundElements = [];
                    }

                    // Default common properties if missing, to prevent other potential crashes
                    if (typeof newEl.angle !== 'number') newEl.angle = 0;
                    if (typeof newEl.strokeColor !== 'string') newEl.strokeColor = "#000000";
                    if (typeof newEl.backgroundColor !== 'string') newEl.backgroundColor = "transparent";
                    if (typeof newEl.fillStyle !== 'string') newEl.fillStyle = "hachure";
                    if (typeof newEl.strokeWidth !== 'number') newEl.strokeWidth = 1;
                    if (typeof newEl.strokeStyle !== 'string') newEl.strokeStyle = "solid";
                    if (typeof newEl.roughness !== 'number') newEl.roughness = 1;
                    if (typeof newEl.opacity !== 'number') newEl.opacity = 100;
                    
                    return newEl;
                });
        }

        if (sanitized.appState) {

            // remove collaborators from appState to avoid "forEach is not a function" error

            // if it comes as a plain object/array instead of Map

            const { collaborators, ...rest } = sanitized.appState;

            sanitized.appState = rest;

        }

        return sanitized;

    };



    const isUpdatingRef = useRef(false);

    const pendingDataRef = useRef<any>(null);



    // Freeze initialData for the component prop to avoid re-initialization loops

    // We will handle all updates via updateScene API

    const [stableInitialDataProp] = useState(() => {

        const sanitized = sanitizeData(initialData);

        console.log("[ExcalidrawEditor] Initial mount - stableInitialDataProp:", sanitized);

        return sanitized;

    });



    const prevInitialDataJsonRef = useRef<string>("");

    const previousInitialDataProp = useRef(initialData);



    // Lock updates if initialData prop has changed (by reference) to prevent

    // stale onChange events from firing before useEffect has a chance to updateScene

    if (initialData !== previousInitialDataProp.current) {

        console.log("[ExcalidrawEditor] initialData prop changed (ref mismatch), locking updates");

        isUpdatingRef.current = true;

        previousInitialDataProp.current = initialData;

    }



        // 当 API 准备好时，应用待处理的数据



        useEffect(() => {



            if (excalidrawAPI && pendingDataRef.current) {



                console.log("[ExcalidrawEditor] API ready, applying pending data");



                const safeData = sanitizeData(pendingDataRef.current);



                try {



                    isUpdatingRef.current = true;



                    excalidrawAPI.updateScene({



                        elements: safeData.elements || [],



                        appState: safeData.appState || {},



                    });



                    



                    if (safeData.elements && safeData.elements.length > 0) {



                         try {



                             // Only scroll to elements with valid bounds to prevent crashes



                             const validElements = safeData.elements.filter((el: any) => 



                                typeof el.x === 'number' && !Number.isNaN(el.x) &&



                                typeof el.y === 'number' && !Number.isNaN(el.y) &&



                                typeof el.width === 'number' && !Number.isNaN(el.width) &&



                                typeof el.height === 'number' && !Number.isNaN(el.height)



                             );



                             if (validElements.length > 0) {



                                excalidrawAPI.scrollToContent(validElements, { fitToViewport: false });



                             }



                         } catch (scrollError) {



                             console.warn("scrollToContent failed during pending data apply:", scrollError);



                         }



                    }



    



                    prevInitialDataJsonRef.current = JSON.stringify(safeData);



                    setTimeout(() => {



                        isUpdatingRef.current = false;



                    }, 50);



                } catch (e) {



                    console.error("Failed to apply pending data:", e);



                    isUpdatingRef.current = false;



                }



                pendingDataRef.current = null;



            }



        }, [excalidrawAPI]);



    



        useEffect(() => {



            if (!initialData) {



                isUpdatingRef.current = false; // Release lock if no data



                return;



            }



    



            const safeData = sanitizeData(initialData);



            const currentJson = JSON.stringify(safeData);



    



            // If content hasn't changed, do NOT call updateScene



            if (currentJson === prevInitialDataJsonRef.current) {



                console.log("[ExcalidrawEditor] Data unchanged, skipping update");



                isUpdatingRef.current = false; // Release lock



                return;



            }



    



            console.log("[ExcalidrawEditor] New data detected:", {



                elementsCount: safeData.elements?.length,



                appState: safeData.appState,



                hasAPI: !!excalidrawAPI,



                hasChanged: currentJson !== prevInitialDataJsonRef.current



            });



    



            // 如果 API 还没准备好，缓存数据



            if (!excalidrawAPI) {



                console.log("[ExcalidrawEditor] API not ready, caching data for later");



                pendingDataRef.current = initialData;



                // Keep locked until API ready handles it? 



                // Actually API ready effect handles pendingDataRef.



                // We should probably keep isUpdatingRef = true to prevent onChange on the empty/loading state?



                // But if API is not ready, onChange won't fire anyway (no Excalidraw instance).



                // However, we set pendingDataRef.current, so we can release the lock or keep it.



                // Let's release it to be safe, or depend on the API ready effect.



                // Since excalidrawAPI is null, onChange prop on Excalidraw component might still be attached?



                // But the component renders 'Excalidraw' only.



                isUpdatingRef.current = false; 



                return;



            }



    



            try {



                // Prevent onChange loop



                isUpdatingRef.current = true;



    



                console.log("[ExcalidrawEditor] Calling updateScene...");



                excalidrawAPI.updateScene({



                    elements: safeData.elements || [],



                    appState: safeData.appState || {},



                });



    



                if (safeData.elements && safeData.elements.length > 0) {



                     try {



                         // Only scroll to elements with valid bounds



                         const validElements = safeData.elements.filter((el: any) => 



                            typeof el.x === 'number' && !Number.isNaN(el.x) &&



                            typeof el.y === 'number' && !Number.isNaN(el.y) &&



                            typeof el.width === 'number' && !Number.isNaN(el.width) &&



                            typeof el.height === 'number' && !Number.isNaN(el.height)



                         );



                         if (validElements.length > 0) {



                            excalidrawAPI.scrollToContent(validElements, { fitToViewport: false });



                         }



                     } catch (scrollError) {



                         console.warn("scrollToContent failed during initial data apply:", scrollError);



                     }



                }



    



                // Update cache

            prevInitialDataJsonRef.current = currentJson;



            console.log("[ExcalidrawEditor] Scene updated successfully");



            // Short timeout to allow Excalidraw to process internally without firing onChange back immediately

            setTimeout(() => {

                isUpdatingRef.current = false;

            }, 100);



        } catch (e) {

            console.error("[ExcalidrawEditor] Failed to update Excalidraw scene:", e);

            isUpdatingRef.current = false;

        }

    }, [excalidrawAPI, initialData]);



    return (

        <div className="h-full w-full relative border rounded-lg overflow-hidden bg-white">

            <ExcalidrawErrorBoundary>

                <Excalidraw

                    excalidrawAPI={(api) => {

                        console.log("[ExcalidrawEditor] API initialized:", !!api);

                        setExcalidrawAPI(api);

                    }}

                    initialData={stableInitialDataProp}

                    onChange={(elements, appState) => {

                        if (isUpdatingRef.current) {

                            console.log("[ExcalidrawEditor] onChange blocked - isUpdating");

                            return;

                        }

                        

                        // Update cache to prevent echo-back loop

                        const currentData = { elements, appState };

                        const safeData = sanitizeData(currentData);

                        prevInitialDataJsonRef.current = JSON.stringify(safeData);



                        console.log("[ExcalidrawEditor] onChange called:", {

                            elementsCount: elements?.length,

                            isUpdating: isUpdatingRef.current

                        });

                        onChange?.(elements as any[], appState);

                    }}

                    UIOptions={{

                        canvasActions: {

                            loadScene: true,

                            saveToActiveFile: false,

                            export: { saveFileToDisk: true },

                            saveAsImage: true,

                        },

                    }}

                />

            </ExcalidrawErrorBoundary>

        </div>

    );

}


