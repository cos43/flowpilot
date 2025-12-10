"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/contexts/locale-context";

interface WorkspaceNavProps {
    className?: string;
}

export function WorkspaceNav({ className }: WorkspaceNavProps) {
    const pathname = usePathname();
    const { t } = useLocale();

    const WORKSPACES: Array<{
        id: string;
        href: string;
        label: string;
        description: string;
        icon: typeof Workflow;
        badge?: string;
    }> = [
            {
                id: "diagram",
                href: "/",
                label: t("nav.workspace"),
                description: "FlowPilot Studio",
                icon: Workflow,
            },
            {
                id: "changelog",
                href: "/changelog",
                label: "更新日志",
                description: "FlowPilot Updates",
                icon: Sparkles, // Or use History icon if imported, sticking to Sparkles or adding another import
            },
        ];

    return (
        <div
            className={cn(
                "border-b border-slate-200/70 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60",
                className
            )}
        >
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2 text font-semibold text-slate-700">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    FlowPilot Studio
                </div>
                <div className="flex items-center gap-3">
                    <nav className="flex items-center gap-2">
                        {WORKSPACES.map((workspace) => {
                            const Icon = workspace.icon;
                            const active =
                                workspace.href === "/"
                                    ? pathname === workspace.href
                                    : pathname?.startsWith(workspace.href);
                            return (
                                <Link
                                    key={workspace.id}
                                    href={workspace.href}
                                    className={cn(
                                        "group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                                        active
                                            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                            : "border-transparent bg-slate-100/70 text-slate-700 hover:border-slate-200 hover:bg-white"
                                    )}
                                >
                                    <Icon
                                        className={cn(
                                            "h-4 w-4",
                                            active ? "text-white" : "text-slate-500"
                                        )}
                                    />
                                    <span>{workspace.label}</span>
                                    {workspace.badge && (
                                        <span
                                            className={cn(
                                                "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.2em]",
                                                active
                                                    ? "bg-white/15 text-white"
                                                    : "bg-amber-100 text-amber-600"
                                            )}
                                        >
                                            {workspace.badge}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                    <LanguageSwitcher />
                </div>
            </div>
        </div>
    );
}
