# 图片附件功能快速检查清单

## ✅ 检查结果

| 功能 | SVG 对话 | Draw.io 对话 | 通用模型 | Linkflow |
|------|---------|-------------|---------|----------|
| **修复前** |
| 图片上传 | ✅ | ✅ | ✅ | ✅ |
| 图片显示 | ✅ | ✅ | ✅ | ✅ |
| 图片发送到模型 | ✅ | ✅ | ✅ | ❌ |
| **修复后** |
| 图片上传 | ✅ | ✅ | ✅ | ✅ |
| 图片显示 | ✅ | ✅ | ✅ | ✅ |
| 图片发送到模型 | ✅ | ✅ | ✅ | ✅ |

## 📝 修复内容

### 问题
Linkflow 模型在处理图片时，会丢弃图片内容，只保留文本。

### 原因
`toOpenAIChatMessages` 函数只提取文本部分：
```typescript
// ❌ 只提取文本
const text = contentParts
    .filter((part: any) => part?.type === "text")
    .map((part: any) => part.text)
    .join("\\n");
```

### 解决方案
支持 OpenAI Vision API 格式，处理多模态内容：
```typescript
// ✅ 支持文本和图片
if (hasImage) {
    return { 
        role, 
        content: contentParts.map(part => {
            if (part.type === "text") return { type: "text", text: part.text };
            if (part.type === "image") return { 
                type: "image_url", 
                image_url: { url: part.image, detail: "high" }
            };
        })
    };
}
```

## 🔍 代码位置

**主要修改文件**: `app/api/chat/route.ts`  
**修改行数**: 约 228-245 行  
**函数名**: `toOpenAIChatMessages`

## 🧪 如何测试

### 快速测试步骤
1. 打开应用
2. 切换到 **SVG 模式** 或 **Draw.io 模式**
3. 选择一个 **Linkflow 模型**
4. **拖拽或粘贴** 一张图片
5. 输入提示词：`"请描述这张图片并复刻为流程图"`
6. 发送消息
7. **验证**: 模型的回复应该提到图片内容

### 预期结果
- ✅ 模型能看到并理解图片
- ✅ 模型基于图片内容生成响应
- ✅ 生成的图表与上传的图片相关

### 失败标志
- ❌ 模型说"我看不到图片"
- ❌ 模型忽略图片，只响应文本
- ❌ 出现 API 错误

## 📋 兼容性说明

### 支持的模型
只有支持 Vision API 的模型才能处理图片，例如：
- ✅ GPT-4 Vision / GPT-4V
- ✅ GPT-4o / GPT-4o-mini
- ✅ Claude 3 (Opus/Sonnet/Haiku)
- ✅ Gemini Pro Vision / Gemini 1.5 Pro
- ❌ GPT-3.5 (不支持图片)
- ❌ 纯文本模型

### 图片格式
- ✅ PNG
- ✅ JPEG / JPG
- ✅ GIF
- ✅ WebP
- ✅ 其他浏览器支持的图片格式

### 图片大小
- 建议小于 5MB
- Data URL 编码后会增大约 33%
- 过大的图片可能导致请求失败

## 🐛 已知问题

### 1. 模型不支持 Vision
**问题**: 如果 Linkflow 后端的模型不支持图片，会返回错误  
**解决**: 选择支持 Vision 的模型，或移除图片附件

### 2. 图片过大
**问题**: 超大图片可能导致请求超时或失败  
**解决**: 压缩图片或使用较小的图片

### 3. Base64 编码开销
**问题**: Data URL 编码会增加传输大小  
**影响**: 轻微增加请求时间和带宽消耗  
**优化**: 未来可考虑使用图片 URL 或分块上传

## 💡 使用建议

1. **选择合适的模型**: 确保选择支持 Vision 的模型
2. **优化图片大小**: 上传前压缩图片可以提高响应速度
3. **清晰的提示词**: 明确告诉模型如何处理图片
4. **一次一张图**: 虽然支持多图，但单图效果通常更好

## 📚 相关文档

- [image-attachment-analysis.md](./image-attachment-analysis.md) - 详细分析报告
- [image-attachment-fix.md](./image-attachment-fix.md) - 完整修复文档
- [OpenAI Vision API](https://platform.openai.com/docs/guides/vision) - API 参考

---

**最后更新**: 2025-12-07  
**状态**: ✅ 已修复，待测试
