import { generateText } from "ai";
import { applyLinkflowSystemWorkaround, getLinkflowOverrides, resolveChatModel } from "@/lib/server-models";

const systemPrompt = `You are FlowPilot Diagram Repair, a specialist that only fixes malformed draw.io XML.
You must respond with a single JSON object and nothing else. Do NOT include code fences, markdown, or raw XML outside the JSON string fields.
Expected schema:
{
  "strategy": "display" | "edit",
  "xml": "<root>...</root>",
  "edits": [
    {"search": "line", "replace": "line"}
  ],
  "notes": "short Chinese summary (<60 chars)"
}

Rules:
- Prefer "edit" when the original XML is mostly valid and only a few lines must be corrected. The edits must reference the latest working XML exactly (including indentation).
- Use "display" only when the XML is severely corrupted and needs a clean rebuild. In this mode the xml field must contain a full <root>...</root> block ready to load.
- Never wrap the JSON in \`\`\` fences.
- Never output separate \`\`\`xml blocks; the xml must be a JSON string value.`;

function buildUserPrompt({
    invalidXml,
    currentXml,
    errorContext,
}: {
    invalidXml: string;
    currentXml?: string;
    errorContext?: string;
}) {
    const sections = [
        `最新一次模型输出（疑似异常）：
"""xml
${invalidXml ?? ""}
"""`,
    ];
    if (errorContext) {
        sections.push(`运行时错误：
"""log
${errorContext}
"""`);
    }
    if (currentXml) {
        sections.push(`当前画布 XML（可用于 edit 参考）：
"""xml
${currentXml}
"""`);
    }
    return sections.join("\n\n");
}

function parseJsonBlock(text: string) {
    const match = text.match(/```json([\s\S]*?)```/i);
    const rawJson = match ? match[1] : text.trim();
    if (!rawJson) {
        throw new Error("模型未返回 JSON 结果。");
    }
    const trimmed = rawJson.trim();
    try {
        const payload = JSON.parse(trimmed);
        if (!payload || typeof payload !== "object") {
            throw new Error("无法解析模型返回内容。");
        }
        if (payload.strategy !== "display" && payload.strategy !== "edit") {
            throw new Error("JSON 缺少有效 strategy 字段。");
        }
        if (payload.strategy === "display" && typeof payload.xml !== "string") {
            throw new Error("display 策略必须返回 xml 字段。");
        }
        if (payload.strategy === "edit" && !Array.isArray(payload.edits)) {
            throw new Error("edit 策略必须返回 edits 数组。");
        }
        return payload;
    } catch (error) {
        const xmlBlockMatch =
            text.match(/```xml([\s\S]*?)```/i) ||
            text.match(/(<root[\s\S]*<\/root>)/i);
        if (xmlBlockMatch) {
            return {
                strategy: "display",
                xml: xmlBlockMatch[1].trim(),
                notes: "模型返回裸 XML，已直接套用。",
            };
        }
        throw error;
    }
}

export async function POST(req: Request) {
    try {
        const {
            invalidXml,
            currentXml,
            errorContext,
            modelRuntime,
        }: {
            invalidXml: string;
            currentXml?: string;
            errorContext?: string;
            modelRuntime?: any;
        } = await req.json();

        if (!invalidXml || invalidXml.trim().length === 0) {
            return Response.json(
                { error: "invalidXml 不能为空" },
                { status: 400 }
            );
        }
        if (!modelRuntime) {
            return Response.json(
                { error: "缺少模型配置，无法执行自动修复。" },
                { status: 400 }
            );
        }

        const resolved = resolveChatModel(modelRuntime);
        const userPrompt = buildUserPrompt({ invalidXml, currentXml, errorContext });
        const baseMessages = [
            {
                role: "user" as const,
                content: [{ type: "text" as const, text: userPrompt }],
            },
        ];
        const {
            system: systemForModel,
            messages: messagesForModel,
        } = applyLinkflowSystemWorkaround({
            baseUrl: modelRuntime.baseUrl,
            system: systemPrompt,
            messages: baseMessages,
        });
        const linkflowOverrides = getLinkflowOverrides(modelRuntime.baseUrl);
        const response = await generateText({
            model: resolved.model,
            ...(systemForModel ? { system: systemForModel } : {}),
            messages: messagesForModel ?? baseMessages,
            temperature: 0,
            ...linkflowOverrides,
        });

        const payload = parseJsonBlock(response.text);
        return Response.json({
            strategy: payload.strategy,
            xml: payload.xml,
            edits: payload.edits ?? [],
            notes: payload.notes ?? "",
        });
    } catch (error) {
        console.error("Diagram repair failed:", error);
        const message =
            error instanceof Error ? error.message : "Unknown error";
        return Response.json({ error: message }, { status: 500 });
    }
}
