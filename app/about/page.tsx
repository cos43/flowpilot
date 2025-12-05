"use client";

import { WorkspaceNav } from "@/components/workspace-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/contexts/locale-context";
import { Sparkles, MessageSquare, Zap, BookOpen, Users } from "lucide-react";
import Image from "next/image";

export default function AboutPage() {
    const { t } = useLocale();

    return (
        <div className="flex min-h-screen flex-col bg-gray-50">
            <WorkspaceNav />
            <div className="container mx-auto max-w-4xl px-4 py-12">
                {/* 头部 */}
                <div className="mb-12 text-center">
                    <div className="mb-4 flex items-center justify-center gap-2">
                        <Sparkles className="h-8 w-8 text-blue-600" />
                        <h1 className="text-4xl font-bold text-slate-900">FlowPilot Studio</h1>
                    </div>
                    <p className="text-lg text-slate-600">
                        {t("about.subtitle")}
                    </p>
                </div>

                {/* 核心功能 */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-blue-600" />
                            {t("about.features.title")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <h3 className="font-semibold text-slate-900">
                                    ✨ {t("about.features.aiPowered.title")}
                                </h3>
                                <p className="text-sm text-slate-600">
                                    {t("about.features.aiPowered.description")}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-semibold text-slate-900">
                                    🎨 {t("about.features.templates.title")}
                                </h3>
                                <p className="text-sm text-slate-600">
                                    {t("about.features.templates.description")}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-semibold text-slate-900">
                                    🔄 {t("about.features.converter.title")}
                                </h3>
                                <p className="text-sm text-slate-600">
                                    {t("about.features.converter.description")}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-semibold text-slate-900">
                                    📊 {t("about.features.multiMode.title")}
                                </h3>
                                <p className="text-sm text-slate-600">
                                    {t("about.features.multiMode.description")}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 快速开始 */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-blue-600" />
                            {t("about.quickStart.title")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex gap-3">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                                    1
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900">
                                        {t("about.quickStart.step1.title")}
                                    </h4>
                                    <p className="text-sm text-slate-600">
                                        {t("about.quickStart.step1.description")}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                                    2
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900">
                                        {t("about.quickStart.step2.title")}
                                    </h4>
                                    <p className="text-sm text-slate-600">
                                        {t("about.quickStart.step2.description")}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                                    3
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900">
                                        {t("about.quickStart.step3.title")}
                                    </h4>
                                    <p className="text-sm text-slate-600">
                                        {t("about.quickStart.step3.description")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 交流与反馈 */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-600" />
                            {t("about.community.title")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            <p className="text-slate-600">
                                {t("about.community.description")}
                            </p>
                            
                            {/* 微信交流群 */}
                            <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-slate-50 p-6">
                                <div className="mb-4 flex items-center gap-2">
                                    <MessageSquare className="h-5 w-5 text-violet-600" />
                                    <h3 className="font-semibold text-slate-900">
                                        {t("about.community.wechat.title")}
                                    </h3>
                                </div>
                                <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
                                    <div className="flex-1 space-y-2">
                                        <p className="text-sm text-slate-600">
                                            {t("about.community.wechat.description")}
                                        </p>
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-violet-500">
                                                {t("about.community.wechat.contactLabel")}
                                            </p>
                                            <p className="text-lg font-semibold text-slate-900">
                                                leland1999
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-center gap-2">
                                        {/* 二维码占位符 - 替换为实际二维码图片 */}
                                        <div className="flex h-40 w-40 items-center justify-center rounded-lg border-2 border-dashed border-violet-200 bg-white">
                                            <div className="text-center">
                                                <MessageSquare className="mx-auto mb-2 h-8 w-8 text-violet-300" />
                                                <p className="text-xs text-slate-400">
                                                    {t("about.community.wechat.qrPlaceholder")}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            {t("about.community.wechat.scanToAdd")}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* GitHub */}
                            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
                                <div>
                                    <h4 className="font-semibold text-slate-900">
                                        {t("about.community.github.title")}
                                    </h4>
                                    <p className="text-sm text-slate-600">
                                        {t("about.community.github.description")}
                                    </p>
                                </div>
                                <a
                                    href="https://github.com/cos43/flowpilot"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                                >
                                    {t("about.community.github.button")}
                                </a>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 页脚 */}
                <div className="mt-12 text-center text-sm text-slate-500">
                    <p>© 2024 FlowPilot Studio. {t("about.footer.rights")}</p>
                </div>
            </div>
        </div>
    );
}
