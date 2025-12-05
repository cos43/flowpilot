# 环境变量模型配置安全保护 - 实现总结

## 📋 功能概述

实现了通过环境变量 `NEXT_PUBLIC_DEFAULT_MODELS` 配置的模型的安全保护机制，确保：

1. ✅ 用户无法在配置界面看到环境变量配置的模型
2. ✅ 环境变量模型不会被保存到 localStorage
3. ✅ 用户可以选择使用环境变量模型，但无法修改其配置
4. ✅ 界面上有明确的安全标识，区分系统配置和用户配置的模型

## 🔧 技术实现

### 1. 修改的文件

#### `lib/env-models.ts`
- 添加 `ENV_MODEL_PREFIX` 常量用于标识环境变量模型
- 修改 `parseDefaultModelsFromEnv` 函数，为环境变量模型添加特殊 ID 前缀
- 添加 `isFromEnv` 标记到端点配置
- 新增工具函数：
  - `isEndpointFromEnv(endpointId)` - 检查端点是否来自环境变量
  - `isModelFromEnv(modelId)` - 检查模型是否来自环境变量
  - `filterUserEndpoints(endpoints)` - 过滤出用户配置的端点
  - `getEnvOnlyEndpoints(endpoints)` - 获取环境变量端点

#### `types/model-config.ts`
- 在 `ModelEndpointConfig` 接口添加 `isFromEnv?: boolean` 字段

#### `hooks/use-model-registry.ts`
- 修改 `setAndPersist` 函数，保存时只存储用户配置的端点
- 修改 `useEffect` 初始化逻辑，每次启动时从环境变量读取并合并
- 修改 `saveEndpoints` 函数，保存后重新合并环境变量端点
- 修改 `clearRegistry` 函数，清除时保留环境变量端点
- 添加 `userEndpoints` 返回值，用于配置界面

#### `components/chat-panel-optimized.tsx`
- 从 `useModelRegistry` 获取 `userEndpoints`
- 传递 `userEndpoints` 给 `ModelConfigDialog`

#### `app/ppt/page.tsx`
- 从 `useModelRegistry` 获取 `userEndpoints`
- 传递 `userEndpoints` 给 `ModelConfigDialog`

#### `components/model-config-dialog.tsx`
- 接收 `userEndpoints` 而非 `endpoints`
- 配置界面只显示用户配置的端点

#### `components/model-selector.tsx`
- 导入 `isEndpointFromEnv` 和 `ShieldCheck` 图标
- 修改分组逻辑，为环境变量模型添加 "🔒 系统配置" 标识
- 添加环境变量模型的视觉标识（绿色盾牌图标）
- 禁用环境变量模型的流式输出开关
- 显示 "系统配置（安全保护）" 标签

### 2. 数据流设计

```
┌─────────────────────────────┐
│  环境变量                    │
│  NEXT_PUBLIC_DEFAULT_MODELS │
└───────────┬─────────────────┘
            │
            ↓ 解析并添加 __ENV__ 前缀
┌───────────────────────────────────┐
│  环境变量端点                      │
│  ID: __ENV__xxxxxx               │
│  isFromEnv: true                 │
└───────────┬───────────────────────┘
            │
            ↓ 与用户配置合并（内存）
┌───────────────────────────────────┐
│  运行时模型列表                    │
│  - 环境变量模型（标记）            │
│  - 用户配置模型                    │
└───────────┬───────────────────────┘
            │
            ├───→ localStorage (只存用户配置)
            │
            ├───→ 模型选择器 (显示所有，标记环境变量模型)
            │
            └───→ 配置界面 (只显示用户配置)
```

### 3. 安全机制

#### 隔离存储
```typescript
// 保存时过滤
const userEndpoints = filterUserEndpoints(next.endpoints);
const persistState = {
    endpoints: userEndpoints,  // 只保存用户端点
    selectedModelKey: next.selectedModelKey,
};
window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistState));
```

#### 加载时合并
```typescript
// 读取时合并
const envEndpoints = getDefaultEndpoints();  // 从环境变量读取
const userEndpoints = parsed.endpoints;       // 从 localStorage 读取
const allEndpoints = [...envEndpoints, ...userEndpoints];  // 合并
```

#### 界面过滤
```typescript
// 配置界面只显示用户端点
<ModelConfigDialog
    endpoints={userEndpoints}  // 不是 endpoints
    onSave={saveEndpoints}
/>
```

#### 视觉标识
```tsx
// 模型选择器中的标识
{isFromEnv && (
    <span title="系统配置模型（安全）">
        <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
    </span>
)}
{isFromEnv && (
    <div className="ml-5 flex items-center gap-1.5 text-xs text-green-600">
        <ShieldCheck className="h-3 w-3" />
        <span>系统配置（安全保护）</span>
    </div>
)}
```

## 📝 使用方法

### 1. 配置环境变量

在 `.env.local` 文件中：

```bash
NEXT_PUBLIC_DEFAULT_MODELS='[{"name":"Production API","baseUrl":"https://api.example.com/v1","apiKey":"sk-secret-key","models":[{"modelId":"gpt-4","label":"GPT-4","isStreaming":true}]}]'
```

### 2. 用户体验

- **模型选择器**：用户可以看到并选择环境变量模型，但会有 🔒 标识
- **配置界面**：用户完全看不到环境变量模型的存在
- **流式开关**：环境变量模型的流式设置无法修改，显示锁定状态

## ⚠️ 重要提醒

### 安全限制

虽然此实现在 UI 层面隐藏了环境变量配置，但 **API Key 仍然存在于客户端代码中**！

原因：
- `NEXT_PUBLIC_` 前缀的环境变量会在构建时注入到客户端代码
- 技术上可以通过查看打包后的 JS 文件获取 API Key

### 真正安全的做法

**生产环境强烈建议使用服务端代理**：

```
客户端 → 你的后端 API (有认证) → LLM API
```

好处：
- API Key 只在服务端，永远不暴露给客户端
- 可以添加访问控制、限流、日志等
- 可以在服务端聚合多个 LLM 提供商

### 当前实现适用场景

- ✅ 个人项目或内部工具
- ✅ 已有其他认证机制的封闭系统
- ✅ 原型开发和测试
- ❌ **不适合**公开的生产环境

## 📚 相关文档

- [安全说明详细文档](./docs/ENV_MODELS_SECURITY.md)
- [配置示例](./.env.example.models)

## ✅ 验证清单

部署前请确认：

- [ ] `.env.local` 已添加到 `.gitignore`
- [ ] 浏览器 DevTools → Application → localStorage 中看不到环境变量配置
- [ ] 模型配置界面看不到环境变量端点
- [ ] 模型选择器中环境变量模型有 🔒 标识
- [ ] 环境变量模型可以正常使用
- [ ] 如果是生产环境，已考虑使用服务端代理方案

## 🎯 总结

此实现提供了 **UI 层面的保护**，防止普通用户误操作或查看环境变量配置。对于真正需要安全保护 API Key 的场景，请实现服务端代理方案。
