# AGENTS.md

本文件是 SUORA 仓库的编码代理协作规范。所有改动都应以当前代码为准；不要根据旧版本目录、历史路线或不存在的抽象层做假设。

## 项目定位

SUORA 是 Electron 桌面端 AI 工作台，包含 Chats、Agents、Workflows、Schedulers、Integrations、Documents、Channels、Skills、Models 和 Preference。Renderer 使用 React/TypeScript，Electron 主进程负责数据库、AI 请求、外部集成、工具和运行时能力。

产品用语统一使用 `workflow` / `workflows`。新 UI、路由、类型和文档中不要引入旧的 `pipeline` 命名；只有在兼容旧行为或迁移说明时才可以提及。旧 `timer` 概念对应 `scheduler`，MCP 相关入口应归入 `integrations`。

## 当前架构

```text
src/
├── App.tsx                 # Renderer 路由入口
├── main.tsx                # Renderer 启动入口
├── components/             # 全局业务组件
│   └── ui/                 # shadcn/base UI primitives
├── pages/                  # 路由页面和页面级组件
├── services/               # Renderer 业务 facade，消费 window.app
├── stores/                 # Zustand stores，扁平目录
├── hooks/                  # 通用 React hooks
├── lib/                    # Renderer 工具、浏览器、聊天和序列化辅助
├── types/                  # 跨进程可序列化类型契约
├── drizzle/                # SQLite schema、迁移和 Drizzle 适配
└── electron/
    ├── main.ts             # Electron 主进程入口
    ├── preload.ts          # contextBridge 和受控 renderer API
    ├── app/                # 按业务域组织的应用服务、repository、runtime
    ├── infrastructure/    # 数据库、凭据、网络、窗口、代理和更新
    └── preload/            # 按业务域注册 ipcMain handlers

tests/                      # Vitest 单元和集成测试
scripts/                    # 类型检查、架构验证和条件式 smoke tests
github-pages/               # 独立文档网站，不属于主应用 renderer
```

`src/electron/app/` 的业务域包括 `agents`、`channels`、`chats`、`documents`、`integrations`、`models`、`preferences`、`schedulers`、`skills`、`system`、`tools` 和 `workflows`。新增主进程业务代码应放入对应域，而不是创建根级杂项目录。

不要创建或继续使用不存在的旧层：`src/views/`、`src/view-models/`、`src/application/`、`src/domain/`、`src/data/domain/`、`src/data/repositories/`、`src/electron/others/`、`src/electron/database/` 和 `src/lib/ipc/`。如果新能力暂时无法归入现有域，先检查相邻模块和现有 service/IPC 结构，再决定是否需要新的业务域。

## 文件结构管理

新增文件前必须先判断它属于哪个进程、业务域和职责层，不能因为文件较小就放入根目录或随意创建新目录。

- **类型声明**：跨文件或跨进程使用的 TypeScript `type`、`interface`、请求/响应契约和可序列化 DTO，必须放在 `src/types/`，并按业务域命名。不要把共享类型散落在页面、组件或 Electron handler 中。
- **Renderer 类型**：只供单个页面或组件使用的局部类型，可以放在所属 `src/pages/<module>/` 或组件文件附近；一旦被多个模块、service、store 或进程使用，就迁移到 `src/types/`。
- **UI 代码**：React 页面放在 `src/pages/`，业务组件放在 `src/components/` 或所属页面的 `components/`；只负责展示、交互和页面状态，不直接实现数据库、文件系统、命令、网络、凭据或 Electron 运行时逻辑。
- **Renderer service/store**：`src/services/` 只负责封装 Renderer 对 `window.app` 的调用、事件订阅和 UI 侧数据转换；`src/stores/` 负责 UI 状态、缓存和调用 service，不承载主进程业务规则。
- **业务逻辑**：不直接操作 UI 的业务规则、用例、repository、runtime、执行器和外部系统访问，必须放在 `src/electron/app/<module>/`。通用的平台能力放在 `src/electron/infrastructure/`，不要放入页面或组件目录。
- **IPC 桥接**：Renderer 与主进程之间的调用必须经过 `src/electron/preload.ts` 暴露的受控 API；IPC handler 和输入校验放在 `src/electron/preload/<module>/`。不要在页面中直接导入 Electron、Node、repository 或 handler。
- **数据库**：schema 和迁移放在 `src/drizzle/`；数据库连接、事务和主进程数据库基础设施放在 `src/electron/infrastructure/`；具体查询和 repository 放在拥有数据的 `src/electron/app/<module>/`。
- **通用工具**：Renderer 专用工具放在 `src/lib/`，主进程专用工具放在对应 Electron 业务域或 `src/electron/infrastructure/`。不要创建含义模糊的 `utils/`、`helpers/` 或根级杂项目录来绕过归属判断。
- **测试**：测试放在 `tests/`，并按被测层或业务域组织；不要把测试夹杂在生产目录中，除非现有工具链明确要求。

文件归属应遵循“数据和副作用靠近主进程，展示和交互靠近 Renderer，跨边界契约集中在 `src/types/`”的原则。新增业务能力时，优先扩展现有模块，不要创建重复的 service、repository、IPC 或类型层。

## 进程边界

### Renderer

页面位于 `src/pages/`，全局组件位于 `src/components/`，Renderer service 位于 `src/services/`，状态位于扁平的 `src/stores/`。Renderer 不直接导入 Node API、Electron API、SQLite、文件系统或主进程 repository。

Renderer 通过 `src/electron/preload.ts` 暴露的 `window.app` 访问主进程能力。页面层不应散落直接的 `window.app` 调用；优先在对应 `src/services/<module>-service.ts` 中封装，再由页面或 store 使用。

业务逻辑不得为了复用而放入 React 组件。组件只处理 props、用户事件、渲染和必要的局部 UI 状态；跨页面状态放入 store，主进程业务逻辑放入 Electron app 层。

### Main

`src/electron/main.ts` 负责 Electron 启动、workspace、数据库迁移、应用初始化、IPC、窗口和渠道 runtime。数据库、AI 请求、外部 HTTP/MCP、命令/文件工具、Browser 工具、SMTP、凭据和更新等能力必须留在主进程。

业务逻辑放入 `src/electron/app/<module>/`，平台和安全能力放入 `src/electron/infrastructure/`。repository 应归属于拥有该数据的业务域；不要把领域查询移回 Renderer。

### Preload 与 IPC

`src/electron/preload.ts` 使用 `contextBridge` 暴露受控业务 API；`src/electron/preload/` 按业务域注册 `ipcMain.handle` 处理器。新增 IPC 必须：

1. 放入拥有该能力的 preload 业务域。
2. 为输入参数定义并执行运行时 schema 校验。
3. 只暴露必要字段和最小权限。
4. 对 ID、URL、邮箱、payload、消息大小、超时和路径进行边界检查。
5. 将可序列化的请求/响应类型放入 `src/types/`。
6. 为安全策略、权限和错误路径补充测试。

主窗口当前配置为 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: false`。Browser 工具窗口为 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。不要把主窗口描述为 sandbox 已启用，也不要为方便而打开 Node integration。

## 路由与页面

路由入口是 `src/App.tsx`，路由元数据和一级导航是 `src/pages/nav-config.ts`。当前一级路由为：

- `/chats`
- `/agents`
- `/workflows`
- `/schedulers`
- `/integrations`
- `/documents`
- `/channels`
- `/skills`
- `/models`
- `/preference/:section`

根路径重定向到 `/chats`，当前没有 `/dashboard` 路由。Preference section 由 `src/pages/nav-config.ts` 的 `preferenceSections` 定义。

页面应从所属模块开始设计，优先复用已有 layout、detail page、列表、编辑器和 sidebar 组件。详情路由、加载态、错误态、空态和保存状态应保持一致。不要为了单个页面复制一套主布局或导航。

## 动态数据和侧边栏

导航元数据属于 `src/pages/nav-config.ts`。运行时列表、异步加载、缓存和 mutation 属于对应页面/store/service，不要把未来会来自数据库或 IPC 的实体列表硬编码进路由配置。

当前侧边栏实现位于 `src/pages/components/` 及其 `secondary-sidebar/` 子目录。新增动态 sidebar 数据时，应保持已有 item/group 渲染契约，使 mock adapter 可以替换为真实 service，而无需改动通用渲染组件。

## 数据库规则

数据库使用 Node `node:sqlite` 的 `DatabaseSync` 与 Drizzle ORM，代码位于 `src/drizzle/` 和 `src/electron/infrastructure/`。迁移放入 `src/drizzle/migrations/`，schema 放入 `src/drizzle/schema/`。不要将运行时数据库描述为 sql.js，也不要给 Renderer 暴露任意 SQL bridge。

数据库路径由 Electron `app.getPath("userData")` 决定，默认是 `<userData>/workspace/suora.sqlite`。需要修改 schema 时，更新 schema、migration、repository contract 和相关测试；不要直接修改用户数据库或提交本地数据库文件。

## 业务模块约定

- Chats：聊天持久化、流式 runtime 和工具调用归 `src/electron/app/chats/`。
- Agents：Agent 定义、版本、资源授权和内置 Agent 归 `src/electron/app/agents/`。
- Workflows：图结构、节点、执行器、trace、表达式和 invocation 归 `src/electron/app/workflows/`；新 UI 统一使用 workflow。
- Schedulers：cron、时区、重试、绑定和运行记录归 `src/electron/app/schedulers/`。
- Integrations：HTTP、MCP、Script、版本和执行记录归 `src/electron/app/integrations/`。
- Documents：文档、版本、页面树、预览和编辑内容归 `src/electron/app/documents/`。
- Skills：Skill 文件、版本和外部目录发现归 `src/electron/app/skills/`。
- Models：provider registry、凭据、模型配置和 discovery 归 `src/electron/app/models/`。
- Channels：provider、Webhook、stream、polling、消息队列和 runtime 归 `src/electron/app/channels/`。
- Preference：主题、安全、代理、SMTP、环境和更新配置归 `src/electron/app/preferences/`。

## 安全要求

- API Key、SMTP 密码、渠道 Token/Secret 和 Webhook Secret 是敏感数据。使用 `safeStorage` 和现有 credential vault，不要把明文凭据返回 Renderer、写入日志或提交 Git。
- 保存敏感字段时，空白值应遵循现有“保留主进程凭据”的行为；新增字段必须明确是否脱敏和是否提供 `*Configured` 状态。
- 命令执行使用现有命令策略和 `shell: false` 边界。不要拼接 shell 字符串，不要绕过 workspace command policy。
- HTTP、Browser、MCP、Webhook 和 Script 都可能访问外部系统或产生副作用。校验 URL、协议、大小、超时、重定向和来源，并以最小权限授权 Agent/Workflow。
- Script worker 使用 `node:vm` 和限制，但不是强隔离或安全审计边界；不要把它宣传为可安全执行任意不可信代码。
- `ignoreSslErrors` 会降低 TLS 安全性，默认保持关闭。
- 渠道 HTTP runtime 默认绑定 `127.0.0.1`；修改公网暴露、Webhook 签名、凭据、命令或文件访问时，必须同步更新测试和文档。

## 代码质量

- TypeScript/TSX 单文件不超过 400 行；接近上限时拆分到所属模块的 `components/`、helper 或 service。
- 使用 `@/` 路径别名导入本仓库代码，不新增 `../` 或 `./` 本地导入。
- 类型声明文件统一归档到 `src/types/`；不要在根目录、`src/electron/` 根目录或独立的 `types/` 目录新增共享类型文件。
- 不要让 Renderer 直接操作 Node API、Electron API、SQLite、文件系统、子进程、外部网络或主进程 repository；必须通过 service 和 preload IPC 边界。
- 不要把只负责业务逻辑的 `.ts` 文件放入页面或组件目录；应放入所属 `src/electron/app/`、`src/electron/infrastructure/` 或对应的 Renderer `services`/`lib`。
- 不要在 Renderer 复制主进程的校验、权限、凭据、路径或副作用逻辑；这些规则必须由主进程作为安全边界执行。
- 优先组合 `src/components/ui/` 中已有的 shadcn/base primitives。该目录是上游 UI 源文件，业务重构不要直接重写、拆分、格式化或改主题。
- 不使用脚本或批量替换改写业务源码；采用可审查的定点修改。
- 每次行为、路由、运行时限制、安全边界、命令或用户可见配置变更，都同步更新适用的 `README.md` 或 `github-pages/src/pages/` 文档。
- 路由、模块覆盖或架构规则改变时，同步更新本文件。

## 验证流程

完成代码修改后，按相关性运行：

```bash
npm run format
npm run format:check
npm run type-check
npm run lint
npm run test:run
npm run build
```

常规交付至少要求 `npm run type-check`、`npm run lint`、`npm run test:run` 和 `npm run build` 通过。数据库、IPC、安全或 runtime 改动应增加相关单元/集成测试；工作流和渠道改动应在条件允许时运行对应 smoke 脚本。

`npm run test:e2e*`、`npm run smoke:electron` 和工作流 smoke 可能需要桌面环境、已启动 Electron、DevTools Protocol 端口或外部 API；不要把这些条件式检查当作无依赖单元测试。`npm run ci` 当前执行 type-check、lint、test、coverage 和 build，不要擅自把它描述为包含额外 Git 检查。

如果使用 `npm run dev` 进行验证，结束前停止开发进程。不要提交 `out/`、`coverage/`、本地数据库、日志、凭据或其他生成文件。
