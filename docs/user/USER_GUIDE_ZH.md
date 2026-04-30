# Suora 用户指南

本指南基于当前代码实现编写，重点说明 Suora 现在已经具备的用户功能，而不是历史规划或旧版设计稿中的能力。

## 1. 产品定位

Suora 是一个本地 AI 工作台。当前版本不是只有聊天窗口，而是由多个协作模块组成：聊天、文档、模型、Agent、技能、流水线、定时器、渠道、MCP 和设置。

你可以把它理解为“本地运行的多 Agent 操作界面”，适合做以下事情：

- 与不同模型进行日常问答和任务执行
- 通过专业 Agent 处理代码、写作、研究、安全、数据和运维任务
- 在本地维护知识文档并把文档内容带入对话
- 把多个 Agent 步骤串成流水线，并定时运行
- 接入企业微信、飞书、钉钉等平台，让桌面助手从外部渠道接收消息

## 2. 安装与首次启动

### 环境要求

- Windows、macOS 或 Linux 桌面环境
- Node.js 18+（源码运行时）
- npm

### 从源码运行

```bash
npm install
npm run dev
```

### 首次引导

首次打开应用时会看到 5 步引导：

1. Welcome
2. Configure a Model Provider
3. Meet Your Agents
4. Explore Skills
5. You're All Set

如果跳过引导，可以在 `设置 -> System` 里重新运行。

## 3. 工作台总览

当前主导航对应的模块如下：

| 模块 | 当前用途 |
| --- | --- |
| Chat | 多会话对话、切换 Agent / 模型、发送附件、查看工具调用 |
| Documents | 管理本地文档组、文件夹、反向链接和图谱 |
| Pipeline | 设计与运行多步骤 Agent 流水线 |
| Models | 配置 provider、启用模型、测试连接、比较模型 |
| Agents | 管理内置和自定义 Agent，做测试、导入导出和版本快照 |
| Skills | 管理已安装技能、浏览注册表技能、编辑 `SKILL.md` |
| Timer | 创建单次、间隔和 Cron 定时任务 |
| Channels | 接入消息平台并指定回复 Agent |
| MCP | 配置 MCP 服务器 |
| Settings | 管理通用偏好、安全、数据、日志和系统诊断 |

## 4. 聊天工作流

聊天页是当前最核心的操作入口，已经实现的能力包括：

- 多会话列表与标签
- 会话级 Agent 与模型切换
- 图片、文件、音频附件
- 流式回复
- Markdown、代码块、数学公式显示
- 工具调用列表和执行状态
- 回复失败后一键重试
- 消息编辑、删除、置顶、分支对话
- 回复反馈（赞 / 踩）
- 文本朗读
- 行内引用展示

### 当前可直接使用的快捷操作

- `Ctrl/Cmd + K`：打开命令面板
- `Enter`：发送消息
- `Shift + Enter`：输入框换行
- `Escape`：关闭命令面板或弹窗
- `Ctrl/Cmd + S`：在文档编辑器里保存内容

### 命令面板

命令面板可以快速跳转到：

- 会话
- 文档
- Agent
- 技能
- 模型
- 设置
- 渠道
- 定时器
- MCP
- Pipeline

## 5. 模型与 Provider

当前支持的 provider 类型有：

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
- OpenAI-compatible

### 模型页当前支持的操作

- 新建 provider 配置
- 选择 provider preset
- 输入 API Key 和 Base URL
- 测试连接
- 启用或禁用具体模型
- 为每个模型设置 `temperature` 与 `maxTokens`
- 查看已启用模型清单
- 在 Compare 视图对比模型

如果使用 Ollama，本地端点默认走 `http://localhost:11434/v1`。

## 6. Agent 与技能

### 当前内置 Agent

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### 自定义 Agent 当前支持

- 自定义名称、头像、颜色、系统提示词
- 绑定模型
- 选择技能
- 设置温度、最大轮次、回复风格
- 配置允许 / 禁止工具列表
- 开启自动学习
- 导入、导出、复制
- 版本快照与恢复
- 在 Agent 页内进行测试对话

### 技能页当前支持

- 查看已安装技能
- 启用或禁用技能
- 编辑 `SKILL.md`
- 浏览技能注册表
- 安装注册表技能前查看安装预览
- 添加 / 管理技能源
- 从单个文件导入技能
- 从整个技能目录导入技能
- 导出技能为 markdown 或 zip

技能还支持从工作区和外部目录自动加载。

## 7. 文档、流水线与定时器

### 文档模块

文档页当前支持：

- 文档组
- 嵌套文件夹
- Markdown 文档
- Mermaid 图表
- 数学公式块
- 文档搜索
- 反向链接和引用关系
- 图谱视图
- 把文档选为聊天上下文

### Pipeline 模块

流水线页当前支持：

- 多步骤 Agent 编排
- 步骤重试和退避策略
- 步骤超时
- 条件运行 `runIf`
- 输出裁剪与变量导出
- 预算限制：总时长、总 Token、最大执行步数
- Mermaid 预览与源码导出
- 执行历史与步骤详情
- 保存、导入、导出流水线

聊天中还支持 `/pipeline` 相关命令，例如：

- `/pipeline list`
- `/pipeline run <名称或ID>`
- `/pipeline status`
- `/pipeline history <名称或ID>`
- `/pipeline cancel`

### Timer 模块

当前定时器类型：

- Once
- Interval
- Cron

当前定时器动作：

- 桌面通知
- 触发 Agent Prompt
- 触发已保存流水线

## 8. 渠道与 MCP

### 当前支持的渠道平台

- 企业微信
- 微信公众号
- 微信小程序
- 飞书 / Lark
- 钉钉
- Slack
- Telegram
- Discord
- Microsoft Teams
- 自定义渠道

### 渠道页当前支持

- Webhook 或 Stream 模式
- 绑定一个回复 Agent
- 自动回复开关
- 白名单聊天对象
- 查看消息历史
- 查看用户列表
- 查看健康状态
- 查看调试信息

### MCP 模块

MCP 页当前用于：

- 添加服务器配置
- 编辑服务器配置
- 查看连接状态
- 把 MCP 服务纳入 Agent 可用能力范围

## 9. 设置、安全与数据

当前设置页包含 7 个分区：

- General
- Security
- Voice
- Shortcuts
- Data
- Logs
- System

### 当前重要设置能力

- 主题、语言、字体、强调色
- 自动启动
- 代理服务器配置
- SMTP 邮件配置与测试
- 环境变量管理
- 工具执行确认
- 文件系统沙箱模式
- 允许目录列表
- 危险命令屏蔽模式
- 语音相关设置
- 快捷键映射管理
- 数据导入与导出
- 历史保留策略
- 日志和崩溃记录查看
- 运行时性能指标
- 重新运行首次引导

### API Key 与安全存储

当前实现会优先使用系统安全存储保存 API Key。

如果系统 Keyring 不可用或加密失败，应用会提示：

- Key 仅保存在内存中
- 重启应用后需要重新输入

这一点是当前行为，不建议在用户文档中写成“永远安全落盘”。

### 数据页导出内容

当前导出会包含：

- 自定义 Agent
- 自定义技能
- 全部会话
- Provider 配置
- 外部目录配置

## 10. 排障建议

### 模型无法连接

依次检查：

1. API Key 是否填写正确
2. Base URL 是否匹配 provider
3. 至少有一个模型被启用
4. 代理设置是否拦截了请求
5. 使用 `Models` 页的连接测试确认状态

### 渠道没有收到消息

依次检查：

1. 渠道是否启用
2. 回复 Agent 是否存在且可用
3. Webhook 模式下本地 channel server 是否已启动
4. 平台后台填写的 URL 是否与 Suora 显示一致
5. `allowedChats` 是否拦截了当前聊天
6. Health / Debug 面板里是否出现错误

### 技能没有生效

依次检查：

1. 技能是否已启用
2. Agent 是否分配了需要的技能
3. 技能文件是否成功导入到当前工作区或外部目录
4. 技能内容是否是合法的 `SKILL.md`

### 定时器没有执行

依次检查：

1. 定时器是否启用
2. Cron 表达式是否合法
3. 目标 Agent 或 Pipeline 是否仍然存在
4. 应用是否处于运行状态

## 11. 建议的上手顺序

如果你是第一次使用当前版本，推荐按下面顺序体验：

1. 在 `Models` 添加一个 provider 并启用模型
2. 在 `Agents` 看一遍内置 Agent，再决定是否新建自定义 Agent
3. 在 `Chat` 发起第一轮对话
4. 在 `Documents` 建立一个知识文档组
5. 在 `Pipeline` 保存一个两到三步的自动化流程
6. 在 `Timer` 定时触发这个流程
7. 最后再配置 `Channels` 或 `MCP`