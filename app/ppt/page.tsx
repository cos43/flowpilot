"use client";

import { useEffect, useState } from "react";
import { WorkspaceNav } from "@/components/workspace-nav";
import { PptStudioProvider } from "@/contexts/ppt-studio-context";
import { useModelRegistry } from "@/hooks/use-model-registry";
import { ModelConfigDialog } from "@/components/model-config-dialog";
import { PptWorkspace } from "@/features/ppt-studio/components/ppt-workspace";
import { Button } from "@/components/ui/button";

function PptPageContent() {
    const {
        models,
        selectedModelKey,
        selectModel,
        endpoints,
        userEndpoints,
        saveEndpoints,
        isReady,
        hasConfiguredModels,
    } = useModelRegistry();
    const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);

    useEffect(() => {
        if (isReady && !hasConfiguredModels) {
            setIsModelDialogOpen(true);
        }
    }, [isReady, hasConfiguredModels]);

    return (
        <div className="flex min-h-screen flex-col bg-slate-50">
            <WorkspaceNav />
            <div className="flex-1">
                {!hasConfiguredModels && (
                    <div className="border-b border-amber-200 bg-amber-50/80 px-6 py-3 text-sm text-amber-800">
                        尚未配置模型接口，无法调用 FlowPilot PPT 功能。
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-3 rounded-full bg-white/70 text-amber-800 hover:text-amber-900"
                            onClick={() => setIsModelDialogOpen(true)}
                        >
                            立即配置
                        </Button>
                    </div>
                )}
                <PptWorkspace
                    models={models}
                    selectedModelKey={selectedModelKey}
                    onModelChange={selectModel}
                    onManageModels={() => setIsModelDialogOpen(true)}
                />
            </div>
            <ModelConfigDialog
                open={isModelDialogOpen}
                onOpenChange={setIsModelDialogOpen}
                endpoints={userEndpoints}
                onSave={saveEndpoints}
            />
        </div>
    );
}

export default function PptPage() {
    return (
        <PptStudioProvider>
            <PptPageContent />
        </PptStudioProvider>
    );
}
