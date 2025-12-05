import React, { type ElementType, useMemo } from "react";
import {
    Compass,
    CircuitBoard,
    Flame,
    PanelsTopLeft,
    Rocket,
    Share2,
    Sparkles,
    Workflow,
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

export default function ExamplePanel({
    setInput,
    setFiles,
}: ExamplePanelProps) {
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

    const categories: {
        title: string;
        subtitle: string;
        accent: string;
        icon: ElementType;
        examples: Example[];
        badge?: string;
    }[] = [
        {
            title: "战略蓝图 · 北极星到执行",
            subtitle: "把目标、关键路径、负责人一次性讲清楚",
            accent: "from-indigo-50 via-violet-50 to-blue-50",
            icon: Rocket,
            badge: "推荐",
            examples: [
                { name: "季度 OKR → 行动路线图", prompt: "请把季度 OKR 拆成可视化行动路线图：列出目标、关键结果、里程碑、责任人，并标注依赖关系与交付时间轴。" },
                { name: "增长飞轮", prompt: "绘制一张增长飞轮：获取→转化→留存→推荐→复购，标注核心指标与关键杠杆（渠道、激励、触点），突出正向循环。" },
                { name: "服务蓝图", prompt: "制作一个服务蓝图，区分前台/后台/支持层，展示用户触点、前台流程、后台支撑和技术系统，标出 SLA 与告警节点。" },
            ],
        },
        {
            title: "体验旅程 · 场景叙事",
            subtitle: "用故事线串起角色、触点、情绪与机会点",
            accent: "from-blue-50 via-cyan-50 to-slate-50",
            icon: Compass,
            examples: [
                { name: "高端会员旅程", prompt: "绘制高端会员旅程：发现→体验→购买→复购→倡导；列出情绪曲线、关键触点、补救机制和惊喜瞬间。" },
                { name: "线下门店导购", prompt: "生成线下导购旅程：进店→试用→比价→成交→售后；标注数字化触点（小程序、POS、CRM）与员工动作剧本。" },
                { name: "B2B 采购链路", prompt: "请画 B2B 采购旅程：需求提出→方案评估→招投标→合同→交付验收；区分决策人/使用者/财务的诉求与阻力点。" },
            ],
        },
        {
            title: "工程架构 · 演进与韧性",
            subtitle: "从宏观拓扑到关键链路的可演练架构",
            accent: "from-slate-50 via-slate-100 to-slate-50",
            icon: CircuitBoard,
            examples: [
                { name: "云上多活/降级方案", prompt: "绘制双活架构：入口、流量调度、应用层、数据层、缓存、消息、观测；标注故障切换、降级策略和 RTO/RPO。" },
                { name: "AWS 参考架构（复刻示例）", action: handleReplicateArchitecture },
                { name: "链路压测视图", prompt: "输出压测链路：用户请求→网关→服务→依赖→存储→外部三方；标出瓶颈、限流点、观测指标（P99/错误率）。" },
            ],
        },
        {
            title: "数据关系 · 指标/血缘/权限",
            subtitle: "一图说明指标定义、来源与下游消费",
            accent: "from-emerald-50 via-teal-50 to-lime-50",
            icon: Workflow,
            examples: [
                { name: "北极星指标拆解", prompt: "请画北极星指标拆解树：GMV → 订单量×客单价×履约率；标出数据来源表、更新频率、口径负责人。" },
                { name: "数据血缘 + 权限分层", prompt: "生成数据血缘图：埋点/ODS→DWD→DWS→ADS→应用层；标出模型依赖、数据质量校验、权限域与脱敏策略。" },
                { name: "团队指标仪表板", prompt: "设计产品/增长团队的指标仪表板布局：漏斗、留存、活跃度、用户画像、告警；给出组件摆放和配色建议。" },
            ],
        },
        {
            title: "AI 工作流 · Agent/工具链",
            subtitle: "把触发器、模型、工具、反馈闭环搭起来",
            accent: "from-purple-50 via-fuchsia-50 to-pink-50",
            icon: Sparkles,
            examples: [
                { name: "多 Agent 分工", prompt: "绘制多 Agent 协作：Planner→Researcher→Writer→Reviewer；标注技能（检索/调用 API/生成草稿）、消息总线与记忆向量库。" },
                { name: "自动化工作流", prompt: "设计一个自动化工作流：Webhook 触发→模型理解→调用内部 API→生成报告→推送 Slack/飞书；标出异常分支与重试策略。" },
                { name: "客服 Agent 智能路由", prompt: "生成客服智能路由：意图识别→FAQ→工单→人工→质检；标出触发条件、SLA、转人工阈值和情绪检测节点。" },
            ],
        },
        {
            title: "灵感草图 · 视觉/动效",
            subtitle: "把创意气质放进画布，便于后续精修",
            accent: "from-blue-50 via-indigo-50 to-slate-50",
            icon: PanelsTopLeft,
            examples: [
                { name: "手绘风信息架构", prompt: "请用手绘风生成信息架构：主页→核心路径→边缘页面；使用便签/箭头/分组，突出首屏和关键 CTA。" },
                { name: "品牌感加载动画（SVG）", prompt: "设计品牌感 SVG Loader：三层渐变圆环交错旋转、轻微模糊发光、节奏 1.2s 循环，颜色从靛蓝到薄荷绿。" },
                { name: "几何海报草图", prompt: "生成几何分层海报草图：不规则圆角块、曲线分割、网格点阵，双色渐变（冷暖对比），用作封面雏形。" },
            ],
        },
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
        const shuffled = shuffleArray(categories).map((cat) => ({
            ...cat,
            examples: shuffleArray(cat.examples).slice(0, 3),
        }));
        return shuffled.slice(0, 2);
    }, []);

    return (
        <div className="w-full sm:px-3 sm:py-4 min-w-0">
            <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6 min-w-0">
                <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-r from-[#f1f5ff] via-[#f3f2ff] to-[#edf2ff] shadow-[0_12px_40px_rgba(82,96,255,0.12)]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(124,117,255,0.12),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(86,196,255,0.14),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(255,255,255,0.7),transparent_40%)]" />
                    <div className="relative flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6">
                        <div className="space-y-3 max-w-2xl text-slate-900">
                           <h2 className="text-xl font-semibold mb-2">快速开始</h2>
                            <div className="space-y-2">

                                <p className="text-sm text-slate-600">
                                    生成后即可继续编辑或转绘，保持与整体 UI 的轻盈质感一致。
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 shadow-sm border border-white/70">
                                    <Flame className="h-3 w-3 text-amber-500" />
                                    业务/架构/流程图
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 shadow-sm border border-white/70">
                                    <PanelsTopLeft className="h-3 w-3 text-indigo-500" />
                                    svg & draw.io
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 shadow-sm border border-white/70">
                                    <Share2 className="h-3 w-3 text-sky-500" />
                                    svg 转 draw.io
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 分类两列自适应 */}
                <div className="w-full flex justify-center">
                    <div className="grid w-full  grid-cols-1 sm:grid-cols-2 gap-3">
                        {randomizedCategories.map((category, idx) => {
                            const Icon = category.icon;
                            return (
                                <div
                                    key={idx}
                                    className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white/85 backdrop-blur hover:-translate-y-0.5 hover:shadow-lg transition-all"
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
                                                <p className="text-xs font-semibold text-slate-900 leading-tight line-clamp-2">{category.title}</p>
                                                <p className="text-[10px] text-slate-600 leading-snug line-clamp-2">{category.subtitle}</p>
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
                                                    className="w-full rounded-lg border border-transparent bg-white/80 px-2 py-1.5 text-left text-[11px] text-slate-700 transition hover:border-slate-200 hover:bg-white hover:shadow-sm line-clamp-2"
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

                {/* 参考图片 CTA */}
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
    );
}
