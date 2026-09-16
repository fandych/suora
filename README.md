# SUORA

SUORA 是一个基于 Electron、React 和 TypeScript 的本地优先 AI 工作台。它把模型、对话、Agents、Workflows、Documents、Skills、Integrations、Channels 和 Schedulers 集成在一个桌面应用中，用于构建可复用的 AI 助手与自动化流程。

应用数据默认保存在本机 SQLite 数据库中。API Key、渠道凭据、SMTP 密码和 Webhook Secret 都应按敏感信息处理。

## 功能模块

- **Chats**：持久化对话、流式响应、附件、工具调用、Agent 执行和消息导出。
- **Agents**：配置 instructions、模型、执行步数，以及 Documents、Skills、Workflows 和 Integrations 的访问权限。
- **Workflows**：使用 React Flow 编辑图结构工作流，支持条件、循环、模板、变量、执行记录、取消和 dry-run。
- **Schedulers**：配置 cron、时区、重试策略，并绑定 Agent 或 Workflow。
- **Integrations**：管理 HTTP、MCP 配置和 Script 集成、版本、试运行及执行记录。
- **Documents**：编辑文档、版本、页面/文件树、富文本内容和预览。
- **Skills**：管理版本化 Skill 文件包，并发现 `~/.codex/skills`、`~/.claude/skills` 和 `~/.agents/skills` 中的外部 Skills。
- **Models**：管理多个模型提供商、Custom/OpenAI-compatible 配置和可用的模型发现能力。
- **Channels**：接入 Email、DingTalk、Feishu、Microsoft Teams、Telegram、WeChat、Webhook、WebSocket 和其他渠道运行时。
- **Preference**：管理主题、安全、代理、SMTP、环境监控、更新和应用信息。

## 技术栈

- Electron 43、electron-vite、electron-builder
- React 19、TypeScript 6、React Router、Tailwind CSS、shadcn/base UI
- Vercel AI SDK、OpenAI、Anthropic、OpenAI-compatible providers
- React Flow（`@xyflow/react`）
- Node `node:sqlite`（`DatabaseSync`）与 Drizzle ORM
- Vitest、Testing Library、Playwright 相关脚本

## 环境要求

- Node.js `>= 22.12.0`
- npm
- 支持 Electron 的桌面环境

安装依赖时，`postinstall` 会准备 Electron 二进制。如果下载受到代理、证书检查或网络限制影响，可配置 `HTTP_PROXY`、`HTTPS_PROXY` 或 `ELECTRON_GET_USE_PROXY`。

## 快速开始

```bash
git clone https://github.com/fandych/suora.git
cd suora
npm ci
npm run dev
```

在需要关闭主窗口 Chromium sandbox 的环境中，可以使用 `npm run dev:root`。该命令设置 `NO_SANDBOX=1`，仅适用于明确需要此配置的开发环境。重新准备 Electron 二进制可运行 `npm run electron:download`。

首次使用建议：先在 **Models** 中添加 provider 和模型，再在 **Chats** 中创建对话；随后配置 **Agents**、**Workflows**、**Integrations**、**Channels** 和 **Schedulers**。

## 项目结构

```text
src/
├── App.tsx                 # Renderer 路由入口
├── main.tsx                # Renderer 启动入口
├── components/             # 全局业务组件；ui/ 为 shadcn/base primitives
├── pages/                  # 路由页面及页面级组件
├── services/               # Renderer 侧业务 facade
├── stores/                 # Zustand stores，扁平目录
├── hooks/、lib/、types/    # 通用 hooks、工具和跨进程类型契约
├── drizzle/                # SQLite schema、迁移和 Drizzle 适配
└── electron/
    ├── main.ts             # Electron 主进程入口
    ├── preload.ts          # contextBridge API
    ├── app/                # 按业务域组织的应用服务、repository 和 runtime
    ├── infrastructure/    # 数据库、凭据、网络、窗口和更新基础设施
    └── preload/            # 按业务域注册 IPC handlers
tests/                      # Vitest 单元和集成测试
scripts/                    # 类型检查、架构验证和 smoke tests
github-pages/               # 独立的文档网站项目
```

Renderer 不直接使用 Node API 或 SQLite。`src/electron/preload.ts` 在 context isolation 下通过 `window.app` 暴露受控业务 API，`src/services/` 负责消费这些 API。数据库、外部网络、文件/命令工具、AI 请求、渠道运行时和凭据处理都在主进程完成。主窗口使用 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: false`；内置 Browser 工具窗口使用 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。

共享类型声明、请求/响应契约和可序列化 DTO 统一放在 `src/types/`。页面和组件只负责展示、交互与 UI 状态；不直接实现数据库、文件系统、命令、网络、凭据或 Electron 运行时逻辑。业务规则、repository、runtime、执行器和外部系统访问放在 `src/electron/app/`，IPC handler 放在 `src/electron/preload/`，Renderer 通过 `src/services/` 和受控 preload API 调用主进程。

## 路由

根路径重定向到 `/chats`。当前一级模块为 `/chats`、`/agents`、`/workflows`、`/schedulers`、`/integrations`、`/documents`、`/channels`、`/skills`、`/models` 和 `/preference/:section`。Preference section 包括 `general`、`security`、`mail-service`、`environment-monitor`、`global-environment` 和 `about`。业务模块还提供对应详情路由。

## 数据库与本地数据

Electron 主进程使用 Node `node:sqlite` 的 `DatabaseSync`，通过 Drizzle schema 和迁移管理数据库。迁移位于 `src/drizzle/migrations/`，schema 位于 `src/drizzle/schema/`，启动时执行迁移并启用 WAL 与 foreign key 约束。

数据库位置为 `<Electron userData>/workspace/suora.sqlite`，具体路径由 `app.getPath("userData")` 决定。Renderer 只能通过 IPC 调用受限业务接口，不能执行任意 SQL。

## 外部服务与安全边界

- `safeStorage` 用于保护 API Key、SMTP 密码、渠道 Token/Secret 等敏感配置；其安全性依赖操作系统安全存储能力。
- 命令、文件、Browser、HTTP、MCP 和 Script 工具受策略约束，但仍可能产生外部副作用，请遵循最小权限原则。
- Script 在独立 Node worker 中运行，并使用 `node:vm`、源码检查、大小限制和超时限制；这不是经过安全审计的强隔离边界。
- MCP 支持 HTTP endpoint 探测和受命令策略约束的 `launchCommand`，不应夸大为完整通用 MCP client/transport 实现。
- `ignoreSslErrors` 会降低 TLS 校验安全性，除非调试需要，不应启用。
- 渠道 HTTP runtime 默认绑定 `127.0.0.1:3000`，提供 `/health` 和 `/webhook/:platform/:channelId`。`WEBHOOK_HOST`、`WEBHOOK_PORT` 和 `NODE_ENV` 只影响生成/显示的 URL，不会让服务自动监听公网地址。

Workflow 当前限制包括最多 200 个节点、400 条边，`maxSteps` 为 1–1000，最长执行时间为 1 小时。具体节点语义以 `src/electron/app/workflows/nodes/` 的实现为准。

## 开发命令

- `npm run dev`：启动 Electron 开发环境。
- `npm run dev:root`：使用 `NO_SANDBOX=1` 启动开发环境。
- `npm run build`：构建 main、preload 和 renderer。
- `npm run package`：构建并打包当前平台；`npm run package:win` 构建 Windows NSIS 和 portable 包。
- `npm run db:generate` / `npm run db:migrate`：生成或执行 Drizzle migration。
- `npm run format` / `npm run format:check`：格式化或检查格式。
- `npm run type-check` / `npm run lint`：类型检查和 ESLint。
- `npm run test` / `npm run test:run`：Vitest watch 或单次运行。
- `npm run test:coverage` / `npm run test:ui`：覆盖率测试或 Vitest UI。
- `npm run ci`：类型检查、lint、测试、覆盖率和构建。
- `npm run test:e2e*`、`npm run smoke:electron`：条件式 E2E、工作流和启动 smoke 检查。
- `npm run verify:architecture`：验证架构约束。

常规修改至少应执行：

```bash
npm run type-check
npm run lint
npm run test:run
npm run build
```

工作流 smoke 和 Electron/Playwright 测试可能需要桌面环境、已启动的 Electron 实例、DevTools Protocol 端口或外部 API，不能默认视为无依赖 CI 测试。

## 构建与许可证

`npm run build` 生成 `out/main`、`out/preload` 和 `out/renderer`。electron-builder 支持 Windows NSIS/portable、macOS DMG/ZIP 以及 Linux AppImage/DEB/RPM；跨平台包应在目标平台或对应 CI runner 上构建。

请先阅读 [`AGENTS.md`](AGENTS.md)，保持 renderer/main/preload 边界，并避免直接修改 `src/components/ui/` 中的上游 UI primitives。仓库当前未声明许可证，使用、分发或二次开发前请联系项目维护者确认许可范围。
