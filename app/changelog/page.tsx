import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, GitCommit, Rocket, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ChangelogEntry {
    version: string;
    date: string;
    description: string;
    changes: {
        type: "feature" | "improvement" | "fix";
        content: string;
    }[];
}

const CHANGELOG: ChangelogEntry[] = [
    {
        version: "v1.2.0",
        date: "2025-12-08",
        description: "Added support for Gemini models and enhanced SVG export capabilities.",
        changes: [
            { type: "feature", content: "Added support for Gemini models via custom endpoints (e.g., duckcoding)." },
            { type: "feature", content: "Added 'Save as PNG' and 'Save as SVG' options in the SVG Editor." },
            { type: "improvement", content: "Optimized SVG editor UI for better usability." },
        ],
    },
    {
        version: "v1.1.0",
        date: "2025-12-01",
        description: "Introduced the About page and performance optimizations.",
        changes: [
            { type: "feature", content: "Added 'About' page to providing application information." },
            { type: "improvement", content: "Improved model response parsing speed." },
            { type: "fix", content: "Fixed minor UI glitches in dark mode." },
        ],
    },
    {
        version: "v1.0.0",
        date: "2025-11-20",
        description: "Initial release of FlowPilot Studio.",
        changes: [
            { type: "feature", content: "Core diagramming capabilities with AI assistance." },
            { type: "feature", content: "Interactive chat interface for iterating on diagrams." },
            { type: "feature", content: "Export to draw.io format." },
        ],
    },
];

export default function ChangelogPage() {
    return (
        <div className="min-h-screen bg-slate-50/50">
            <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
                <div className="container mx-auto flex h-14 max-w-4xl items-center px-4">
                    <div className="mr-8 flex items-center gap-2 font-semibold text-slate-900">
                        <Rocket className="h-5 w-5 text-indigo-600" />
                        <span>FlowPilot</span>
                    </div>
                    <nav className="flex items-center space-x-6 text-sm font-medium">
                        <Link
                            href="/"
                            className="text-slate-600 transition-colors hover:text-slate-900"
                        >
                            Studio
                        </Link>
                        <span className="text-slate-900">Change Log</span>
                    </nav>
                </div>
            </header>

            <main className="container mx-auto max-w-4xl px-4 py-12">
                <div className="mb-12 text-center">
                    <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 lg:text-5xl">
                        Change Log
                    </h1>
                    <p className="text-lg text-slate-600">
                        Stay updated with the latest improvements and features.
                    </p>
                </div>

                <div className="space-y-12">
                    {CHANGELOG.map((entry, index) => (
                        <div key={entry.version} className="relative pl-8 sm:pl-32">
                            {/* Improved Timeline Line */}
                            {index !== CHANGELOG.length - 1 && (
                                <div
                                    className="absolute left-[15px] top-14 h-full w-px bg-slate-200 sm:left-[108px]"
                                    aria-hidden="true"
                                />
                            )}

                            {/* Version and Date (Desktop) */}
                            <div className="absolute left-0 top-1 hidden w-24 flex-col items-end gap-1 sm:flex">
                                <span className="font-bold text-slate-900">{entry.version}</span>
                                <time className="text-xs text-slate-500">{entry.date}</time>
                            </div>

                            {/* Mobile Version Header (Hidden on Desktop) */}
                            <div className="mb-2 flex items-center gap-3 sm:hidden">
                                <span className="font-bold text-slate-900">{entry.version}</span>
                                <span className="text-xs text-slate-500">{entry.date}</span>
                            </div>

                            {/* Timeline Dot */}
                            <div className="absolute left-[6px] top-[6px] flex h-5 w-5 items-center justify-center rounded-full border border-white bg-slate-100 ring-4 ring-white sm:left-[99px]">
                                <GitCommit className="h-3 w-3 text-slate-500" />
                            </div>

                            <Card className="border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-medium leading-relaxed text-slate-700">
                                        {entry.description}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-3">
                                        {entry.changes.map((change, i) => (
                                            <li key={i} className="flex items-start gap-3 text-sm">
                                                <div className="mt-0.5 shrink-0">
                                                    {change.type === "feature" && (
                                                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 px-1.5 py-0 text-[10px]">NEW</Badge>
                                                    )}
                                                    {change.type === "improvement" && (
                                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 px-1.5 py-0 text-[10px]">IMPROVE</Badge>
                                                    )}
                                                    {change.type === "fix" && (
                                                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 px-1.5 py-0 text-[10px]">FIX</Badge>
                                                    )}
                                                </div>
                                                <span className="text-slate-600 leading-relaxed">{change.content}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
