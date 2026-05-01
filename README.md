# Suora 朔枢

> 基于 Electron、React 与 Vercel AI SDK 的本地 AI 工作台，围绕对话、文档、Agent、技能、流水线、定时任务、渠道接入与 MCP 集成构建。

在线文档首页：<https://fandych.github.io/suora/>

快速入口：
- 文档门户：<https://fandych.github.io/suora/>
- GitHub Releases：<https://github.com/fandych/suora/releases>
- 功能总览：<https://github.com/fandych/suora/blob/main/FEATURES.md>

## 项目概览

Suora 当前代码实现的是一个桌面端 AI 工作台，而不是单一聊天窗口。应用采用多页面工作台结构，用户可以在同一套本地数据与安全策略下完成以下工作：

- 在聊天页与不同模型、Agent 进行多轮对话
- 在文档页维护分组文档、文件夹层级、反向链接与图谱视图
- 在流水线页编排多步骤 Agent Pipeline，并保存执行历史
- 在模型页管理多家 LLM 提供商、模型参数与连通性测试
- 在 Agent 页创建自定义 Agent、测试 Agent、导入导出与版本快照
- 在技能页管理已安装技能、浏览注册表技能、配置技能源
- 在定时器页创建单次、间隔、Cron 任务，并触发通知、Agent 提示词或流水线
- 在渠道页接入企业微信、公众号、小程序、飞书、钉钉、Slack、Telegram、Discord、Teams 与自定义 Webhook
- 在 MCP 页配置 Model Context Protocol 服务器
- 在设置页统一管理主题、语言、安全、语音、数据、日志与系统诊断

## 当前实现的核心能力

### 多模型与提供商

当前代码内置支持以下 provider 类型：

- `anthropic`
- `openai`
- `google`
- `ollama`
- `deepseek`
- `zhipu`
- `minimax`
- `groq`
- `together`
- `fireworks`
- `perplexity`
- `cohere`
- `openai-compatible`

模型配置按“提供商配置 -> 启用模型 -> 每模型参数”组织，支持：

- API Key 与 Base URL 配置
- 连接测试
- 每个模型单独设置 `temperature` 与 `maxTokens`
- 比较视图查看启用模型
- Ollama 本地模式默认走本机端点

### 内置 Agent

当前内置 1 个默认助手和 6 个专业 Agent：

| Agent | 定位 | 典型技能 |
| --- | --- | --- |
| Assistant | 通用问答与日常任务 | 自动继承可用工具 |
| Code Expert | 代码实现、调试、重构 | filesystem, shell, git, code-analysis |
| Writing Strategist | 文档、内容、改写 | filesystem, web, utilities |
| Research Analyst | 调研、比较、总结 | web, memory, utilities |
| Security Auditor | 安全审计、风险分析 | filesystem, code-analysis, web |
| Data Analyst | 数据分析、SQL、指标 | filesystem, shell, utilities, memory |
| DevOps Expert | 部署、自动化、运维 | shell, filesystem, git, event-automation |

Agent 支持：

- 自定义系统提示词、颜色、头像、回复风格
- 模型绑定与最大轮次限制
- 技能分配
- `allowedTools` / `disallowedTools`
- 自动学习与 Agent 私有记忆
- 版本快照与回滚
- JSON 导入导出

### 技能系统

当前技能系统以 `SKILL.md` 为中心，支持：

- 已安装技能列表
- 注册表浏览与安装预览
- 自定义技能编辑器
- 本地导入单个 `SKILL.md` 或整个技能目录
- 技能打包导出
- 技能源管理
- 从工作区与外部目录自动加载技能

技能内容与 Claude Code 风格对齐，重点是“提示词能力层”，而不是在文档里重复声明工具白名单。

### 聊天工作台

聊天页当前支持的用户可见能力包括：

- 多会话标签与会话列表
- 附件发送：图片、文件、音频
- Markdown、数学公式、代码块渲染
- 工具调用状态展示
- 失败重试
- 消息编辑、删除、置顶、分支对话
- 回复反馈（赞/踩）
- 语音朗读
- 命令面板
- 会话级模型与 Agent 选择
- 聊天内触发 Pipeline 命令

### 文档工作台

文档页当前不是占位页面，而是完整的本地文档区，支持：

- 文档组
- 嵌套文件夹与文档
- Markdown 所见即所得编辑
- 数学公式与 Mermaid
- 文档搜索
- 反向链接与引用分析
- 图谱视图
- 选中文档作为聊天上下文

### Pipeline 与自动化

流水线页支持：

- 多步骤 Agent Pipeline 编排
- 步骤级重试、超时、条件执行
- 输出裁剪与变量导出
- 预算限制：总耗时、总 Token、最大步数
- Mermaid 预览与源码
- 执行历史与详情回放
- JSON 导入导出
- 在聊天中通过 `/pipeline` 命令运行已保存流水线

定时器页支持：

- `once`
- `interval`
- `cron`

定时器动作支持：

- 桌面通知
- 触发 Agent Prompt
- 触发已保存 Pipeline

### 渠道接入

当前代码中的渠道平台枚举为：

- 企业微信 `wechat`
- 微信公众号 `wechat_official`
- 微信小程序 `wechat_miniprogram`
- 飞书 `feishu`
- 钉钉 `dingtalk`
- Slack `slack`
- Telegram `telegram`
- Discord `discord`
- Microsoft Teams `teams`
- 自定义渠道 `custom`

渠道能力包括：

- Webhook 与 Stream 两种接入模式
- 渠道级 Agent 绑定
- 自动回复开关
- 白名单聊天对象
- 消息历史、用户列表、健康状态、调试视图
- 本地 Webhook 服务地址展示

### MCP 与扩展

当前实现已包含 MCP 服务器配置面板，支持：

- 添加与编辑 MCP 服务器配置
- 状态跟踪
- 与 Agent 工具体系集成

此外，应用还支持：

- 外部技能 / Agent 目录自动加载
- 已安装插件运行时恢复
- 环境变量管理
- SMTP 邮件配置
- 网络代理设置

## 首次使用

应用首次启动会显示 5 步引导：

1. Welcome
2. Configure a Model Provider
3. Meet Your Agents
4. Explore Skills
5. You're All Set

如果跳过引导，可在 `Settings -> System` 中重新运行。

推荐上手顺序：

1. 在 Models 页面添加 provider 配置并启用至少一个模型
2. 在 Chat 页面选择默认 Agent 与模型
3. 在 Skills 页面确认需要的技能已启用
4. 在 Documents 页面建立你的本地知识区
5. 在 Pipeline 与 Timer 页面配置自动化流程
6. 如果需要跨端使用，再到 Channels 页面接入消息平台

## 安装与开发

### 环境要求

- Node.js 18+
- npm
- Windows、macOS 或 Linux 桌面环境

### 本地开发

```bash
npm install
npm run dev
```

### 构建与打包

```bash
npm run build
npm run preview
npm run package
```

### 质量检查

```bash
npm run lint
npm run type-check
npm run test:run
npm run test:e2e
```

## 安全与数据

当前代码中的安全与数据行为有几个关键点：

- API Key 优先写入系统安全存储
- 如果系统 Keyring 不可用，API Key 只保存在内存中，重启后需要重新输入
- 文件系统访问可切换为工作区沙箱或放宽模式
- 支持允许目录列表与危险命令 denylist
- 可要求每次工具执行前进行确认
- 数据页支持导出和导入 `agents`、`skills`、`sessions`、`providerConfigs`、`externalDirectories`
- 可设置会话历史保留天数，也可清空全部聊天历史

## 文档索引

当前建议按下面顺序阅读：

| 类别 | 入口文档 | 说明 |
| --- | --- | --- |
| 功能总览 | [FEATURES.md](./FEATURES.md) | 当前代码对应的模块清单与用户可见能力 |
| 用户文档 | [docs/user/USER_GUIDE_ZH.md](./docs/user/USER_GUIDE_ZH.md) | 中文用户指南；其他语言版本位于 `docs/user/` |
| 技术文档 | [docs/technical/TECHNICAL_DOC_ZH.md](./docs/technical/TECHNICAL_DOC_ZH.md) | 中文技术参考；英文与其他语言版本位于 `docs/technical/` |
| 渠道专题 | [docs/CHANNEL_INTEGRATION.md](./docs/CHANNEL_INTEGRATION.md) | 渠道平台、Webhook/Stream 配置与运行面板说明 |
| 测试与质量 | [docs/TESTING.md](./docs/TESTING.md) | 当前测试命令、覆盖面与 E2E 边界 |
| 范围与状态 | [docs/requirements.md](./docs/requirements.md) | 当前产品范围基线与关键需求 |
| 实现总览 | [docs/IMPLEMENTATION_COMPLETE.md](./docs/IMPLEMENTATION_COMPLETE.md) | 当前实现状态与模块完成面概览 |
| 差异与缺口 | [docs/comparison.md](./docs/comparison.md) | 与同类产品的形态对比 |
| 差异与缺口 | [docs/UNIMPLEMENTED_FEATURES.md](./docs/UNIMPLEMENTED_FEATURES.md) | 当前仍待补强的能力边界 |
| 升级记录 | [docs/UPGRADE_REPORT.md](./docs/UPGRADE_REPORT.md) | 测试、安全与发布侧的升级记录 |
| 仓库说明 | [CLAUDE.md](./CLAUDE.md) | 面向贡献者与代码代理的仓库结构说明 |

## License

MIT