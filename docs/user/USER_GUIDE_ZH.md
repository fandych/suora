# Suora 用户指南

本指南基于当前代码实现编写，重点说明 Suora 现在已经具备的用户功能，而不是历史规划或旧版设计稿中的能力。

文档清理后，`docs/user/USER_GUIDE_ZH.md` 与 `docs/user/USER_GUIDE_EN.md` 是仓库里长期维护的主用户文档；更细分的测试、渠道与产品边界说明分别放在 `docs/TESTING.md`、`docs/CHANNEL_INTEGRATION.md` 与 `docs/requirements.md`。

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

### 从发布包安装

如果你不是开发者，优先使用 GitHub Releases 中的桌面安装包：

1. 打开 <https://github.com/fandych/suora/releases/latest>
2. 根据操作系统选择安装包：
   - Windows：安装版或便携版
   - macOS：DMG 或 ZIP
   - Linux：AppImage、DEB 或 RPM
3. 安装后首次启动，先进入 Models 配置至少一个可用模型

### 首次引导

首次打开应用时会看到 5 步引导：

1. 欢迎
2. 配置模型提供商
3. 认识你的 Agent
4. 浏览技能
5. 准备完成

如果跳过引导，可以在 `设置 -> System` 里重新运行。

### 推荐首次配置顺序

为了尽快进入稳定可用状态，建议按下面顺序完成首次配置：

1. 在 **Models** 中添加一个提供商或本地 Ollama 端点
2. 在 **Chat** 中选择默认模型与默认 Agent
3. 在 **Skills** 中确认已启用需要的技能
4. 在 **Documents** 中创建至少一个文档组，建立你的本地知识区
5. 如果要做自动化，再去 **Pipeline** 和 **Timer**
6. 如果要接入外部消息平台，再配置 **Channels**

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

## 5. 模型与提供商

当前支持的提供商类型有：

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
- OpenAI 兼容端点

### 模型页当前支持的操作

- 新建提供商配置
- 选择提供商预设
- 输入 API Key 和 Base URL
- 测试连接
- 启用或禁用具体模型
- 为每个模型设置 `temperature` 与 `maxTokens`
- 查看已启用模型清单
- 在比较视图中对比模型

如果使用 Ollama，本地端点默认走 `http://localhost:11434/v1`。

## 6. Agent 与技能

### 当前内置 Agent

- Assistant
- Pipeline builder
- Timer builder
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
- 基于来源信息扩展相关笔记
- 图谱视图，并提示桥接节点、稀疏簇、知识缺口和意外连接
- 把文档选为聊天上下文

推荐使用方式：

1. 先按主题创建文档组
2. 在组内用文件夹拆分项目、知识域或时间线
3. 用回链和标签维护关联
4. 在 Chat 中选择相关文档作为上下文，再发起问答或任务

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

## 8. 渠道、MCP 与设置

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

### 设置、安全与数据

当前设置页包含 7 个分区：

- General
- Security
- Voice
- Shortcuts
- Data
- Logs
- System

当前重要设置能力包括：

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

API Key 会优先写入系统安全存储；如果系统 Keyring 不可用或加密失败，应用会提示这些 Key 只保存在内存中，重启后需要重新输入。

## 9. 常见使用路径

### 场景 1：把文档知识带入对话

1. 在 Documents 中整理笔记
2. 打开 Chat，选择当前会话的 Agent 与模型
3. 选中相关文档作为上下文
4. 提问、总结、改写或继续执行任务

### 场景 2：把重复任务做成流水线

1. 在 Pipeline 中创建多步骤流程
2. 为每一步选择合适的 Agent
3. 设置 `runIf`、超时、重试和输出变量
4. 保存后可以从聊天 `/pipeline run` 触发，或交给 Timer 定时执行

### 场景 3：接入外部消息渠道

1. 在 Channels 中创建渠道
2. 绑定负责回复的 Agent
3. 填写平台密钥、Webhook 或 Stream 参数
4. 在 Health / Debug 面板里检查运行状态

## 10. 常见问题排查

### 模型没有回复或报连接错误

- 先检查提供商的 API Key、Base URL 和网络连通性
- 如果是 Ollama，确认本地端点是否在运行
- 在 Models 中重新做连接测试

### 重启后 API Key 丢失

- 这通常说明系统 Secure Storage / Keyring 不可用
- Suora 会在这种情况下只把密钥保存在内存里，重启后需要重新输入

### 渠道收不到消息

- 检查渠道是否启用
- 检查 reply agent 是否仍然存在
- 检查 Webhook 地址、签名密钥和白名单聊天对象

### 看不到某个功能入口

- 先确认当前路由是否存在于主导航
- `Models`、`Skills`、`Settings` 里有子视图与默认跳转，不是所有入口都在顶层按钮直接展开

## 11. 相关文档

如果你已经熟悉基础用法，建议继续阅读：

- [技术文档](../technical/TECHNICAL_DOC_ZH.md)
- [测试说明](../TESTING.md)
- [渠道集成说明](../CHANNEL_INTEGRATION.md)
- [产品范围与需求基线](../requirements.md)
