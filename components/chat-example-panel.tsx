import React, { type ElementType, useMemo, useState } from "react";
import {
    Compass,
    CircuitBoard,
    Flame,
    PanelsTopLeft,
    Rocket,
    Share2,
    Sparkles,
    Workflow,
    RefreshCcw,
    Palette,
    BarChart3,
    LayoutTemplate,
    Gamepad2,
    Dog,
    CreditCard
} from "lucide-react";

type ExamplePanelProps = {
    setInput: (input: string) => void;
    setFiles: (files: File[]) => void;
};

type Example = {
    name: string;
    action?: () => Promise<void>;
    prompt?: string;
};

type Category = {
    title: string;
    subtitle: string;
    accent: string;
    icon: ElementType;
    examples: Example[];
    badge?: string;
};

export default function ExamplePanel({
    setInput,
    setFiles,
}: ExamplePanelProps) {
    const [shuffleTrigger, setShuffleTrigger] = useState(0);

    const handleReplicateFlowchart = async () => {
        setInput("请帮我复刻这张流程图。");
        try {
            const response = await fetch("/example.png");
            const blob = await response.blob();
            const file = new File([blob], "example.png", { type: "image/png" });
            setFiles([file]);
        } catch (error) {
            console.error("Error loading example image:", error);
        }
    };

    const handleReplicateArchitecture = async () => {
        setInput("请使用 AWS 设计风格复刻这张架构图。");
        try {
            const response = await fetch("/architecture.png");
            const blob = await response.blob();
            const file = new File([blob], "architecture.png", { type: "image/png" });
            setFiles([file]);
        } catch (error) {
            console.error("Error loading architecture image:", error);
        }
    };

    const allCategories: Category[] = [
        {
            title: "趣味创作 · 脑洞大开",
            subtitle: "让 AI 画点好玩的东西",
            accent: "from-orange-50 via-amber-50 to-yellow-50",
            icon: Gamepad2,
            badge: "热门",
            examples: [
                { name: "画一只像素风柴犬", prompt: "请用 SVG 画一只像素风格的可爱柴犬，吐着舌头，背景是淡蓝色的天空。" },
                { name: "复古游戏 UI", prompt: "设计一个 8-bit 复古像素风的游戏主界面，包含开始游戏、设置、排行榜按钮，霓虹配色。" },
                { name: "赛博朋克名片", prompt: "设计一张赛博朋克风格的个人名片，使用高对比度霓虹色（粉/蓝），包含全息投影效果和故障艺术元素。" },
                { name: "emoji 组合画", prompt: "使用大量 emoji 表情符号拼出一幅 '蒙娜丽莎' 或 '星空' 的抽象画。" },
                { name: "手绘简笔画猫咪", prompt: "用简笔画风格画一只正在伸懒腰的猫，线条要流畅自然，带一点手绘的不规则感。" }
            ],
        },
        {
            title: "UI 组件 · 精美卡片",
            subtitle: "现代 UI 设计灵感库",
            accent: "from-blue-50 via-indigo-50 to-violet-50",
            icon: LayoutTemplate,
            examples: [
                { name: "磨砂玻璃拟态卡片", prompt: "设计一个 Glassmorphism 风格的用户资料卡片，半透明背景，模糊效果，白色边框，包含头像和社交数据。" },
                { name: "极简音乐播放器", prompt: "设计一个极简主义的音乐播放器组件，包含唱片封面、波形进度条、播放控制，阴影柔和。" },
                { name: "3D 悬浮信用卡", prompt: "画一张有 3D 透视感的信用卡，金属拉斯质感，金色芯片，凸起的卡号，带有高级感的光泽。" },
                { name: "动态天气卡片", prompt: "设计一套天气卡片（晴天/雨天/雷暴），使用渐变背景和 SVG 图标，展示温度和湿度。" },
                { name: "电商商品卡片", prompt: "设计一个电商 APP 的商品卡片，包含商品图、价格标签、折扣角标、加入购物车按钮，强调点击感。" }
            ],
        },
        {
            title: "数据可视化 · 图表",
            subtitle: "让数据展示更直观漂亮",
            accent: "from-emerald-50 via-teal-50 to-green-50",
            icon: BarChart3,
            examples: [
                { name: "环形进度仪表盘", prompt: "绘制一个带有渐变色的多重环形进度仪表盘，展示 CPU、内存、网络使用率，中心显示总负载。" },
                { name: "用户旅程桑基图", prompt: "画一个桑基图 (Sankey Diagram) 展示用户从访问官网到最终下单的流失路径，使用鲜艳的配色区分流量分支。" },
                { name: " GitHub 风格热力图", prompt: "生成一个类似于 GitHub 贡献图的日历热力图，由于深浅不一的绿色方块组成，展示一年的活跃度。" },
                { name: "雷达图/能力六边形", prompt: "绘制一个游戏角色的能力六边形雷达图，包含攻击、防御、速度、智力等维度，半透明填充区域。" }
            ],
        },
        {
            title: "架构与流程 · 专业绘图",
            subtitle: "清晰梳理复杂逻辑",
            accent: "from-slate-50 via-gray-50 to-zinc-50",
            icon: Workflow,
            examples: [
                { name: "微服务架构图", prompt: "画一个典型的微服务架构图：API Gateway -> Auth Service / User Service / Order Service -> Database / Cache，包含消息队列。" },
                { name: "Git 工作流", prompt: "绘制 Git Flow 工作流图，包含 Master, Develop, Feature, Release, Hotfix 分支，展示合并和发布流程。" },
                { name: "AWS 参考架构 (复刻)", action: handleReplicateArchitecture },
                { name: "用户登录时序图", prompt: "画一个用户登录认证的时序图 (Sequence Diagram)：Client -> API Gateway -> Auth Service -> DB，展示 Token 生成和返回过程。" }
            ],
        },
        {
            title: "创意设计 · 视觉艺术",
            subtitle: "探索 SVG 的艺术潜力",
            accent: "from-pink-50 via-rose-50 to-red-50",
            icon: Palette,
            examples: [
                { name: "孟菲斯风格海报", prompt: "设计一张孟菲斯风格 (Memphis) 的海报背景，使用明亮的几何形状（三角形、波浪线、圆点）随机分布。" },
                { name: "包豪斯几何构成", prompt: "生成一幅包豪斯风格的几何构成画，使用红黄蓝三原色，简单的圆形、方形、线条组合，具有平衡的美感。" },
                { name: "霓虹灯招牌", prompt: "画一个发光的霓虹灯效果招牌，文字是 'OPEN' 或 'BAR'，带有闪烁的辉光效果和暗砖墙背景。" },
                { name: "Low Poly 低多边形风景", prompt: "用 Low Poly 低多边形风格画一座山脉和夕阳，使用三角形色块拼接，色彩渐变丰富。" }
            ],
        },
        {
            title: "AI & 智能体 · 前沿",
            subtitle: "Agent 工作流与协作",
            accent: "from-purple-50 via-fuchsia-50 to-violet-50",
            icon: Sparkles,
            examples: [
                { name: "多 Agent 协作模式", prompt: "绘制 LLM 多智能体协作模式图：User -> Dispatcher Agent -> [Researcher, Coder, Reviewer] -> Summerizer -> Output。" },
                { name: "RAG 检索增强流程", prompt: "画出 RAG (Retrieval-Augmented Generation) 的流程图：User Query -> Embedding -> Vector DB Search -> Context + Query -> LLM -> Answer。" },
                { name: "LangChain 链式调用", prompt: "可视化一个 LangChain 的 Chain 结构：PromptTemplate -> LLM -> OutputParser -> Tool Call -> Final Result。" }
            ],
        }
    ];

    const shuffleArray = <T,>(arr: T[]) => {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    };

    const randomizedCategories = useMemo(() => {
        // Shuffle categories first
        const shuffledCats = shuffleArray([...allCategories]);

        // Then shuffle examples within each category and pick top 3
        return shuffledCats.map((cat) => ({
            ...cat,
            examples: shuffleArray(cat.examples).slice(0, 3),
        })).slice(0, 2); // Show 2 categories as requested
    }, [shuffleTrigger]); // Re-run when shuffleTrigger changes

    const handleShuffle = () => {
        setShuffleTrigger(prev => prev + 1);
    };

    return (
        <div className="w-full sm:px-3 sm:py-4 min-w-0">
            <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6 min-w-0">
                <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-r from-[#f1f5ff] via-[#f3f2ff] to-[#edf2ff] shadow-[0_12px_40px_rgba(82,96,255,0.12)]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(124,117,255,0.12),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(86,196,255,0.14),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(255,255,255,0.7),transparent_40%)]" />
                    <div className="relative flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6">
                        <div className="space-y-3 max-w-2xl text-slate-900">

                            <h2 className="text-xl font-semibold">快速开始</h2>
                            <div className="space-y-2">
                                <p className="text-sm text-slate-600">
                                    生成后即可继续编辑或转绘，保持与整体 UI 的轻盈质感一致。
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 shadow-sm border border-white/70">
                                    <Flame className="h-3 w-3 text-amber-500" />
                                    创意/趣味
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 shadow-sm border border-white/70">
                                    <PanelsTopLeft className="h-3 w-3 text-indigo-500" />
                                    UI & 卡片
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 shadow-sm border border-white/70">
                                    <Share2 className="h-3 w-3 text-sky-500" />
                                    架构 & 图表
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 分类网格 - 改为 2x2 布局以展示更多内容(如果空间允许) 或者保持 2 列自适应 */}
                <div className="w-full flex justify-center">
                    <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-3">
                        {randomizedCategories.map((category, idx) => {
                            const Icon = category.icon;
                            return (
                                <div
                                    key={`${category.title}-${idx}`}
                                    className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white/85 backdrop-blur hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
                                >
                                    <div className={`absolute inset-0 opacity-70 bg-gradient-to-br ${category.accent}`} />
                                    <div className="relative flex h-full flex-col gap-3 p-3 sm:p-4">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/75 shadow-sm text-slate-800 flex-shrink-0">
                                                    <Icon className="h-4 w-4" />
                                                </span>
                                                {category.badge && (
                                                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 shadow-sm flex-shrink-0">
                                                        {category.badge}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-semibold text-slate-900 leading-tight line-clamp-1">{category.title}</p>
                                                <p className="text-[10px] text-slate-600 leading-snug line-clamp-1">{category.subtitle}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 flex-1">
                                            {category.examples.map((example, exIdx) => (
                                                <button
                                                    key={exIdx}
                                                    onClick={() => {
                                                        if (example.action) {
                                                            example.action();
                                                        } else if (example.prompt) {
                                                            setInput(example.prompt);
                                                        }
                                                    }}
                                                    className="w-full rounded-lg border border-transparent bg-white/60 px-2 py-1.5 text-left text-[11px] text-slate-700 transition hover:border-slate-200 hover:bg-white hover:shadow-sm line-clamp-2"
                                                >
                                                    {example.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 换一换按钮 */}
                <div className="flex justify-center -mt-2 mb-2">
                    <button
                        onClick={handleShuffle}
                        className="group inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-white hover:text-indigo-600 hover:shadow-md transition-all border border-slate-200/60"
                    >
                        <RefreshCcw className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
                        换一换
                    </button>
                </div>

                {/* 参考图片 CTA - 保持不变 */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">已有截图或旧图？</p>
                        <p className="text-xs text-slate-600">上传参考图片，模型会复刻布局并保持元素风格。</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleReplicateFlowchart}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
                        >
                            <UploadIcon />
                            上传并开始
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function UploadIcon() {
    return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
    );
}
