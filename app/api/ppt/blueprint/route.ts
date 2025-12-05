import { NextResponse } from "next/server";
import { z } from "zod";
import { generateText } from "ai";
import { applyLinkflowSystemWorkaround, getLinkflowOverrides, resolveChatModel } from "@/lib/server-models";
import {
    pptBriefSchema,
    blueprintSchema,
    type PptBlueprint,
} from "@/types/ppt";

const requestSchema = z.object({
    brief: pptBriefSchema,
    modelRuntime: z.object({
        modelId: z.string(),
        baseUrl: z.string(),
        apiKey: z.string(),
        label: z.string().optional(),
    }),
});

const SYSTEM_PROMPT = `
You are a senior presentation strategist and content architect specializing in creating comprehensive, detailed slide deck blueprints.

YOUR MISSION:
Transform presentation briefs into rich, detailed blueprints that tell compelling stories with depth and substance.

CRITICAL REQUIREMENTS:

1. STORY ARCHITECTURE
   - Craft a complete narrative arc with clear progression
   - Strong opening hook that captures attention
   - Logical flow building towards key insights
   - Memorable closing with clear takeaways and call-to-action
   - Each slide must advance the story meaningfully

2. RICH SLIDE CONTENT - Be Specific and Detailed
   
   For EACH slide, provide:
   
   a) Title (8-12 words)
      - Descriptive and engaging, not generic
      - Should communicate the slide's key message
      - Examples: "3 Key Metrics Driving 40% Growth" vs "Metrics"
   
   b) Narrative (40-80 words)
      - WHY this slide matters in the overall story
      - WHAT specific insight or message it conveys
      - HOW it connects to the broader presentation goal
      - Include context, implications, or supporting rationale
      - Be concrete with examples, numbers, or scenarios when relevant
   
   c) Bullet Points (4-5 items, each 8-15 words)
      - NOT generic placeholders like "Key point 1"
      - Specific, actionable, or data-driven statements
      - Use concrete examples, metrics, or outcomes
      - Each bullet should be a complete thought
      - Examples:
         ✓ "Reduced customer onboarding time from 3 days to 4 hours"
         ✓ "Automated workflow handles 85% of routine support tickets"
         ✗ "Improved efficiency"
         ✗ "Better user experience"
   
   d) Visual Idea (20-40 words)
      - Specific visualization recommendation
      - Describe the layout, data representation, or imagery style
      - Mention key elements to highlight
      - Example: "Side-by-side comparison chart showing before/after metrics with callout boxes highlighting the 3 biggest improvements. Use progress bars for visual impact."
   
   e) Transition Note (15-30 words)
      - Explain how this slide flows from the previous one
      - Set up the logical bridge to the next topic
      - Maintain narrative continuity

3. CONTENT DEPTH GUIDELINES
   
   Opening Slides:
   - Hook with compelling problem statement or opportunity
   - Include specific context: who's affected, scale of impact
   - Use concrete examples or scenarios
   
   Body Slides:
   - Each slide should unpack ONE main idea thoroughly
   - Support claims with specific details, examples, or data points
   - Show cause-and-effect relationships
   - Explain implications and benefits
   
   Closing Slides:
   - Synthesize key insights (not just repeat titles)
   - Specific next steps or recommendations
   - Clear call-to-action with timeline or owners

4. AVOID GENERIC CONTENT
   ✗ Don't use: "Key benefits", "Main features", "Overview"
   ✓ Instead: "3 Cost Savings Averaging $50K Per Quarter", "Auto-Scheduling Reduces Meeting Conflicts by 70%"
   
   ✗ Don't use: "Bullet point 1", "Item A", "Point 1"
   ✓ Instead: Specific statements with concrete details

5. VISUAL CONSISTENCY
   - Cohesive color palette (2-3 primary + neutrals)
   - Typography hierarchy (title/body/caption sizes)
   - Consistent iconography style
   - Layout principles for clarity

6. TECHNICAL REQUIREMENTS
   - Output ONLY valid JSON matching the schema
   - No markdown formatting or explanations
   - Strictly adhere to user's slide count specification
   - All fields must be fully populated with meaningful content

QUALITY CHECKLIST:
□ Every narrative explains WHY and HOW, not just WHAT
□ Every bullet is specific and concrete
□ No generic placeholders or vague statements
□ Story flows logically from slide to slide
□ Opening hooks attention, closing drives action
□ Visual ideas are detailed and implementable
`;

function extractJsonPayload(text: string): string {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
        throw new Error("模型未返回有效 JSON。");
    }
    return text.slice(start, end + 1);
}

export async function POST(req: Request) {
    try {
        const payload = requestSchema.parse(await req.json());
        const { brief, modelRuntime } = payload;
        const resolvedModel = resolveChatModel(modelRuntime);

        const userPrompt = `
Create a comprehensive, detailed presentation blueprint based on this brief.

PRESENTATION BRIEF:
${JSON.stringify(brief, null, 2)}

CONTENT DEPTH REQUIREMENTS:

1. Make every slide RICH and SPECIFIC:
   - Narratives must explain the full context and importance (40-80 words each)
   - Bullets must be concrete and detailed (8-15 words each)
   - Visual ideas must describe exact layout and elements (20-40 words)
   - NO generic placeholders like "Key point" or "Overview"

2. Tell a COMPLETE STORY:
   - Opening: Set up the problem/opportunity with specific context
   - Middle: Develop ideas with supporting details and examples
   - Closing: Synthesize insights and provide clear next steps

3. Use SPECIFICS over GENERICS:
   - Include metrics, timelines, examples, or scenarios
   - Replace vague terms with concrete descriptions
   - Show cause-and-effect relationships

4. Ensure NARRATIVE FLOW:
   - Each slide should logically follow the previous one
   - Transition notes must explain the connection
   - Build towards a cohesive conclusion

OUTPUT: Complete JSON blueprint with ${brief.slideCount} detailed slides.
`;

        const {
            system: systemForModel,
            prompt: promptForModel,
        } = applyLinkflowSystemWorkaround({
            baseUrl: modelRuntime.baseUrl,
            system: SYSTEM_PROMPT,
            prompt: userPrompt,
        });
        const linkflowOverrides = getLinkflowOverrides(modelRuntime.baseUrl);

        const result = await generateText({
            model: resolvedModel.model,
            ...(systemForModel ? { system: systemForModel } : {}),
            prompt: promptForModel ?? userPrompt,
            temperature: 0.4,
            ...linkflowOverrides,
        });

        const raw = extractJsonPayload(result.text);
        const modelPayload = JSON.parse(raw);
        const normalized = normalizeBlueprintResponse(modelPayload, brief.slideCount);
        const parsed = blueprintSchema.parse(normalized);

        return NextResponse.json({ blueprint: parsed satisfies PptBlueprint });
    } catch (error) {
        console.error("[ppt/blueprint] Failed to generate blueprint:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "输入参数不合法", details: error.issues },
                { status: 400 }
            );
        }
        const message =
            error instanceof Error ? error.message : "生成 PPT 骨架失败。";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

const DEFAULT_THEME = {
    palette: ["#0B5CFF", "#111827", "#F4F6FB"],
    typography: "Sans-serif, 粗细对比标题，正文左对齐",
    iconography: "双色线性图标，简洁几何图形",
    layoutPrinciples: [
        "保持统一边距与栅格",
        "标题与关键信息左对齐",
        "确保所有元素在单屏内可读",
    ],
};

function coerceString(
    value: unknown,
    fallback = ""
): string {
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
        return fallback;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    if (value && typeof value === "object") {
        if ("text" in (value as any) && typeof (value as any).text === "string") {
            const trimmed = ((value as any).text as string).trim();
            return trimmed || fallback;
        }
        try {
            const candidate = JSON.stringify(value);
            return candidate.length > 0 ? candidate : fallback;
        } catch {
            return fallback;
        }
    }
    return fallback;
}

function normalizePalette(input: unknown): string[] {
    if (!Array.isArray(input)) {
        return DEFAULT_THEME.palette;
    }
    const sanitized = input
        .map((item) => coerceString(item))
        .map((token) => token.replace(/['\"]+/g, "").trim())
        .filter(Boolean);
    return sanitized.length > 0 ? sanitized : DEFAULT_THEME.palette;
}

function normalizeBullets(input: unknown): string[] {
    if (Array.isArray(input)) {
        const bullets = input
            .map((item) => coerceString(item))
            .filter(Boolean);
        if (bullets.length > 0) {
            return bullets;
        }
    }
    const fallback = coerceString(input);
    if (fallback) {
        return fallback
            .split(/[\n，,]/g)
            .map((token) => token.trim())
            .filter(Boolean);
    }
    return ["关键要点 1", "关键要点 2"];
}

function normalizeSlides(rawSlides: unknown, expectedCount: number | undefined) {
    const list = Array.isArray(rawSlides) ? rawSlides : [];
    const trimmed =
        typeof expectedCount === "number" && expectedCount > 0
            ? list.slice(0, expectedCount)
            : list;

    if (trimmed.length === 0) {
        return Array.from({ length: expectedCount ?? 6 }).map((_, index) => ({
            id: `slide-${index + 1}`,
            title: `幻灯片 ${index + 1}`,
            narrative: "描述这一页的叙事重点。",
            bullets: ["关键要点 1", "关键要点 2"],
            visualIdea: "结构化图示",
            transitionNote: "",
            status: "draft",
        }));
    }

    return trimmed.map((slide, index) => {
        const safe = slide && typeof slide === "object" ? (slide as Record<string, unknown>) : {};
        const narrative =
            coerceString(safe.narrative) ||
            coerceString((safe as any).summary) ||
            "描述这一页的叙事重点。";
        const visualIdea =
            coerceString(safe.visualIdea) ||
            coerceString((safe as any).visualConcept) ||
            "结构化图示";
        return {
            id: coerceString(safe.id, `slide-${index + 1}`) || `slide-${index + 1}`,
            title: coerceString(safe.title, `幻灯片 ${index + 1}`),
            narrative,
            bullets: normalizeBullets(safe.bullets ?? (safe as any).bulletPoints),
            visualIdea,
            transitionNote: coerceString(safe.transitionNote),
            status: "draft" as const,
        };
    });
}

function normalizeThemeGuidelines(theme: unknown) {
    if (!theme || typeof theme !== "object") {
        return DEFAULT_THEME;
    }
    const safe = theme as Record<string, unknown>;
    return {
        palette: normalizePalette(safe.palette),
        typography:
            coerceString(safe.typography) ||
            coerceString((safe as any).fontStyle) ||
            DEFAULT_THEME.typography,
        iconography:
            coerceString(safe.iconography) ||
            coerceString((safe as any).iconStyle) ||
            DEFAULT_THEME.iconography,
        layoutPrinciples:
            Array.isArray(safe.layoutPrinciples) && safe.layoutPrinciples.length > 0
                ? safe.layoutPrinciples
                      .map((item) => coerceString(item))
                      .filter(Boolean)
                : DEFAULT_THEME.layoutPrinciples,
    };
}

function normalizeBlueprintResponse(payload: any, expectedCount?: number) {
    return {
        storyArc:
            coerceString(payload?.storyArc) ||
            coerceString(payload?.narrativeArc) ||
            "从问题、解决方案到落地价值的叙事主线。",
        themeGuidelines: normalizeThemeGuidelines(payload?.themeGuidelines),
        slides: normalizeSlides(payload?.slides, expectedCount),
    };
}
