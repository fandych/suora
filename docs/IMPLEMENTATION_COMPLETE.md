# Suora 当前实现状态总览

> 更新日期：2026-04-30  
> 口径：按当前仓库代码与可见测试面整理

本文档替代旧的“单一 Channel Integration 完整实现总结”。当前仓库已经不再只是一个渠道集成原型，而是一个包含聊天、文档、pipeline、agent、skills、timer、channels、MCP 与安全设置的完整桌面 AI 工作台。

## 1. 总体结论

当前代码已经形成可运行的桌面产品骨架，并具备以下稳定主路径：

- Electron 主进程、preload bridge 与 React renderer 的三层结构
- 基于 Hash Router 的 10 个顶层工作区路由
- 统一的 Zustand 持久化应用状态
- 多 provider AI 服务层与流式工具调用
- 内置与自定义 agent、skill、pipeline、timer、channel、MCP 配置能力
- 本地数据管理、导入导出、安全存储告警与日志面板

结论上，应将项目视为“实现中且已具备完整工作台骨架”的产品，而不是只实现了聊天或渠道接入的 demo。

## 2. 运行时架构状态

| 层级 | 当前状态 | 说明 |
| --- | --- | --- |
| Electron Main Process | 已实现 | 承担窗口生命周期、IPC、部分系统能力、渠道/存储/日志相关特权逻辑 |
| Preload Bridge | 已实现 | 以 allowlist 方式向 renderer 暴露受控 API |
| React Renderer | 已实现 | 承担工作台 UI、状态绑定、agent/pipeline/chat/documents 等主流程 |

## 3. 顶层工作区状态

| 工作区 | 状态 | 当前实现概览 |
| --- | --- | --- |
| Chat | 已实现 | 会话列表、消息流式输出、附件、模型/agent 切换、工具结果与失败重试 |
| Documents | 已实现 | 文档组、目录、Markdown、图谱、回链、Mermaid、数学公式、聊天上下文联动 |
| Pipeline | 已实现 | 多步执行、重试、超时、`runIf`、历史、预览、导入导出 |
| Models | 已实现 | provider 配置、模型参数、比较视图、默认模型管理 |
| Agents | 已实现 | 内置 agent、自定义 agent、版本、分析、权限与工具配置 |
| Skills | 已实现 | 安装视图、注册表/市场、来源管理、`SKILL.md` 编辑与资源树 |
| Timer | 已实现 | Once/Interval/Cron，通知、agent prompt、pipeline 执行 |
| Channels | 已实现 | 渠道配置、消息、用户、健康、调试、reply agent 绑定 |
| MCP | 已实现 | 服务器配置、状态查看与能力接入 |
| Settings | 已实现 | 通用、安全、语音、快捷键、数据、日志、系统 七大分区 |

## 4. AI 与模型层状态

AI 能力由 `src/services/aiService.ts` 负责统一编排。当前代码已体现以下能力：

- 模型配置校验
- provider 客户端初始化与缓存
- provider/base URL/API key 组合隔离
- 文本生成与流式响应
- 工具调用事件桥接
- usage 统计与错误分类

当前 provider 支持面覆盖：

- Anthropic
- OpenAI
- Google
- Ollama
- DeepSeek
- Zhipu
- MiniMax
- Groq
- Together AI
- Fireworks
- Perplexity
- Cohere
- OpenAI-compatible endpoints

## 5. Agent 与 Skill 层状态

### 5.1 内置 agent

当前内置 agent 包括：

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### 5.2 Agent 能力面

当前 agent 配置已超出“提示词模板”范畴，包含：

- 系统提示词
- 模型偏好
- skill 绑定
- 允许/禁止工具
- 权限模式
- temperature、maxTokens、maxTurns
- memories 与自动学习相关配置

### 5.3 Skill 能力面

当前 skill 系统已经形成以 `SKILL.md` 为中心的包结构，支持：

- 已安装 skills 管理
- 来源与注册表浏览
- 单文件或目录导入
- markdown 或 zip 导出
- 资源树管理
- 编辑器与预览面板

## 6. Documents、Pipeline 与 Timer 状态

### 6.1 Documents

当前文档工作区已具备完整的知识工作台雏形：

- 多层级目录与文档树
- Markdown 编辑/渲染
- Mermaid 与数学公式
- 回链与引用
- 图谱视图
- 搜索与聊天上下文选择

### 6.2 Pipeline

当前 pipeline 不是静态展示页，而是具备真实执行能力的工作流系统，已支持：

- 多步骤 agent 执行
- 失败重试与 backoff
- 步级超时
- `runIf` 条件判断
- 输出变换与变量导出
- 运行历史与进度状态
- 从聊天命令触发运行

### 6.3 Timer

当前 timer 已与工作台其余能力打通，可触发：

- 桌面通知
- agent prompt
- 已保存 pipeline

## 7. Channels 与 MCP 状态

### 7.1 Channels

旧文档只描述了早期的三平台 webhook 集成，这已经不足以代表当前实现。现在的类型和 UI 结构已经覆盖更宽的渠道矩阵，并提供：

- 渠道配置
- 消息历史
- 用户列表
- 健康面板
- 调试面板
- reply agent 与 auto reply 配置

### 7.2 MCP

MCP 已进入工作台主导航，而不是只停留在概念层。当前实现覆盖：

- 服务器配置
- 连接状态管理
- 与 agent 运行时的能力接入

## 8. 数据、安全与可运维性状态

### 8.1 数据与持久化

当前仓库已经提供：

- 本地持久化应用状态
- 数据导入与导出
- 会话、skills、agents 等实体的本地管理
- 日志与崩溃信息面板

### 8.2 安全边界

当前安全基线包括：

- Electron `contextIsolation`
- renderer 不直接暴露 Node.js 特权接口
- preload allowlist bridge
- Secure Storage 不可用时的显式告警
- 文件系统与工具执行的限制策略

### 8.3 当前仍在演进的方向

虽然主骨架已经具备，但以下方向仍属于持续增强区，而不是“所有细节都已封顶”的状态：

- pipeline 的更高级编排能力
- 更深的运行时诊断与可观测性
- Electron 原生窗口级别的端到端测试
- 文档与实现之间的持续同步机制

## 9. 测试与构建基线

当前仓库已具备标准开发命令：

```bash
npm install
npm run dev
npm run build
npm run preview
npm run package
npm run lint
npm run type-check
npm run test:run
npm run test:coverage
npm run test:e2e
```

测试覆盖面已包含服务层、组件层、store、Electron 辅助模块和基础 e2e smoke path，但仍应避免在文档中固定写死测试总数或覆盖率百分比，除非更新前重新运行过对应命令。

## 10. 维护说明

更新本文档时，请优先核对以下锚点：

- `src/App.tsx`
- `src/store/appStore.ts`
- `src/services/aiService.ts`
- `src/types/index.ts`
- `src/components/settings/SettingsLayout.tsx`
- `package.json`

如果后续只更新了某一专项能力，例如 pipeline 或 channels，请不要再把本文档写回到只描述单一子系统的状态。