import { streamText, convertToModelMessages, generateText, createUIMessageStreamResponse } from "ai";

import { z } from "zod/v3";
import {
  applyLinkflowSystemWorkaround,
  getLinkflowOverrides,
  isLinkflowEndpoint,
  resolveChatModel,
} from "@/lib/server-models";

// 设置默认的最大超时时间（Vercel需要静态导出）
// 实际使用时会被modelRuntime.maxDuration覆盖
export const maxDuration = 300;

export async function POST(req: Request) {
  let timeoutId: NodeJS.Timeout | undefined;
  const cleanup = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };

  try {
    const { messages, xml, modelRuntime, enableStreaming, renderMode } = await req.json();

    if (!modelRuntime) {
      return Response.json(
        { error: "Missing model runtime configuration." },
        { status: 400 }
      );
    }

    // 从模型运行时配置中获取maxDuration，默认300秒
    const requestMaxDuration = (modelRuntime.maxDuration ?? 300) * 1000; // 转换为毫秒

    const outputMode: "drawio" | "svg" | "excalidraw" =
      renderMode === "svg" ? "svg" : renderMode === "excalidraw" ? "excalidraw" : "drawio";

    // 获取请求的 AbortSignal，用于取消流式响应
    const abortSignal = req.signal;

    const drawioSystemMessage = `
You are FlowPilot, a draw.io layout lead. Respond by streaming raw draw.io XML text (no tool calls) via the display_diagram tool.
- Prefer small incremental patches as a WELL-FORMED <root>...</root> block.
- Full snapshot is also ok: <mxGraphModel><root>...</root></mxGraphModel>.
- NEVER emit partial/unclosed tags or prose.

Priorities (strict order):
1) Zero XML syntax errors.
2) Single-viewport layout with no overlaps/occlusion.
3) Preserve existing semantics.

Non-negotiable XML rules:
- Root must start with <mxCell id="0"/> then <mxCell id="1" parent="0"/>.
- Escape &, <, >, ", ' inside values.
- Styles: key=value pairs separated by semicolons; NO spaces around =; always end with a semicolon.
- Self-closing tags include space before /> .
- Every mxCell (except id="0") needs parent; every mxGeometry needs as="geometry".
- Unique numeric ids from 2 upward; never reuse.
- Edges: edge="1", source, target, mxGeometry relative="1" as="geometry", prefer edgeStyle=orthogonalEdgeStyle; add waypoints instead of crossing nodes.
`;

    const svgSystemMessage = `
You are FlowPilot SVG Studio. Output exactly one complete SVG as plain text (optionally in a fenced \`\`\`svg\`\`\` block). Do NOT use any tool calls or draw.io XML.

Rules:
- Do not emit extra prose beyond the SVG itself; streaming textual SVG is allowed but must end as a valid <svg>.`;

    const excalidrawSystemMessage = `
You are FlowPilot Excalidraw Expert. Output exactly one valid JSON object representing an Excalidraw scene, wrapped in a fenced \`\`\`json\`\`\` block.
Do NOT use any tool calls.

Priorities:
1. Valid JSON syntax (Standard Excalidraw Format).
2. Clear, hand-drawn style consistency.
3. Reasonable layout without overlaps.

Important:
- Use "arrow" type for connections. Use "startBinding" / "endBinding" to attach arrows to shapes.
- For "line", "arrow", "draw", "freedraw", the "points" array is MANDATORY (e.g. [[0,0], [50,50]]).
- Ensure all "id"s are unique strings.
- "groupIds" must be an array of strings if used.
- Do NOT output conversational text before or after the JSON block.
`;

    const systemMessage =
      outputMode === "svg" ? svgSystemMessage : outputMode === "excalidraw" ? excalidrawSystemMessage : drawioSystemMessage;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: "Missing messages payload." },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1];

    // Extract text from the last message parts
    const lastMessageText =
      lastMessage.parts?.find((part: any) => part.type === "text")?.text || "";
    const safeUserText =
      typeof lastMessageText === "string" && lastMessageText.trim().length > 0
        ? lastMessageText
        : "(用户未提供文字内容，可能仅上传了附件)";

    // Extract file parts (images) from the last message
    const fileParts = lastMessage.parts?.filter((part: any) => part.type === 'file') || [];

    const formattedTextContent = `
Current diagram XML:
"""xml
${xml || ''}
"""
User input:
"""md
${safeUserText}
"""
Render mode: ${outputMode === "svg" ? "svg-only" : "drawio-xml"}`;

    // Convert UIMessages to ModelMessages and add system message
    const modelMessages = convertToModelMessages(messages);

    const sanitizeContent = (content: any) => {
      const placeholder = "(空内容占位，防止空文本导致错误)";
      if (typeof content === "string") {
        return content.trim().length > 0 ? content : placeholder;
      }
      if (Array.isArray(content)) {
        let hasText = false;
        const mapped = content.map((part) => {
          if (part?.type === "text") {
            const txt = typeof part.text === "string" ? part.text.trim() : "";
            hasText = true;
            return {
              ...part,
              text: txt.length > 0 ? part.text : placeholder,
            };
          }
          return part;
        });
        if (!hasText) {
          mapped.push({ type: "text", text: placeholder });
        }
        return mapped;
      }
      if (content == null || content === false) {
        return placeholder;
      }
      return content;
    };

    let enhancedMessages = modelMessages.map((msg): any => {
      if ((msg as any).role === "tool") {
        return msg;
      }
      const safeContent = sanitizeContent((msg as any).content);
      return { ...(msg as any), content: safeContent };
    });

    // Update the last message with formatted content if it's a user message
    if (enhancedMessages.length >= 1) {
      const lastModelMessage = enhancedMessages[enhancedMessages.length - 1];
      if (lastModelMessage.role === 'user') {
        // Build content array with text and file parts
        const contentParts: any[] = [
          { type: 'text', text: formattedTextContent }
        ];

        // Add image parts back
        for (const filePart of fileParts) {
          contentParts.push({
            type: 'image',
            image: filePart.url,
            mimeType: filePart.mediaType
          });
        }

        enhancedMessages = [
          ...enhancedMessages.slice(0, -1),
          { ...lastModelMessage, content: contentParts }
        ];
      }
    }

    const resolvedModel = resolveChatModel(modelRuntime);
    console.log("Enhanced messages:", enhancedMessages, "model:", resolvedModel.id);
    console.log("Model runtime config:", {
      baseUrl: modelRuntime.baseUrl,
      modelId: modelRuntime.modelId,
      hasApiKey: !!modelRuntime.apiKey,
      enableStreaming: enableStreaming ?? true,
      renderMode: outputMode,
    });

    const {
      system: systemForModel,
      messages: linkflowSafeMessages,
    } = applyLinkflowSystemWorkaround({
      baseUrl: modelRuntime.baseUrl,
      system: systemMessage,
      messages: enhancedMessages,
    });
    const finalMessages = linkflowSafeMessages ?? enhancedMessages;
    const linkflowOverrides = getLinkflowOverrides(modelRuntime.baseUrl);
    const forceLinkflow = isLinkflowEndpoint(modelRuntime.baseUrl);

    // 创建带有自定义超时的 AbortController，并组合请求/超时信号
    const timeoutController = new AbortController();
    timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, requestMaxDuration);
    const originalAbortSignal = req.signal;
    const combinedAbortSignal = AbortSignal.any([originalAbortSignal, timeoutController.signal]);

    // 记录请求开始时间
    const startTime = Date.now();

    if (forceLinkflow) {
      const normalizedBaseUrl = modelRuntime.baseUrl.trim().replace(/\/$/, "");
      const linkflowStream = enableStreaming ?? true;
      const toOpenAIChatMessages = (msgs: any[]) =>
        msgs
          .map((msg) => {
            const role = msg.role === "assistant" ? "assistant" : "user";
            const contentParts = Array.isArray(msg.content)
              ? msg.content
              : [{ type: "text", text: msg.content ?? "" }];

            // 检查是否有图片内容
            const hasImage = contentParts.some((part: any) => part?.type === "image");

            if (hasImage) {
              // 使用 OpenAI vision 格式支持多模态
              const content = contentParts.map((part: any) => {
                if (part.type === "text") {
                  return {
                    type: "text",
                    text: part.text || ""
                  };
                } else if (part.type === "image") {
                  // 获取图片 URL（可能是 part.image 或 part.url）
                  const imageUrl = part.image || part.url;
                  if (!imageUrl) return null;

                  // 解析 Data URL: data:image/png;base64,iVBORw...
                  const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
                  if (!match) {
                    console.warn("无法解析图片 Data URL:", imageUrl.substring(0, 50));
                    return null;
                  }

                  // 使用 Claude/Anthropic 格式
                  return {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: match[1],
                      data: match[2]
                    }
                  };
                }
                return null;
              }).filter(Boolean);

              return { role, content };
            } else {
              // 纯文本消息，保持原有逻辑
              const text = contentParts
                .filter((part: any) => part?.type === "text" && typeof part.text === "string")
                .map((part: any) => part.text)
                .join("\n")
                .trim();
              return { role, content: text || "(empty)" };
            }
          })
          .filter((m) => {
            if (typeof m.content === "string") {
              return m.content.length > 0;
            }
            if (Array.isArray(m.content)) {
              return m.content.length > 0;
            }
            return false;
          });

      const openaiMessages = toOpenAIChatMessages(finalMessages);
      const payload = {
        model: resolvedModel.id,
        messages: openaiMessages,
        max_tokens: linkflowOverrides.maxOutputTokens ?? 4096,
        stream: linkflowStream,
        temperature: 0,
      };

      const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${modelRuntime.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: combinedAbortSignal,
      });

      if (!response.ok) {
        let json: any = {};
        try {
          json = await response.json();
        } catch {
          // ignore
        }
        console.error("Linkflow request failed:", { status: response.status, json });
        cleanup();
        return Response.json(
          { error: json?.error?.message || "Linkflow 请求失败", details: json },
          { status: response.status || 500 }
        );
      }

      if (!linkflowStream) {
        const json = await response.json().catch(() => ({}));
        cleanup();

        const choice = json?.choices?.[0] || {};
        const content = choice?.message?.content || "";
        const usage = json?.usage || {};
        const finishReason = choice?.finish_reason || "stop";

        const chunks: any[] = [];
        const messageId = `msg-${Date.now()}`;

        chunks.push({
          type: "start",
          messageId,
          messageMetadata: {
            usage: {
              inputTokens: usage.prompt_tokens || 0,
              outputTokens: usage.completion_tokens || 0,
              totalTokens: usage.total_tokens || 0,
            },
            durationMs: Date.now() - startTime,
          },
        });

        if (content && content.length > 0) {
          chunks.push({ type: "text-start", id: messageId });
          chunks.push({ type: "text-delta", id: messageId, delta: content });
          chunks.push({ type: "text-end", id: messageId });
        }

        chunks.push({
          type: "finish",
          finishReason,
          messageMetadata: {
            usage: {
              inputTokens: usage.prompt_tokens || 0,
              outputTokens: usage.completion_tokens || 0,
              totalTokens: usage.total_tokens || 0,
            },
            durationMs: Date.now() - startTime,
            finishReason,
          },
        });

        const stream = new ReadableStream({
          start(controller) {
            for (const chunk of chunks) {
              controller.enqueue(chunk);
            }
            controller.close();
          },
        });

        return createUIMessageStreamResponse({
          stream,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      // streaming path for linkflow using SSE
      const decoder = new TextDecoder();
      const reader = response.body?.getReader();
      if (!reader) {
        cleanup();
        return Response.json({ error: "Linkflow 流式响应读取失败" }, { status: 500 });
      }

      const messageId = `msg-${Date.now()}`;
      let usageStats = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };
      let finishReason = "stop";
      const captureUsage = (chunk: any) => {
        if (!chunk) return;
        const usage = chunk.usage || chunk.response?.usage || chunk.metrics;
        if (!usage) return;
        const input =
          usage.prompt_tokens ??
          usage.input_tokens ??
          usage.promptTokens ??
          usage.inputTokens ??
          usage.total_prompt_tokens ??
          usage.totalInputTokens ??
          usage.promptTokenCount ??
          usage.inputTokenCount ??
          usage.total_prompt_token_count ??
          usage.total_input_token_count;
        const output =
          usage.completion_tokens ??
          usage.output_tokens ??
          usage.completionTokens ??
          usage.outputTokens ??
          usage.total_completion_tokens ??
          usage.totalOutputTokens ??
          usage.completionTokenCount ??
          usage.outputTokenCount ??
          usage.total_completion_token_count ??
          usage.total_output_token_count;
        const total =
          usage.total_tokens ??
          usage.totalTokens ??
          usage.total_token_count ??
          usage.totalTokenCount ??
          (input || 0) + (output || 0);
        usageStats = {
          inputTokens: input ?? usageStats.inputTokens,
          outputTokens: output ?? usageStats.outputTokens,
          totalTokens: total ?? usageStats.totalTokens,
        };
      };
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue({
            type: "start",
            messageId,
            messageMetadata: {
              usage: usageStats,
              durationMs: 0,
            },
          });

          controller.enqueue({ type: "text-start", id: messageId });

          let buffer = "";
          let finished = false;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const parts = buffer.split("\n");
              buffer = parts.pop() ?? "";
              for (const raw of parts) {
                const line = raw.trim();
                if (!line.startsWith("data:")) continue;
                const data = line.slice(5).trim();
                if (data === "[DONE]") {
                  finished = true;
                  break;
                }
                try {
                  const chunk = JSON.parse(data);
                  captureUsage(chunk);
                  const choice = chunk?.choices?.[0];
                  const delta = choice?.delta;
                  const contentDelta =
                    typeof delta?.content === "string"
                      ? delta.content
                      : Array.isArray(delta?.content)
                        ? delta.content.map((c: any) => c?.text || "").join("")
                        : "";
                  if (contentDelta) {
                    controller.enqueue({ type: "text-delta", id: messageId, delta: contentDelta });
                  }
                  if (choice?.finish_reason) {
                    finished = true;
                    finishReason = choice.finish_reason;
                    break;
                  }
                } catch {
                  // ignore malformed chunk
                }
              }
              if (finished) break;
            }
          } catch (err) {
            console.error("Linkflow stream parse error:", err);
          } finally {
            controller.enqueue({ type: "text-end", id: messageId });
            controller.enqueue({
              type: "finish",
              finishReason: finished ? finishReason : "error",
              messageMetadata: {
                usage: usageStats,
                durationMs: Date.now() - startTime,
                finishReason: finished ? finishReason : "error",
              },
            });
            controller.close();
            cleanup();
          }
        },
      });

      return createUIMessageStreamResponse({
        stream,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // 根据 enableStreaming 决定使用流式或非流式
    const useStreaming = enableStreaming ?? true; // 默认使用流式

    const commonConfig: any = {
      // model: google("gemini-2.5-flash-preview-05-20"),
      // model: google("gemini-2.5-pro"),
      ...(systemForModel ? { system: systemForModel } : {}),
      model: resolvedModel.model,
      ...linkflowOverrides,
      // model: model,
      // providerOptions: {
      //   google: {
      //     thinkingConfig: {
      //       thinkingBudget: 128,
      //     },
      //   }
      // },
      // providerOptions: {
      //   openai: {
      //     reasoningEffort: "minimal"
      //   },
      // },
      messages: finalMessages,
      abortSignal: combinedAbortSignal,  // 使用组合的AbortSignal以支持取消请求和超时
      ...(outputMode === "svg" || outputMode === "excalidraw"
        ? {}
        : {
          tools: {
            // Client-side tool that will be executed on the client
            display_diagram: {
              description: `Display a diagram on draw.io. You only need to pass the nodes inside the <root> tag (including the <root> tag itself) in the XML string.
          
          **CRITICAL XML SYNTAX REQUIREMENTS:**
          
          1. **Mandatory Root Structure:**
          <root>
            <mxCell id="0"/>
            <mxCell id="1" parent="0"/>
            <!-- Your diagram elements here -->
          </root>
          
          2. **ALWAYS Escape Special Characters in Attributes:**
          - & → &amp;
          - < → &lt;
          - > → &gt;
          - " → &quot;
          
          3. **Style Format (STRICT):**
          - Must end with semicolon
          - No spaces around = sign
          - Example: style="rounded=1;fillColor=#fff;strokeColor=#000;"
          
          4. **Required Attributes:**
          - Every mxCell: id, parent (except id="0")
          - Every mxGeometry: as="geometry"
          - Self-closing tags: space before />
          
          5. **Complete Element Example:**
          <mxCell id="2" value="My Node" style="rounded=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
            <mxGeometry x="100" y="100" width="120" height="60" as="geometry" />
          </mxCell>
          
          6. **Edge (Connection) Example:**
          <mxCell id="5" value="" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="1" source="2" target="3">
            <mxGeometry relative="1" as="geometry" />
          </mxCell>
          
          **Common Errors to AVOID:**
          ❌ <mxCell value="Users & Admins"/>  → Use &amp;
          ❌ <mxCell value="x < 10"/>  → Use &lt;
          ❌ style="rounded=1"  → Missing final semicolon
          ❌ <mxGeometry x="10" y="20"/>  → Missing as="geometry"
          ❌ <mxCell id="2" vertex="1" parent="1"/>  → Missing <mxGeometry>
          
          **Validation Checklist:**
          ✓ Root cells (id="0" and id="1") present
          ✓ All special characters escaped
          ✓ All styles end with semicolon
          ✓ All IDs unique
          ✓ All elements have parent (except id="0")
          ✓ All mxGeometry have as="geometry"
          ✓ All tags properly closed
          
          **Using Professional Icons:**
          - For AWS services, use AWS 2025 icons: shape=mxgraph.aws4.[category].[service]
          - For Azure services, use Azure icons: shape=mxgraph.azure.[category].[service]
          - For GCP services, use GCP icons: shape=mxgraph.gcp2017.[category].[service]
          - These icons make diagrams more professional and vivid
          
          **IMPORTANT:** The diagram will be rendered to draw.io canvas in REAL-TIME as you stream the XML. The canvas updates automatically during streaming to show live progress.
          `,
              inputSchema: z.object({
                xml: z.string().describe(
                  "Well-formed XML string following all syntax rules above to be displayed on draw.io"
                )
              })
            },
            edit_diagram: {
              description: `Edit specific parts of the current diagram by replacing exact line matches. Use this tool to make targeted fixes without regenerating the entire XML.
IMPORTANT: Keep edits concise:
- Only include the lines that are changing, plus 1-2 surrounding lines for context if needed
- Break large changes into multiple smaller edits
- Each search must contain complete lines (never truncate mid-line)
- First match only - be specific enough to target the right element`,
              inputSchema: z.object({
                edits: z.array(z.object({
                  search: z.string().describe("Exact lines to search for (including whitespace and indentation)"),
                  replace: z.string().describe("Replacement lines")
                })).describe("Array of search/replace pairs to apply sequentially")
              })
            },
          },
        }),
      temperature: 0,
    };

    // Error handler function to provide detailed error messages
    function errorHandler(error: unknown) {
      console.error('Stream error:', error);

      if (error == null) {
        return 'unknown error';
      }

      if (typeof error === 'string') {
        return error;
      }

      if (error instanceof Error) {
        // 检查是否是网络错误或 API 错误
        const errorMessage = error.message;
        if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
          return `API 接口未找到。请检查 Base URL 配置是否正确。当前配置: ${modelRuntime?.baseUrl || '未知'}`;
        }
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
          return 'API Key 无效或已过期，请检查配置。';
        }
        if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
          return 'API Key 权限不足，请检查配置。';
        }
        return errorMessage;
      }

      return JSON.stringify(error);
    }

    // 根据 enableStreaming 决定使用流式或非流式
    if (enableStreaming) {
      // 流式响应
      const result = await streamText(commonConfig as any);

      return result.toUIMessageStreamResponse({
        onError: errorHandler,
        // 在流式响应结束时添加 token 使用信息到 message metadata
        onFinish: async ({ responseMessage, messages }) => {
          cleanup(); // 清理超时定时器

          const endTime = Date.now();
          const durationMs = endTime - startTime;

          // 获取 token 使用信息
          const usage = await result.usage;
          const totalUsage = await result.totalUsage;

          console.log('Stream finished:', {
            usage: {
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              totalTokens: (usage.inputTokens || 0) + (usage.outputTokens || 0),
            },
            totalUsage: {
              inputTokens: totalUsage.inputTokens,
              outputTokens: totalUsage.outputTokens,
              totalTokens: (totalUsage.inputTokens || 0) + (totalUsage.outputTokens || 0),
            },
            durationMs,
          });
        },
        // 提取 metadata 发送到客户端
        messageMetadata: ({ part }) => {
          // 在 finish 事件中返回 usage 信息
          if (part.type === 'finish') {
            return {
              usage: {
                inputTokens: part.totalUsage?.inputTokens || 0,
                outputTokens: part.totalUsage?.outputTokens || 0,
                totalTokens: (part.totalUsage?.inputTokens || 0) + (part.totalUsage?.outputTokens || 0),
              },
              durationMs: Date.now() - startTime,
            } as any;
          }
          // 在 finish-step 事件中也可以返回
          if (part.type === 'finish-step') {
            return {
              usage: {
                inputTokens: part.usage?.inputTokens || 0,
                outputTokens: part.usage?.outputTokens || 0,
                totalTokens: (part.usage?.inputTokens || 0) + (part.usage?.outputTokens || 0),
              },
              durationMs: Date.now() - startTime,
            } as any;
          }
          return undefined;
        },
      });
    } else {
      // 非流式响应 - 使用 generateText
      // 注意：非流式模式下不自动执行工具调用，让客户端处理
      // 这样可以保持与流式模式一致的体验
      const result = await generateText(commonConfig as any);

      cleanup(); // 清理超时定时器

      const endTime = Date.now();
      const durationMs = endTime - startTime;

      console.log('Generation finished (non-streaming):', {
        usage: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
        durationMs,
        toolCalls: result.toolCalls?.length || 0,
        finishReason: result.finishReason,
      });

      // 创建 UIMessageChunk 流来包装 generateText 的结果
      // 非流式模式下，我们将完整结果一次性发送，但格式与流式兼容
      const chunks: any[] = [];
      const messageId = `msg-${Date.now()}`;

      // 开始消息
      chunks.push({
        type: 'start',
        messageId,
        messageMetadata: {
          usage: {
            inputTokens: result.usage.inputTokens || 0,
            outputTokens: result.usage.outputTokens || 0,
            totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
          },
          durationMs,
        },
      });

      // 添加文本内容（如果有）
      if (result.text && result.text.length > 0) {
        chunks.push({ type: 'text-start', id: messageId });
        chunks.push({ type: 'text-delta', id: messageId, delta: result.text });
        chunks.push({ type: 'text-end', id: messageId });
      }

      // 添加工具调用 - 使用正确的字段名 'input' 而不是 'args'
      if (result.toolCalls && result.toolCalls.length > 0) {
        for (const toolCall of result.toolCalls) {
          chunks.push({
            type: 'tool-input-available',
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            input: toolCall.input,  // 注意这里使用 input 而不是 args
          });
        }
      }

      // 完成消息
      chunks.push({
        type: 'finish',
        finishReason: result.finishReason,
        messageMetadata: {
          usage: {
            inputTokens: result.usage.inputTokens || 0,
            outputTokens: result.usage.outputTokens || 0,
            totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
          },
          durationMs,
          finishReason: result.finishReason,
        },
      });

      // 创建 ReadableStream 发送所有 chunks
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });

      // 使用 AI SDK 的 createUIMessageStreamResponse 创建响应
      return createUIMessageStreamResponse({
        stream,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
  } catch (error) {
    try {
      cleanup(); // 清理超时定时器
    } catch {
      // cleanup可能不可用，忽略错误
    }

    console.error('Error in chat route:', error);
    // 提供更详细的错误信息
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', { errorMessage, errorDetails });

    return Response.json(
      {
        error: 'Internal server error',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { details: errorDetails })
      },
      { status: 500 }
    );
  }
}
