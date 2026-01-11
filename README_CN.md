# FlowPilot

<div align="center">

**AI 驱动的流程图创建工具 - 边聊边画，所想即所得**

[English](./README.md) | [中文](./README_CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15.x-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)



</div>

## 🎯 FlowPilot 是什么？

**FlowPilot** 是一款基于大语言模型的流程图工具，主打"边聊边画"的体验。通过自然语言对话，实时生成专业的 draw.io 图表。

> 基于 [next-ai-draw-io](https://github.com/DayuanJiang/next-ai-draw-io) vibe coding 完成

### ✨ 核心特性

- 🤖 **对话式生成**: 用自然语言描述需求，AI 实时产出 draw.io 图表
- 🎨 **风格复制**: 上传参考图，复刻大佬的布局和视觉风格
- ⚙️ **风格可控**: 一次配置画图偏好（手绘/正式/草稿），全局生效
- 🔄 **多模型对比**: 最多 5 个大模型并发生成，挑选最优结果
- 🌐 **多语言支持**: 内置中英文国际化支持

## 📸 效果展示

### 主工作区
![Main Workspace](./public/banner.png)

### 功能 1：对话式生成 + 实时预览

> 与 AI 对话，迭代式创建和优化图表

| 初始请求："请随便画一只猫咪" | 追加内容："在旁边再画一只小狗" |
|----------------------------|----------------------------|
| ![猫咪](./public/cat1.png) | ![猫和狗](./public/cat2.png) |

### 功能 2：风格复制

> 上传参考图，FlowPilot 将复制其风格

| 原始参考图 | AI 生成同风格图表 |
|-----------|------------------|
| ![原图](./public/image7.png) | ![复制风格](./public/image8.png) |

### 功能 3：FlowPilot Brief - 风格配置

> 一次配置图表偏好，应用到所有生成

![FlowBrief 配置](./public/image9.png)

**视觉风格对比：**

| 正式时序图 | 草绘时序图 |
|-----------|-----------|
| ![正式](./public/image10.png) | ![草稿](./public/image11.png) |

### 功能 4：模型对比生成

> 最多 5 个大模型并排对比，选择最佳结果

| 模型选择 | 对比结果 |
|---------|---------|
| ![模型配置](./public/image12.png) | ![对比](./public/image13.png) |

### 功能 5：第三方模型配置

> 轻松配置自定义 API 端点和模型

![模型配置](./public/image14.png)

### 实际生成案例展示

> FlowPilot 生成的各种流程图、时序图和系统架构图

<div align="center">

| 示例 1 | 示例 2 |
|--------|--------|
| ![案例 1](./public/image17.png) | ![案例 2](./public/image18.png) |
| ![案例 3](./public/image19.png) | ![案例 4](./public/image20.png) |

</div>

### 架构图示例
![架构图](./public/architecture.png)

*这张图也是用 FlowPilot 生成的！*

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm（推荐）或 npm
- 任一支持的大模型 API Key

### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/yourusername/flowpilot.git
cd flowpilot

# 安装依赖
pnpm install

# 复制环境变量配置
cp env.example .env.local

# 在 .env.local 中配置你的 API Key
# 详见下方配置说明
```

### 配置说明

编辑 `.env.local` 文件，添加你的 API 凭证：

```env
# 示例：使用 OpenAI
OPENAI_API_KEY=your-api-key-here

# 示例：使用 Google Gemini
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key-here

# 示例：使用 Amazon Bedrock
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# 可选：自定义 draw.io 地址
NEXT_PUBLIC_DRAWIO_BASE_URL=https://app.diagrams.net
```

### 启动应用

```bash
# 开发模式
pnpm dev

# 生产构建
pnpm build
pnpm start
```

开发模式访问 `http://localhost:6002`，生产模式访问 `http://localhost:6001`

## 🎮 使用指南

### 步骤 1 - 配置模型

1. 点击右上角的 **"模型配置"** 按钮
2. 填写模型服务商信息：
    - **Base URL**: API 端点地址（如 `https://api.openai.com/v1`）
    - **API Key**: 你的认证密钥
    - **Model ID**: 模型标识符（如 `gpt-4`, `claude-3-opus`）

### 步骤 2 - 设置偏好（可选）

点击 **"FlowBrief"** 配置：
- 任务模式（空白起稿、结构整理、讲解拆解）
- 视觉调性（产品规范、创意手稿、汇报精简、草稿手绘）
- 关注重点（泳道清晰、数据流动、叙事节奏）
- 图表类型（系统时序、业务活动、组件依赖、状态机等）

### 步骤 3 - 开始创作

**方式 A**：用自然语言描述需求
```
"画一个用户认证流程，包含登录、注册和密码重置"
```

**方式 B**：使用模板
- 点击 **"模板"** 按钮
- 选择预设的图表类型
- 按需自定义

### 步骤 4 - 多模型对比（可选）

1. 点击 **"模型对比"**
2. 选择最多 5 个模型进行对比
3. 并行生成图表
4. 挑选最满意的结果应用到画布

## 🛠️ 技术栈

- **框架**: Next.js 15 with App Router
- **语言**: TypeScript 5
- **样式**: Tailwind CSS 4
- **AI SDK**: Vercel AI SDK
- **大模型提供商**:
    - OpenAI (GPT-4, GPT-3.5)
    - Anthropic Claude
    - Google Gemini
    - Amazon Bedrock
    - OpenRouter
- **图表引擎**: react-drawio
- **UI 组件**: Radix UI
- **状态管理**: React Context

## 📚 支持的大模型

FlowPilot 原生支持多个大模型服务商：

| 服务商 | 模型 | 说明 |
|-------|------|------|
| OpenAI | GPT-4, GPT-3.5 Turbo | 推荐用于一般场景 |
| Anthropic | Claude 3 (Opus, Sonnet, Haiku) | 适合复杂图表 |
| Google | Gemini Pro, Gemini Pro Vision | 擅长处理图片参考 |
| Amazon Bedrock | Claude, Titan | 企业级选择 |
| OpenRouter | 多种模型 | 一站式访问多个模型 |

## 📖 文档

- [架构指南](./docs/architecture.md) - 系统架构和设计决策
- [国际化指南](./docs/i18n-guide.md) - 多语言实现说明

## 🎨 FlowPilot Brief 提示词说明

FlowPilot 在每次调用大模型前都会把「Brief」里配置的提示词拼接进系统 Prompt，以下是可选配置项：

### 任务模式

- **空白起稿**: 从零开始构建完整图表，合理分区并命名节点
- **结构整理**: 保持现有信息不变，专注对齐、分组与节奏感
- **讲解拆解**: 优先总结当前画布逻辑，输出洞察与改进建议

### 视觉调性

- **产品规范**: 采用中性灰与轻配色，保持企业级产品质感
- **创意手稿**: 允许更大胆的色块与手写式注释，强调灵感感
- **汇报精简**: 控制元素数量，偏右上角留白，适合直接投影展示
- **草稿手绘**: 切换到草稿主题，使用粗描边、淡手绘色块与手写字体风格

### 关注重点

- **泳道清晰**: 强化泳道边界，凸显跨角色交互
- **数据流动**: 标记每一步的输入输出，并保持箭头一致方向
- **叙事节奏**: 增加阶段标题与关键节点标记，让流程更故事化

### 图表类型

- **系统时序**: 将主要服务/角色转化为时序生命线
- **业务活动**: 以 Activity Diagram 表达条件分支与并行汇合
- **组件依赖**: 使用组件图视角，强调子系统、接口契约与部署边界
- **状态机**: 绘制状态机，展示核心对象的状态迁移
- **部署拓扑**: 输出部署图，列出环境节点、容器/服务实例及网络关系
- **思维导图**: 用思维导图方式整理主题、分支与子要点
- **体验旅程**: 以客户旅程视角展示阶段、触点、情绪曲线
- **甘特排程**: 绘制简化甘特图，包含里程碑、持续时长与依赖关系

## 💡 使用技巧

### 模型选择建议

- **推荐模型**: Claude 4.5 Sonnet、Claude-4 在流程图结构和连线方面表现较好
- **图片参考**: 涉及截图/参考图的需求请选择带视觉能力的模型
- **多轮迭代**: 第一版通常较粗糙，需要几轮"微调/美化/重排"才能达到满意效果

### 提示词技巧

- **意图清晰**: 告诉模型你的业务场景、期望的图表类型和角色
- **素材多样**: 可以直接粘贴 draw.io XML、Mermaid、PlantUML、代码等作为参考
- **渐进式优化**: 继续对话，如"保持节点不变只美化布局"、"把泳道改成竖向"

### 常用场景示例

| 场景 | 参考提示词 |
|------|-----------|
| 产品流程 | `请用泳道图描述主播开播到带货结算的流程，泳道包含：主播、运营、货品、财务；突出关键审核节点` |
| 技术架构 | `绘制"短视频推荐链路"体系图，分为采集、特征、召回、排序、服务五层，连线使用直角折线` |
| 运营 SOP | `输出素材提报-审核-发布的 SOP，强调负责角色、输入产物、审批条件` |
| 故障演练 | `画服务降级流程：监控报警 → 值班 → SRE → 业务方，用红色高亮关键 SLA` |

## 🤝 参与贡献

欢迎提交 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 开源协议

本项目采用 MIT 协议 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

本项目基于 [next-ai-draw-io](https://github.com/DayuanJiang/next-ai-draw-io) 改进而来，特别感谢原作者 DayuanJiang 创建了如此优秀的基础。

## 📧 联系方式

如有问题、建议或反馈，请在 GitHub 上提 Issue。

## ⭐ Star History

如果 FlowPilot 对你有帮助，请给个 Star！

---

<div align="center">
用 ❤️ 打造 by FlowPilot Team
</div>
