# Soura 本地 Agent 平台架构总结

## 一、项目定位

Soura 是一个基于 **Electron + Vite + React** 构建的本地 AI 自动化平台，核心能力包括：

```text
Chat
Agent
Workflow
Model
Skill
Integration
Document
Channel
Scheduler
```

其中：

```text
核心能力：
Workflow、Agent、Model、Skill、Integration

外围能力：
Chat、Document、Channel、Scheduler
```

`Integration` 指用户自行创建和管理的外部能力，主要包括：

```text
HTTP Integration
MCP Integration
Script Integration
```

它不代表固定的 GitHub、Notion、飞书等第三方业务模块。

---

## 二、总体架构

Soura 采用：

```text
Electron 多进程架构
+
MVVM 前端架构
+
领域模块化
+
Agent / Workflow Runtime
+
Drizzle ORM
+
Zustand
+
shadcn/ui
```

整体数据流：

```text
React View
  ↓
Hooks / Zustand ViewModel
  ↓
Preload API
  ↓
IPC
  ↓
Domain Service
  ↓
Runtime / Database / LLM / Integration
```

---

## 三、MVVM 对应关系

| MVVM 层 | 对应目录 | 职责 |
|---|---|---|
| View | `src/views/` | 页面视图和页面布局 |
| View | `src/components/` | 通用 UI 和业务组件 |
| ViewModel | `src/hooks/` | 页面行为、数据请求、事件处理 |
| ViewModel | `src/stores/` | 使用 Zustand 管理前端状态 |
| ViewModel | `src/lib/` | API、IPC、路由和工具封装 |
| Model | `electron/domains/` | 核心业务领域逻辑 |
| Model | `electron/runtime/` | Agent 和 Workflow 执行逻辑 |
| Model | `electron/database/` | Drizzle ORM 数据持久化 |
| Model | `electron/llm/` | 大模型调用能力 |
| Model | `electron/infrastructure/` | HTTP、MCP、Script 等底层能力 |
| Bridge | `electron/preload/` | Renderer 与 Main 的安全桥接 |
| Transport | `electron/ipc/` | Electron 进程间通信 |

---

## 四、项目文件树

```text
soura/
├── electron/                                  # Electron 主进程
│   ├── main.ts                                # Electron Main 入口
│   ├── app/                                   # 应用生命周期、窗口、托盘
│   ├── preload/                               # Preload 安全桥接层
│   │   ├── api/                               # 暴露给 Renderer 的业务 API
│   │   │   ├── agent/
│   │   │   ├── chat/
│   │   │   ├── workflow/
│   │   │   ├── model/
│   │   │   ├── skill/
│   │   │   ├── integration/
│   │   │   ├── document/
│   │   │   ├── channel/
│   │   │   └── scheduler/
│   │   └── types/                             # Preload API 类型声明
│   ├── ipc/                                   # Main 与 Renderer 的 IPC 通信
│   │   ├── agent/
│   │   ├── chat/
│   │   ├── workflow/
│   │   ├── model/
│   │   ├── skill/
│   │   ├── integration/
│   │   ├── document/
│   │   ├── channel/
│   │   └── scheduler/
│   ├── domains/                               # 核心业务领域
│   │   ├── agent/                             # Agent 定义、配置与工具
│   │   │   ├── services/                      # Agent 业务服务
│   │   │   ├── tools/                         # Agent 工具注册与调用
│   │   │   ├── prompts/                       # Agent 提示词
│   │   │   └── permissions/                   # Agent 权限配置
│   │   ├── workflow/                          # Workflow 定义与编排
│   │   │   ├── nodes/                         # Workflow 节点定义
│   │   │   ├── graph/                         # 节点、边和流程图结构
│   │   │   ├── execution/                     # Workflow 执行逻辑
│   │   │   └── validation/                    # Workflow 验证逻辑
│   │   ├── model/                             # Model 配置、能力与路由
│   │   ├── skill/                             # Skill 加载、注册与管理
│   │   ├── integration/                       # 用户自定义 Integration
│   │   │   ├── http/                          # HTTP Integration 定义
│   │   │   ├── mcp/                           # MCP Integration 定义
│   │   │   ├── script/                        # Script Integration 定义
│   │   │   ├── registry/                      # Integration 注册与发现
│   │   │   ├── validation/                    # Integration 配置验证
│   │   │   └── execution/                    # Integration 统一执行入口
│   │   ├── chat/                              # 会话与消息管理
│   │   ├── document/                          # 文档与知识库管理
│   │   ├── channel/                           # 消息通道管理
│   │   │   ├── adapters/                      # 消息平台适配器
│   │   │   │   ├── telegram/
│   │   │   │   ├── discord/
│   │   │   │   ├── slack/
│   │   │   │   ├── feishu/
│   │   │   │   ├── wecom/
│   │   │   │   ├── webhook/
│   │   │   │   └── builtin/
│   │   │   ├── inbound/                       # 入站消息处理
│   │   │   ├── outbound/                      # 出站消息处理
│   │   │   └── normalization/                 # 消息格式标准化
│   │   └── scheduler/                         # 定时任务定义与管理
│   ├── runtime/                               # Agent、Workflow 和 Integration 运行时
│   │   ├── agent/                             # Agent Runtime
│   │   ├── workflow/                          # Workflow Runtime
│   │   ├── integration/                       # Integration Runtime
│   │   │   ├── http/                          # HTTP 执行运行时
│   │   │   ├── mcp/                           # MCP 执行运行时
│   │   │   └── script/                        # Script 执行运行时
│   │   ├── execution/                         # 执行状态、事件与历史
│   │   ├── approval/                          # 人工审批与确认
│   │   └── cancellation/                      # 任务取消与中断
│   ├── llm/                                   # 大模型调用层
│   │   ├── providers/                         # 模型供应商适配
│   │   ├── streaming/                         # 流式响应处理
│   │   ├── routing/                           # 模型路由与降级
│   │   └── token/                             # Token 统计与限制
│   ├── database/                              # 本地数据库
│   │   ├── drizzle/                           # Drizzle ORM
│   │   │   ├── schema/                        # 数据表结构
│   │   │   │   ├── agent/
│   │   │   │   ├── workflow/
│   │   │   │   ├── model/
│   │   │   │   ├── skill/
│   │   │   │   ├── integration/
│   │   │   │   ├── chat/
│   │   │   │   ├── document/
│   │   │   │   ├── channel/
│   │   │   │   └── scheduler/
│   │   │   ├── relations/                     # 数据表关系
│   │   │   ├── migrations/                    # 数据库迁移
│   │   │   └── seeds/                         # 初始化数据
│   │   ├── repositories/                      # 数据仓储
│   │   └── queries/                           # 复杂查询与事务
│   ├── infrastructure/                       # 底层技术能力
│   │   ├── http-client/                       # HTTP 请求客户端
│   │   ├── mcp-client/                        # MCP Client
│   │   ├── script-runner/                     # Script 执行器
│   │   ├── filesystem/                        # 文件系统能力
│   │   ├── shell/                             # Shell 能力
│   │   └── browser/                           # 浏览器自动化能力
│   ├── storage/                               # 本地文件与密钥存储
│   │   ├── files/
│   │   ├── workspaces/
│   │   ├── secrets/
│   │   └── vectors/
│   ├── scheduler/                             # 调度引擎
│   │   ├── jobs/                              # 调度任务
│   │   ├── triggers/                          # 触发器
│   │   └── persistence/                       # 调度状态持久化
│   ├── security/                              # 安全、权限与审计
│   │   ├── permissions/
│   │   ├── policies/
│   │   ├── sandbox/                           # Script 沙箱策略
│   │   └── audit/
│   └── workers/                               # 后台任务
│       ├── agent/
│       ├── workflow/
│       ├── integration/
│       └── document-index/
│
├── src/                                       # React Renderer
│   ├── main.tsx                               # React 入口
│   ├── App.tsx                                # 应用根组件
│   ├── index.css                              # 全局样式
│   ├── views/                                 # 页面视图
│   │   ├── dashboard/                         # 工作台
│   │   ├── chat/                              # Chat 页面
│   │   ├── agents/                            # Agent 页面
│   │   ├── workflows/                         # Workflow 页面
│   │   ├── models/                            # Model 页面
│   │   ├── skills/                            # Skill 页面
│   │   ├── integrations/                      # Integration 页面
│   │   ├── documents/                         # Document 页面
│   │   ├── channels/                          # Channel 页面
│   │   ├── scheduler/                         # Scheduler 页面
│   │   └── settings/                          # 设置页面
│   ├── components/                            # React 组件
│   │   ├── ui/                                # shadcn/ui 基础组件
│   │   ├── layout/                            # 布局组件
│   │   ├── chat/                              # Chat 业务组件
│   │   ├── agent/                             # Agent 业务组件
│   │   ├── workflow/                          # Workflow 业务组件
│   │   ├── model/                             # Model 业务组件
│   │   ├── skill/                             # Skill 业务组件
│   │   ├── integration/                       # Integration 业务组件
│   │   ├── document/                          # Document 业务组件
│   │   ├── channel/                           # Channel 业务组件
│   │   ├── scheduler/                         # Scheduler 业务组件
│   │   ├── data-table/                        # 数据表格
│   │   ├── code-editor/                       # 代码编辑器
│   │   ├── markdown-editor/                   # Markdown 编辑器
│   │   ├── loading-state/                     # 加载状态
│   │   ├── empty-state/                       # 空状态
│   │   └── error-state/                       # 错误状态
│   ├── hooks/                                 # ViewModel 行为层
│   │   ├── agent/
│   │   ├── chat/
│   │   ├── workflow/
│   │   ├── model/
│   │   ├── skill/
│   │   ├── integration/
│   │   ├── document/
│   │   ├── channel/
│   │   ├── scheduler/
│   │   ├── execution/
│   │   └── common/
│   ├── stores/                                # Zustand 状态管理
│   │   ├── app/
│   │   ├── chat/
│   │   ├── agent/
│   │   ├── workflow/
│   │   ├── execution/
│   │   ├── model/
│   │   ├── skill/
│   │   ├── integration/
│   │   ├── document/
│   │   ├── channel/
│   │   └── scheduler/
│   ├── lib/                                   # 前端基础能力
│   │   ├── api/                               # 业务 API 封装
│   │   ├── ipc/                               # IPC 调用封装
│   │   ├── query/                             # 查询封装
│   │   ├── router/                            # 路由
│   │   ├── validation/                        # 前端表单验证
│   │   ├── formatting/                        # 格式化工具
│   │   ├── error/                             # 错误处理
│   │   └── constants/                         # 常量
│   ├── types/                                 # 前端类型
│   │   ├── agent/
│   │   ├── workflow/
│   │   ├── model/
│   │   ├── skill/
│   │   ├── integration/
│   │   ├── chat/
│   │   ├── document/
│   │   ├── channel/
│   │   ├── scheduler/
│   │   └── execution/
│   ├── providers/                             # React Provider
│   │   ├── query/
│   │   ├── theme/
│   │   └── toast/
│   ├── assets/                                # 静态资源
│   │   ├── icons/
│   │   └── images/
│   └── styles/                                # 全局样式与主题
│
├── resources/                                 # 应用资源
│   ├── icons/
│   ├── templates/
│   └── default-skills/
│
├── data/                                      # 本地运行数据
│   ├── database/
│   ├── documents/
│   ├── skills/
│   ├── integrations/                          # 用户 Integration 配置和脚本
│   │   ├── http/
│   │   ├── mcp/
│   │   └── script/
│   ├── workspaces/
│   ├── logs/
│   └── cache/
│
└── tests/                                     # 测试目录
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 五、Integration 设计

用户创建的 Integration 统一抽象为：

```text
Integration
├── HTTP
├── MCP
└── Script
```

调用链路：

```text
Agent / Workflow
  ↓
Integration Registry
  ↓
Integration Validation
  ↓
Integration Runtime
  ├── HTTP Runtime
  ├── MCP Runtime
  └── Script Runtime
  ↓
Infrastructure Executor
  ├── HTTP Client
  ├── MCP Client
  └── Script Runner
  ↓
统一执行结果
```

各层职责：

```text
domains/integration/
    管理用户 Integration 的定义、配置、注册和验证

runtime/integration/
    负责 Integration 的运行时执行

infrastructure/
    提供 HTTP、MCP、Script 等底层技术实现

data/integrations/
    保存用户创建的 Integration 配置和脚本资源

security/
    控制网络、文件系统、Shell 和 Script 的执行权限
```

---

## 六、Workflow 设计

Workflow 必须将定义、验证和执行分离：

```text
domains/workflow/
├── nodes/
├── graph/
├── validation/
└── execution/
```

职责如下：

```text
nodes/
    节点类型、节点配置和节点能力

graph/
    节点、边、流程图结构和序列化

validation/
    流程结构、节点配置、输入输出和依赖验证

execution/
    Workflow 执行前的编译、运行准备和执行策略
```

运行时位于：

```text
runtime/workflow/
```

主要负责：

- 节点调度
- 条件判断
- 并行执行
- 循环执行
- Agent 节点执行
- Integration 节点执行
- 人工审批
- 任务中断
- 执行事件派发

---

## 七、Channel 设计

Channel 与用户自定义 Integration 分开。

```text
Channel
  ├── Telegram
  ├── Discord
  ├── Slack
  ├── 飞书
  ├── 企业微信
  └── Webhook
```

Channel 结构：

```text
domains/channel/
├── adapters/                              # 各消息平台的适配器
├── inbound/                               # 入站消息处理
├── outbound/                              # 出站消息处理
└── normalization/                         # 消息统一格式转换
```

消息链路：

```text
外部消息平台
  ↓
Channel Adapter
  ↓
Inbound Handler
  ↓
Message Normalization
  ↓
Chat / Agent
  ↓
Outbound Handler
  ↓
Channel Adapter
  ↓
外部消息平台
```

---

## 八、Drizzle ORM 与 Zustand 职责

### Drizzle ORM

Drizzle ORM 位于：

```text
electron/database/drizzle/
```

负责：

- Agent 持久化
- Workflow 持久化
- Integration 持久化
- Chat 和消息持久化
- Channel 配置持久化
- Scheduler 任务持久化
- Execution History 持久化

### Zustand

Zustand 位于：

```text
src/stores/
```

负责：

- 页面状态
- 编辑器状态
- Workflow 画布状态
- 当前会话状态
- Agent 和 Workflow 实时执行状态
- UI 状态
- 临时交互状态

数据库数据不应直接从 React 组件访问，而应通过：

```text
Hook
  ↓
API
  ↓
Preload
  ↓
IPC
  ↓
Domain Service
  ↓
Repository
  ↓
Drizzle ORM
```

---

## 九、执行事件模型

Agent、Workflow 和 Integration 都应支持统一执行事件：

```text
run_started
node_started
message_delta
tool_call
integration_started
approval_required
node_completed
run_completed
run_failed
run_cancelled
```

长任务调用建议返回：

```text
runId
```

执行状态通过事件推送：

```text
Agent / Workflow Runtime
  ↓
Execution Event Bus
  ↓
IPC Event
  ↓
Zustand Store
  ↓
React View
```

---

## 十、架构约束

Renderer 层不应直接访问：

```text
SQLite
Drizzle ORM
Node.js fs
Shell
MCP Client
HTTP Client
ipcRenderer
Electron Main API
```

推荐依赖方向：

```text
src/views/
  ↓
src/components/
  ↓
src/hooks/ + src/stores/
  ↓
src/lib/api/
  ↓
electron/preload/
  ↓
electron/ipc/
  ↓
electron/domains/
  ↓
electron/runtime/
  ↓
electron/database/
electron/llm/
electron/infrastructure/
```

最终总结：

```text
View：
src/views/
src/components/

ViewModel：
src/hooks/
src/stores/
src/lib/

Model：
electron/domains/
electron/runtime/

Persistence：
electron/database/
Drizzle ORM

State：
Zustand

Bridge：
electron/preload/

Communication：
electron/ipc/

Workflow：
domains/workflow/execution/
domains/workflow/validation/

Channel：
domains/channel/adapters/

User Integrations：
domains/integration/
runtime/integration/
data/integrations/
```