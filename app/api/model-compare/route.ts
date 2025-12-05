import { generateText } from "ai";
import { applyLinkflowSystemWorkaround, resolveChatModel } from "@/lib/server-models";
import type { RuntimeModelConfig } from "@/types/model-config";

interface ComparisonModelInput {
    id: string;
    label?: string;
    provider?: string;
    slot?: "A" | "B";
    runtime?: RuntimeModelConfig;
}

interface AttachmentInput {
    url: string;
    mediaType: string;
}

const comparisonSystemPromptXml = `You are FlowPilot 的模型对比渲染器。
你的任务是基于用户输入与当前 draw.io XML，在不依赖外部工具的情况下直接输出最新的 draw.io 图表 XML。
请严格遵守以下要求：
1. 总是返回 JSON 对象（使用 \`\`\`json 包裹），包含字段 summary（<=120 字中文描述差异点）与 xml（完整 draw.io XML 字符串）。
2. xml 字段必须以 <mxfile 开始，包含 <mxGraphModel>，并控制所有节点坐标在 0-800 × 0-600 范围内。
3. 不要添加任何额外解释、Markdown 或示例，只输出上述 JSON。`;

const comparisonSystemPromptSvg = `You are FlowPilot 的模型对比渲染器（SVG 模式）。
你的任务是基于用户输入与当前 draw.io XML，输出一份高清 SVG。
请严格遵守以下要求：
1. 总是返回 JSON 对象（使用 \`\`\`json 包裹），包含字段 summary（<=120 字中文描述差异点）与 svg（完整自包含 SVG 字符串）。如有需要，可附加 previewSvg 字段。
2. SVG 画布控制在 0-800 × 0-600 范围内，留出至少 24px 边距，元素不重叠，文字不被遮挡，无 <script> 或事件属性。
3. 不要添加任何额外解释、Markdown 或示例，只输出上述 JSON。`;

function buildUserPrompt(
    prompt: string,
    xml: string,
    brief?: string,
    renderMode: "drawio" | "svg" = "drawio"
): string {
    const sections: string[] = [];
    if (brief && brief.trim().length > 0) {
        sections.push(brief.trim());
    }
    sections.push(prompt.trim());

    return `当前图表 XML：
"""xml
${xml ?? ""}
"""

用户最新指令：
"""md
${sections.join("\n\n")}
"""

请输出 JSON（字段：summary, ${renderMode === "svg" ? "svg" : "xml"}），用于模型效果对比。`;
}

function extractJsonPayload(text: string, renderMode: "drawio" | "svg"): { summary: string; xml?: string; svg?: string; previewSvg?: string } {
    const jsonBlockMatch = text.match(/```json([\s\S]*?)```/i);
    const jsonString = jsonBlockMatch
        ? jsonBlockMatch[1]
        : text.trim().startsWith("{")
        ? text.trim()
        : "";

    if (!jsonString) {
        throw new Error("模型未返回 JSON 结果，请重试或更换模型。");
    }

    let parsed: any;
    try {
        parsed = JSON.parse(jsonString);
    } catch (error) {
        throw new Error("无法解析模型返回的 JSON 内容。");
    }

    const summary = typeof parsed.summary === "string" ? parsed.summary : "";
    const xml = typeof parsed.xml === "string" ? parsed.xml : undefined;
    const svg = typeof parsed.svg === "string" ? parsed.svg : undefined;
    const previewSvg = typeof parsed.previewSvg === "string" ? parsed.previewSvg : undefined;

    if (renderMode === "svg" && !svg) {
        throw new Error("模型返回结果缺少 svg 字段。");
    }
    if (renderMode === "drawio" && !xml) {
        throw new Error("模型返回结果缺少 xml 字段。");
    }

    return {
        summary,
        xml,
        svg,
        previewSvg,
    };
}

async function exportDiagramPreview(xml: string): Promise<{
    image?: string;
}> {
    if (!xml || xml.trim().length === 0) {
        return {};
    }
    try {
        const params = new URLSearchParams();
        params.set("format", "png");
        params.set("embedImages", "1");
        params.set("border", "0");
        params.set("base64", "1");
        params.set("spin", "0");
        params.set("scale", "1");
        params.set("w", "800");
        params.set("h", "600");
        params.set("xml", xml);

        const drawioBaseUrl = process.env.NEXT_PUBLIC_DRAWIO_BASE_URL || "https://app.diagrams.net";
        const response = await fetch(`${drawioBaseUrl}/export3`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
        });

        if (!response.ok) {
            return {};
        }
        const text = (await response.text()).trim();
        if (!text) {
            return {};
        }
        const dataUrl = text.startsWith("data:")
            ? text
            : `data:image/png;base64,${text}`;
        return { image: dataUrl };
    } catch (error) {
        console.error("Failed to export diagram preview:", error);
        return {};
    }
}

export async function POST(req: Request) {
    try {
        const {
            models,
            prompt,
            xml,
            brief,
            attachments,
            renderMode = "drawio",
        }: {
            models: Array<string | ComparisonModelInput>;
            prompt: string;
            xml: string;
            brief?: string;
            attachments?: AttachmentInput[];
            renderMode?: "drawio" | "svg";
        } = await req.json();
        
        // 获取请求的 AbortSignal，用于取消请求（节省 token）
        const abortSignal = req.signal;

        if (!prompt || prompt.trim().length === 0) {
            return Response.json(
                { error: "prompt 不能为空。" },
                { status: 400 }
            );
        }

        const normalizedModels = (Array.isArray(models) ? models : [])
            .map((item) =>
                typeof item === "string" ? { id: item } : item
            )
            .filter(
                (item): item is ComparisonModelInput =>
                    Boolean(
                        item?.id &&
                            item.id.trim().length > 0 &&
                            item?.runtime &&
                            typeof item.runtime.baseUrl === "string" &&
                            typeof item.runtime.apiKey === "string" &&
                            typeof item.runtime.modelId === "string"
                    )
            );

        if (normalizedModels.length === 0) {
            return Response.json(
                { error: "至少需要选择一个模型进行对比。" },
                { status: 400 }
            );
        }

        const mode: "drawio" | "svg" = renderMode === "svg" ? "svg" : "drawio";
        const userPrompt = buildUserPrompt(prompt, xml ?? "", brief, mode);
        const normalizedUserPrompt = userPrompt.trim();
        if (!normalizedUserPrompt) {
            return Response.json(
                { error: "生成请求缺少有效提示词内容。" },
                { status: 400 }
            );
        }
        const attachmentParts =
            attachments?.flatMap((file) =>
                file?.url && file?.mediaType
                    ? [
                          {
                              type: "image" as const,
                              image: file.url,
                              mimeType: file.mediaType,
                          },
                      ]
                    : []
            ) ?? [];

        const results = await Promise.all(
            normalizedModels.map(async (model) => {
                const startTime = Date.now();
                try {
                    if (!model.runtime) {
                        throw new Error("Model runtime is not configured");
                    }
                    const resolved = resolveChatModel(model.runtime);
                    const baseMessages = [
                        {
                            role: "user" as const,
                            content: [
                                { type: "text" as const, text: userPrompt },
                                ...attachmentParts,
                            ],
                        },
                    ];
                    const {
                        system: systemForModel,
                        messages: messagesForModel,
                    } = applyLinkflowSystemWorkaround({
                        baseUrl: model.runtime.baseUrl,
                        system: mode === "svg" ? comparisonSystemPromptSvg : comparisonSystemPromptXml,
                        messages: baseMessages,
                    });
                    const response = await generateText({
                        model: resolved.model,
                        ...(systemForModel ? { system: systemForModel } : {}),
                        messages: messagesForModel ?? baseMessages,
                        temperature: 0.1,
                        abortSignal,  // 传递 AbortSignal 以支持取消请求
                    });

                    const endTime = Date.now();
                    const durationMs = endTime - startTime;

                    const payload = extractJsonPayload(response.text, mode);
                    const preview = payload.xml ? await exportDiagramPreview(payload.xml) : {};
                    
                    // 获取 token 使用信息
                    const usage = response.usage;
                    
                    return {
                        id: resolved.id,
                        label: model.label ?? resolved.label,
                        provider: resolved.provider,
                        status: "ok" as const,
                        summary: payload.summary,
                        xml: payload.xml,
                        svg: payload.svg,
                        previewSvg: payload.previewSvg,
                        previewImage: preview.image,
                        // 添加 token 使用信息
                        usage: {
                            inputTokens: usage.inputTokens || 0,
                            outputTokens: usage.outputTokens || 0,
                            totalTokens: (usage.inputTokens || 0) + (usage.outputTokens || 0),
                        },
                        durationMs,
                    };
                } catch (error) {
                    const endTime = Date.now();
                    const durationMs = endTime - startTime;
                    const message =
                        error instanceof Error
                            ? error.message
                            : "模型调用失败";
                    return {
                        id: model.id,
                        label: model.label ?? model.id,
                        provider: "unknown" as const,
                        status: "error" as const,
                        error: message,
                        durationMs,
                    };
                }
            })
        );

        return Response.json({ results });
    } catch (error) {
        console.error("Model compare route error:", error);
        return Response.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
