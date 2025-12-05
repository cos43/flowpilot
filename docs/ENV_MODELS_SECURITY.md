# 环境变量模型配置安全说明

## 概述

为了防止 API Key 泄露，本系统实现了环境变量模型配置的安全保护机制。通过环境变量 `NEXT_PUBLIC_DEFAULT_MODELS` 配置的模型将受到特殊保护，确保敏感信息不会泄露给前端用户。

## 安全特性

### 1. 配置隔离
- ✅ 环境变量配置的模型**不会**存储到浏览器 `localStorage`
- ✅ 环境变量配置的模型**不会**在模型配置界面显示
- ✅ 用户**无法**通过界面查看或修改环境变量模型的 API Key
- ✅ 用户**无法**通过界面修改环境变量模型的配置（如流式输出等）

### 2. 可见性控制
- ✅ 模型选择器中会显示环境变量模型，但会有 🔒 安全标识
- ✅ 显示 "系统配置（安全保护）" 标签，明确标识该模型受保护
- ✅ 用户可以选择使用这些模型，但看不到具体的接口配置信息

### 3. 数据持久化
- ✅ 只有用户手动配置的模型会被保存到 `localStorage`
- ✅ 每次应用启动时，环境变量模型会从环境变量重新读取
- ✅ 即使用户清空配置，环境变量模型仍然可用

## 环境变量配置格式

在 `.env.local` 文件中配置：

```bash
NEXT_PUBLIC_DEFAULT_MODELS='[
  {
    "name": "生产环境 API",
    "baseUrl": "https://api.example.com/v1",
    "apiKey": "sk-your-secret-key-here",
    "models": [
      {
        "modelId": "gpt-4",
        "label": "GPT-4",
        "description": "生产环境模型",
        "isStreaming": true
      }
    ]
  }
]'
```

## 技术实现

### 1. 模型标识

环境变量模型使用特殊的 ID 前缀 `__ENV__` 进行标识：

```typescript
// 环境变量端点 ID 格式: __ENV__xxxxxx
// 环境变量模型 ID 格式: __ENV__xxxxxx
```

### 2. 过滤函数

提供了工具函数来区分和过滤模型：

```typescript
import { 
  isEndpointFromEnv, 
  isModelFromEnv,
  filterUserEndpoints,
  getEnvOnlyEndpoints 
} from '@/lib/env-models';

// 检查是否为环境变量端点
const isFromEnv = isEndpointFromEnv(endpointId);

// 只获取用户配置的端点（用于配置界面）
const userEndpoints = filterUserEndpoints(allEndpoints);

// 只获取环境变量端点
const envEndpoints = getEnvOnlyEndpoints(allEndpoints);
```

### 3. 数据流

```
环境变量配置
    ↓
解析并标记为环境变量模型
    ↓
与用户配置合并（内存中）
    ↓
只将用户配置保存到 localStorage
    ↓
环境变量配置不在界面显示
    ↓
用户只能选择使用，看不到敏感信息
```

## 安全检查清单

在部署前，请确认以下安全措施：

- [ ] ✅ `.env.local` 文件已添加到 `.gitignore`
- [ ] ✅ 生产环境的 API Key 只存在于服务器环境变量中
- [ ] ✅ 前端代码中没有硬编码任何 API Key
- [ ] ✅ 浏览器 DevTools 中无法查看到环境变量模型的 API Key
- [ ] ✅ localStorage 中没有存储环境变量模型的配置
- [ ] ✅ 模型配置界面不显示环境变量模型

## 测试验证

### 1. 配置环境变量模型

在 `.env.local` 中添加测试配置：

```bash
NEXT_PUBLIC_DEFAULT_MODELS='[{"name":"Test API","baseUrl":"https://test.com","apiKey":"sk-test-key","models":[{"modelId":"test-model","label":"测试模型"}]}]'
```

### 2. 验证步骤

1. 启动应用
2. 打开模型选择器 - 应该能看到带有 🔒 标识的 "测试模型"
3. 打开模型配置界面 - 不应该显示 "Test API" 端点
4. 打开浏览器 DevTools → Application → localStorage - 不应该看到 Test API 的配置
5. 选择测试模型进行对话 - 应该能正常工作

### 3. 安全测试

```javascript
// 在浏览器控制台执行
// 尝试查看 localStorage
console.log(localStorage.getItem('flowpilot.modelRegistry.v1'));
// 应该只看到用户配置的模型，没有环境变量模型

// 尝试查看环境变量（在客户端应该看不到）
console.log(process.env.NEXT_PUBLIC_DEFAULT_MODELS);
// 在浏览器中会输出 undefined（环境变量在构建时注入，但不会在运行时暴露）
```

## 注意事项

### ⚠️ 重要警告

1. **不要在客户端代码中使用环境变量 API Key**
   - `NEXT_PUBLIC_` 前缀的环境变量会被打包到客户端代码中
   - 本实现只是隐藏显示，API Key 仍然在客户端代码中
   - **真正的安全做法是使用服务端代理**

2. **生产环境推荐做法**
   ```
   客户端 → 你的后端 API → OpenAI/其他 LLM API
   ```
   - API Key 只存在于后端
   - 客户端通过你的后端转发请求
   - 后端可以添加额外的访问控制、限流等

3. **当前实现的适用场景**
   - 个人使用或内部工具
   - 已经有其他认证机制的封闭环境
   - 不介意 API Key 在客户端代码中的场景

## 最佳实践

### 推荐：使用服务端代理

创建 API 路由来代理 LLM 请求：

```typescript
// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // 这里可以添加认证、授权逻辑
  const { messages, model } = await request.json();
  
  // API Key 只在服务端，不会暴露给客户端
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, // 不使用 NEXT_PUBLIC_
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, model }),
  });
  
  return NextResponse.json(await response.json());
}
```

## 总结

当前实现提供了基本的 UI 层面保护，防止普通用户意外看到或修改环境变量配置的模型。但对于真正需要保护 API Key 安全的生产环境，强烈建议使用服务端代理方案。
