import { NextResponse } from "next/server";
import { generateText } from "ai";
import { z } from "zod";
import { applyLinkflowSystemWorkaround, getLinkflowOverrides, resolveChatModel } from "@/lib/server-models";
import { buildSvgRootXml } from "@/lib/svg";
import {
    slideBlueprintSchema,
    styleOverridesSchema,
    blueprintSchema,
} from "@/types/ppt";

const requestSchema = z.object({
    slide: slideBlueprintSchema,
    blueprintContext: z.object({
        storyArc: z.string(),
        themeGuidelines: blueprintSchema.shape.themeGuidelines,
        previousSlide: z
            .object({
                title: z.string(),
                narrative: z.string(),
                bullets: z.array(z.string()),
            })
            .nullable()
            .optional(),
        nextSlide: z
            .object({
                title: z.string(),
                narrative: z.string(),
            })
            .nullable()
            .optional(),
    }),
    styleLocks: styleOverridesSchema,
    renderMode: z.enum(["drawio", "svg"]).default("drawio").optional(),
    modelRuntime: z.object({
        modelId: z.string(),
        baseUrl: z.string(),
        apiKey: z.string(),
        label: z.string().optional(),
    }),
});

const SYSTEM_MESSAGE = `
You are a senior presentation designer for FlowPilot Studio, creating clean, professional slides using draw.io format.

GOLDEN RULES OF CLEAN SLIDE DESIGN:

1. SIMPLICITY FIRST - "Less is More"
   - ONE main idea per slide - never overcrowd
   - Maximum 3-5 bullet points or 2-3 content blocks
   - Generous white space (40-50% of canvas should be empty)
   - Simple, clean layouts - avoid complexity

2. VISUAL HIERARCHY
   - Clear title at top (28-36px, bold)
   - One focal point per slide (largest element)
   - Supporting content smaller and secondary
   - Use size, color, and position to guide eye flow

3. CANVAS & SPACING
   - Canvas: 1280×720 (16:9 ratio)
   - Margins: 60-80px from edges (generous breathing room)
   - Element spacing: 30-40px minimum between content blocks
   - Consistent alignment (left/center/right - pick one per slide)

4. CLEAN LAYOUT OPTIONS (Choose ONE per slide):
   
   SIMPLE LAYOUTS (Prefer these):
   • Title + 3-5 Bullets: Classic, clean list format
   • Title + Single Visual: One large image/diagram with caption
   • Title + 2-Column Split: Left text, right visual (or vice versa)
   • Title + Centered Quote/Stat: Large impactful number or text
   
   DATA LAYOUTS (When showing metrics):
   • Title + 2-4 KPI Cards: Simple metric boxes with numbers
   • Title + Single Chart: One clean graph with key insight
   
   PROCESS LAYOUTS (Only for workflows):
   • Title + 3-4 Step Boxes: Linear horizontal flow
   • Title + Simple Timeline: Minimal, clean progression

5. VISUAL STYLING - Keep it Clean
   - Colors: Use 2-3 from themeGuidelines palette MAX
   - Background: White or very light solid color (no busy patterns)
   - Cards/Boxes: Rounded corners (12px), subtle shadow (1-2px blur)
   - Lines: Minimal use, thin (1-2px), muted colors
   - Icons: Simple, consistent style, not too many

6. TYPOGRAPHY - Readable & Clear
   - Title: 28-36px bold
   - Body text: 16-20px regular
   - Captions: 12-14px light
   - Line height: 1.5-1.6 for readability
   - Max 2 font sizes per slide (title + body)

7. WHAT TO AVOID - Common Clutter Mistakes
   ✗ Multiple competing visual elements
   ✗ Dense text blocks (break into bullets)
   ✗ Decorative borders or frames
   ✗ Too many colors (stick to 2-3)
   ✗ Complex diagrams with many connections
   ✗ Small text crammed together
   ✗ Background patterns or textures
   ✗ More than one layout pattern per slide

8. ACCESSIBILITY
   - Text contrast: Minimum 4.5:1 (7:1 for key info)
   - Font size: Minimum 16px for body text
   - Clear hierarchy with size and weight

OUTPUT FORMAT:
XML:
<mxfile>...</mxfile>

NOTES:
- Brief explanation of layout choice
`;

const SYSTEM_MESSAGE_SVG = `
You are a senior presentation designer for FlowPilot Studio, creating clean, professional slides using SVG format.

GOLDEN RULES OF CLEAN SLIDE DESIGN:

1. SIMPLICITY FIRST
   - ONE main idea per slide
   - Maximum 3-5 content elements
   - 40-50% white space
   - Clean, uncluttered layouts

2. VISUAL HIERARCHY
   - Clear title (28-36px bold)
   - One focal point
   - Supporting elements smaller
   - Logical eye flow

3. CANVAS & SPACING
   - ViewBox: 1280×720
   - Margins: 60-80px from edges
   - Element spacing: 30-40px minimum
   - Consistent alignment

4. SIMPLE LAYOUTS (Choose ONE):
   • Title + Bullets (3-5 items)
   • Title + Single Visual
   • Title + 2-Column (text + image)
   • Title + Centered Stat/Quote
   • Title + 2-4 KPI Cards
   • Title + 3-4 Step Boxes

5. CLEAN STYLING
   - 2-3 colors maximum
   - White/light background
   - Rounded corners (12px), subtle shadows
   - Minimal lines and decorations

6. TYPOGRAPHY
   - Title: 28-36px bold
   - Body: 16-20px regular
   - Line height: 1.5-1.6

7. AVOID CLUTTER
   ✗ Multiple layouts on one slide
   ✗ Dense text
   ✗ Too many colors
   ✗ Decorative elements
   ✗ Complex diagrams

8. ACCESSIBILITY
   - Contrast: 4.5:1 minimum
   - Text: ≥16px

OUTPUT FORMAT:
SVG:
<svg viewBox="0 0 1280 720">...</svg>

NOTES:
- Layout rationale
`;

function extractPayload(text: string, mode: "drawio" | "svg"): { xml: string; notes?: string } {
    const notesSection = text.split(/NOTES:/i)[1]?.trim();
    if (mode === "svg") {
        const svgMatch = text.match(/<svg[\s\S]+<\/svg>/i);
        if (!svgMatch) {
            throw new Error("未检测到有效的 SVG 内容。");
        }
        const svg = svgMatch[0];
        const { rootXml } = buildSvgRootXml(svg);
        const mxfile = `<mxfile><diagram name="Page-1" id="page-1"><mxGraphModel>${rootXml}</mxGraphModel></diagram></mxfile>`;
        return { xml: mxfile, notes: notesSection };
    }
    const xmlMatch = text.match(/<mxfile[\s\S]+<\/mxfile>/i);
    if (!xmlMatch) {
        throw new Error("未检测到有效的 mxfile 内容。");
    }
    return { xml: xmlMatch[0], notes: notesSection };
}

export async function POST(req: Request) {
    try {
        const payload = requestSchema.parse(await req.json());
        const { slide, blueprintContext, styleLocks, renderMode = "drawio", modelRuntime } = payload;
        const resolvedModel = resolveChatModel(modelRuntime);

        const layoutGuidance = `
SLIDE DESIGN GUIDELINES:

✓ DO:
- Keep it simple - one clear message per slide
- Use generous white space (at least 40% empty)
- Choose ONE layout pattern that fits the content
- Limit to 3-5 content items maximum
- Use clear visual hierarchy (title > main content > details)
- Maintain 60-80px margins from canvas edges
- Space elements 30-40px apart minimum

✗ DON'T:
- Combine multiple layout patterns
- Cram too much information
- Use decorative elements without purpose
- Apply more than 2-3 colors
- Create dense or cluttered arrangements
- Use small text (<16px) for body content

LAYOUT SELECTION (Pick the simplest one that works):
1. Bullet List - For lists, features, key points
2. Single Visual - For showing one diagram/image
3. Two-Column - For comparison or text + visual
4. Centered Stat - For highlighting one number/quote
5. KPI Cards - For showing 2-4 metrics
6. Step Boxes - For sequential process (3-4 steps max)

Remember: Professional slides are CLEAN and SIMPLE, not fancy or complex.
`.trim();

        const userPrompt = `
Create a ${renderMode === "svg" ? "clean SVG" : "clean draw.io"} slide following minimalist design principles.

SLIDE CONTENT:
${JSON.stringify(
    {
        title: slide.title,
        narrative: slide.narrative,
        bullets: slide.bullets,
        visualIdea: slide.visualIdea,
    },
    null,
    2
)}

THEME & CONSTRAINTS:
${JSON.stringify(
    {
        palette: blueprintContext.themeGuidelines.palette,
        typography: blueprintContext.themeGuidelines.typography,
        styleLocks: styleLocks,
    },
    null,
    2
)}

${layoutGuidance}

INSTRUCTIONS:
1. Choose the SIMPLEST layout that fits this content
2. Keep generous white space - don't fill every corner
3. Use clear hierarchy: large title, medium content, small details
4. Limit colors to 2-3 from the palette
5. Ensure clean, professional appearance - avoid clutter
`;

        const {
            system: systemForModel,
            prompt: promptForModel,
        } = applyLinkflowSystemWorkaround({
            baseUrl: modelRuntime.baseUrl,
            system: renderMode === "svg" ? SYSTEM_MESSAGE_SVG : SYSTEM_MESSAGE,
            prompt: userPrompt,
        });
        const linkflowOverrides = getLinkflowOverrides(modelRuntime.baseUrl);

        const result = await generateText({
            model: resolvedModel.model,
            ...(systemForModel ? { system: systemForModel } : {}),
            prompt: promptForModel ?? userPrompt,
            temperature: 0.15,
            ...linkflowOverrides,
        });

        const { xml, notes } = extractPayload(result.text, renderMode === "svg" ? "svg" : "drawio");

        return NextResponse.json({
            result: {
                xml,
                reasoning: notes ?? "",
            },
        });
    } catch (error) {
        console.error("[ppt/render-slide] Failed:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "输入参数不合法", details: error.issues },
                { status: 400 }
            );
        }
        const message =
            error instanceof Error ? error.message : "生成幻灯片失败。";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
