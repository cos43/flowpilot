# 图片附件支持修复记录

## 问题描述

在 SVG 对话和 Draw.io 对话中，当用户上传图片并使用 Linkflow 模型时，图片附件会被丢弃，导致模型无法看到图片内容。

## 问题原因

在 `app/api/chat/route.ts` 的 Linkflow 处理逻辑中，`toOpenAIChatMessages` 函数只提取了文本内容：

```typescript
// 修复前的代码
const toOpenAIChatMessages = (msgs: any[]) =>
    msgs
        .map((msg) => {
            const contentParts = Array.isArray(msg.content)
                ? msg.content
                : [{ type: "text", text: msg.content ?? "" }];
            const text = contentParts
                .filter((part: any) => part?.type === "text" && typeof part.text === "string")
                .map((part: any) => part.text)
                .join("\\n")
                .trim();
            return { role, content: text || "(empty)" };
        })
        .filter((m) => typeof m.content === "string" && m.content.length > 0);
```

这个实现**只处理了 `type === "text"` 的部分**，导致 `type === "image"` 的图片被完全忽略。

## 修复方案

更新 `toOpenAIChatMessages` 函数以支持 OpenAI Vision API 格式：

```typescript
// 修复后的代码
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
                        return {
                            type: "image_url",
                            image_url: {
                                url: part.image || part.url,
                                detail: "high"
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
                    .join("\\n")
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
```

## 修复细节

### 1. 检测图片内容
```typescript
const hasImage = contentParts.some((part: any) => part?.type === "image");
```

### 2. 多模态消息格式
当消息包含图片时，使用 OpenAI Vision API 的标准格式：
```typescript
{
    role: "user",
    content: [
        {
            type: "text",
            text: "用户的文本内容"
        },
        {
            type: "image_url",
            image_url: {
                url: "data:image/png;base64,...",  // Data URL 格式
                detail: "high"  // 高清晰度分析
            }
        }
    ]
}
```

### 3. 纯文本消息格式
当消息只包含文本时，保持原有的简单格式：
```typescript
{
    role: "user",
    content: "用户的文本内容"
}
```

### 4. 兼容性处理
- 支持 `part.image` 和 `part.url` 两种字段名
- 过滤掉无效的内容部分
- 保持与原有逻辑的向后兼容

## 影响范围

### ✅ 修复后支持的场景
1. **SVG 对话 + Linkflow + 图片**：现在可以正常工作
2. **Draw.io 对话 + Linkflow + 图片**：现在可以正常工作
3. **SVG 对话 + 其他模型 + 图片**：保持原有功能
4. **Draw.io 对话 + 其他模型 + 图片**：保持原有功能

### 📝 使用限制

1. **模型支持**：Linkflow 端点的模型必须支持 Vision API（如 GPT-4V, Claude 3, Gemini Pro Vision）
2. **图片格式**：支持所有浏览器可处理的图片格式（PNG, JPEG, GIF, WebP 等）
3. **图片大小**：受限于 Data URL 的大小限制和模型的输入限制

## 测试验证

### 测试用例 1: SVG 对话 + Linkflow + 图片
```
1. 切换到 SVG 模式
2. 选择 Linkflow 模型
3. 上传一张流程图图片
4. 输入："请复刻这个流程图"
5. 验证：模型应该能看到图片并进行响应
```

### 测试用例 2: Draw.io 对话 + Linkflow + 图片  
```
1. 切换到 Draw.io 模式
2. 选择 Linkflow 模型
3. 粘贴一张架构图
4. 输入："将这个架构图转换为 draw.io 格式"
5. 验证：模型应该能理解图片并生成对应的 draw.io XML
```

### 测试用例 3: 多张图片
```
1. 上传多张图片
2. 验证：所有图片都应该被发送到模型
```

### 测试用例 4: 向后兼容
```
1. 使用纯文本消息（不带图片）
2. 验证：应该保持原有的行为，没有破坏性变更
```

## API 格式参考

### OpenAI Vision API 格式
```json
{
  "model": "gpt-4-vision-preview",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "What's in this image?"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
            "detail": "high"
          }
        }
      ]
    }
  ]
}
```

## 相关文件

- `app/api/chat/route.ts` - 主要修改文件
- `components/chat-panel-optimized.tsx` - 消息发送逻辑
- `components/chat-input-optimized.tsx` - 图片上传处理
- `features/chat-panel/utils/attachments.ts` - 图片序列化

## 参考文档

- [OpenAI Vision API](https://platform.openai.com/docs/guides/vision)
- [AI SDK - File Attachments](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#file-attachments)

---

**修复日期**: 2025-12-07  
**修复作者**: Assistant  
**问题优先级**: 中  
**测试状态**: 待测试
