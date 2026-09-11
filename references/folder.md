```
soura/
├── electron/                                  # Electron 主进程
│   ├── main.ts                                # Main Process 入口
│   ├── app/                                   # 应用生命周期、窗口、托盘
│   ├── preload/                               # Preload 安全桥接层
│   │   ├── index.ts                           # Preload 入口
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
│   ├── ipc/                                   # IPC 通信处理
│   │   ├── index.ts                           # IPC 注册入口
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
│   │   ├── agent/                             # Agent 管理与执行能力
│   │   │   ├── services/                      # Agent 业务服务
│   │   │   ├── tools/                         # Agent 工具注册与执行
│   │   │   ├── prompts/                       # Agent 提示词
│   │   │   └── runtime/                       # Agent 领域运行逻辑
│   │   ├── workflow/                          # Workflow 编排与定义
│   │   │   ├── nodes/                         # Workflow 节点定义
│   │   │   ├── graph/                         # 流程图结构、边和序列化
│   │   │   ├── execution/                     # Workflow 执行逻辑
│   │   │   └── validation/                    # Workflow 验证逻辑
│   │   ├── model/                             # Model 配置与管理
│   │   ├── skill/                             # Skill 加载、注册与管理
│   │   ├── integration/                       # 外部系统集成管理
│   │   ├── chat/                              # 会话与消息管理
│   │   ├── document/                          # 文档与知识库管理
│   │   ├── channel/                           # 消息通道管理
│   │   │   ├── adapters/                      # Channel 平台适配器
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
│   │   └── scheduler/                         # 定时任务管理
│   ├── runtime/                               # Agent 与 Workflow 运行时
│   │   ├── agent/                             # Agent Runtime
│   │   ├── workflow/                          # Workflow Runtime
│   │   ├── execution/                         # 执行状态、事件与历史
│   │   ├── approval/                          # 人工审批与确认
│   │   └── cancellation/                      # 任务取消与中断
│   ├── llm/                                   # 大模型调用层
│   │   ├── providers/                         # OpenAI、Anthropic、Ollama 等
│   │   ├── streaming/                         # 流式响应处理
│   │   ├── routing/                           # 模型路由与降级
│   │   └── token/                             # Token 统计与限制
│   ├── database/                              # 本地数据库
│   │   ├── drizzle/                           # Drizzle ORM
│   │   │   ├── schema/                        # 数据表结构
│   │   │   ├── relations/                     # 数据表关系
│   │   │   ├── migrations/                    # 数据库迁移
│   │   │   └── seeds/                         # 初始化数据
│   │   ├── repositories/                      # 数据仓储
│   │   └── queries/                            # 查询与事务
│   ├── storage/                               # 本地存储
│   │   ├── files/                             # 文件存储
│   │   ├── workspaces/                        # Agent 工作空间
│   │   ├── secrets/                           # 密钥存储
│   │   └── vectors/                           # 向量数据存储
│   ├── integrations/                          # 本地能力与外部系统适配
│   │   ├── filesystem/                        # 文件系统能力
│   │   ├── shell/                             # Shell 执行能力
│   │   ├── browser/                           # 浏览器自动化
│   │   ├── github/
│   │   ├── notion/
│   │   └── feishu/
│   ├── scheduler/                             # 调度引擎
│   │   ├── jobs/                              # 调度任务
│   │   ├── triggers/                          # 触发器
│   │   └── persistence/                       # 调度状态持久化
│   ├── security/                              # 安全、权限与审计
│   │   ├── permissions/
│   │   ├── policies/
│   │   └── audit/
│   └── workers/                               # 后台任务
│       ├── agent/
│       ├── workflow/
│       └── document-index/
│
├── src/                                       # React Renderer
│   ├── main.tsx                               # React 入口
│   ├── App.tsx                                # 应用根组件
│   ├── index.css                              # 全局样式
│   ├── views/                                 # 页面视图
│   │   ├── dashboard/
│   │   ├── chat/
│   │   ├── agents/
│   │   ├── workflows/
│   │   ├── models/
│   │   ├── skills/
│   │   ├── integrations/
│   │   ├── documents/
│   │   ├── channels/
│   │   ├── scheduler/
│   │   └── settings/
│   ├── components/                            # React 组件
│   │   ├── ui/                                # shadcn/ui 基础组件
│   │   ├── layout/                            # 页面布局组件
│   │   ├── chat/
│   │   ├── agent/
│   │   ├── workflow/
│   │   ├── model/
│   │   ├── skill/
│   │   ├── integration/
│   │   ├── document/
│   │   ├── channel/
│   │   ├── scheduler/
│   │   ├── data-table/
│   │   ├── code-editor/
│   │   ├── markdown-editor/
│   │   ├── loading-state/
│   │   ├── empty-state/
│   │   └── error-state/
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
│   │   ├── router/                            # 路由配置
│   │   ├── validation/                        # 表单与数据校验
│   │   ├── formatting/                        # 格式化工具
│   │   ├── error/                             # 错误处理
│   │   └── constants/                         # 常量
│   ├── types/                                 # 前端类型定义
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
│   └── styles/                                # 主题与全局样式
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
│   ├── workspaces/
│   ├── logs/
│   └── cache/
│
└── tests/                                     # 测试
    ├── unit/
    ├── integration/
    └── e2e/

```