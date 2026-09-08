# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
You can also try [the experimental native React Compiler support in plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#rust-react-compiler) by using `compiler: true` in the plugin options instead of using the Babel plugin.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  # SUORA

  SUORA 是一个基于 **Electron、React 和 TypeScript** 构建的本地优先 AI 工作台。它将模型配置、对话、Agent、文档、Skills、工作流、外部集成与消息渠道集中在一个桌面应用中，帮助个人和团队搭建可复用的 AI 自动化能力。

  > 工作区数据保存在本机 SQLite 数据库中。请妥善管理模型 API Key、SMTP 密码和渠道凭据，并仅在可信环境中启用工具调用与外部集成。

  ## 功能概览

  - **Chats**：流式 AI 对话、会话持久化、附件与工具调用结果。
  - **Models**：管理 OpenAI、Anthropic、Gemini、Azure、Ollama 与 OpenAI-compatible 等模型提供商，支持刷新部分远程模型目录。
  - **Agents**：为 Agent 配置系统提示、模型、最大执行步数及可访问的文档、Skills、工作流和集成。
  - **Workflows**：以可视化节点编排 AI、文档检索、条件分支、变量模板、HTTP/Webhook、脚本、SMTP、循环及并行任务，并支持手动运行与 dry-run。
  - **Documents**：维护版本化文档及其页面、图结构内容。
  - **Skills**：管理版本化 Skill 文件包，并发现用户目录中的 `.codex/skills`、`.claude/skills` 与 `.agents/skills`。
  - **Integrations**：连接 HTTP、MCP 探测/命令启动和沙箱脚本集成，保留执行记录。
  - **Channels**：接入 Web、邮箱、企业微信、飞书、钉钉、Telegram、Teams 和自定义 Webhook/WebSocket 等消息入口。
  - **Schedulers**：维护 cron、时区、重试和错过执行策略等调度配置。
  - **Preference**：设置主题、语言、网络代理、工具权限、SMTP、更新和 TLS 选项。

  ## 技术栈

  - 桌面运行时：[Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/)
  - 前端：[React 19](https://react.dev/)、TypeScript、React Router、Tailwind CSS、shadcn/ui
  - AI：[Vercel AI SDK](https://sdk.vercel.ai/)，包含 OpenAI、Anthropic 与 OpenAI-compatible Provider
  - 工作流：[React Flow](https://reactflow.dev/)
  - 本地数据：SQLite（`node:sqlite`）+ Drizzle ORM
  - 测试：Vitest、Playwright

  ## 环境要求

  - Node.js **>= 22.12.0**
  - npm（仓库提供 `package-lock.json`）

  Electron 会在依赖安装后准备对应二进制。网络受限、使用企业代理或 TLS 检查时，请先配置 `HTTP_PROXY`、`HTTPS_PROXY` 或 `ELECTRON_GET_USE_PROXY`。

  ## 快速开始

  ```bash
  git clone https://github.com/fandych/suora.git
  cd suora
  npm ci
  npm run dev
  ```

  在 root 或需要关闭 Chromium sandbox 的环境中，使用：

  ```bash
  npm run dev:root
  ```

  若 Electron 二进制下载失败，可重新下载：

  ```bash
  npm run electron:download
  ```

  ### 首次使用

  1. 在 **Models** 中选择或创建模型提供商，填写 Base URL 和 API Key，并启用至少一个模型。
  2. 在 **Chats** 选择模型或 Agent 后发起对话。
  3. 在 **Agents** 中为任务设置 instructions，并授权所需的文档、Skills、工作流和集成。
  4. 在 **Workflows** 中创建流程，通过 dry-run 检查执行路径，再按需手动运行。
  5. 在 **Integrations**、**Channels** 和 **Preference** 中配置外部服务、消息入口、SMTP 与安全策略。

  空白工作区首次使用时，部分模块可能会写入演示数据以展示功能。

  ## 模型与网络配置

  SUORA 提供 OpenAI、Azure、Google Gemini、Anthropic、DeepSeek、通义千问、Kimi、OpenRouter、Groq、Ollama 和 Custom 等预设。Ollama 默认地址为 `http://localhost:11434/v1`，无需 API Key 也可启用。

  部分 OpenAI-compatible 服务可从 `GET {baseUrl}/models` 刷新模型列表；Ollama 可从 `GET {baseUrl}/api/tags` 刷新。Azure、Anthropic、Google Gemini 与 Vercel AI Gateway 当前不支持远程模型发现。

  Preferences 中可配置 HTTP/HTTPS 代理、命令和文件访问许可、SMTP、请求超时及 TLS 验证。请勿在生产或不受控网络中启用“忽略 SSL 错误”。SOCKS5 配置类型尚未实现。

  ## 工作流与集成

  工作流使用图结构保存，单个工作流最多 200 个节点、400 条边；最大执行步数范围为 1–1000，最长执行时间为 1 秒至 1 小时。dry-run 会跳过 AI、HTTP、Webhook、工具集、脚本及 SMTP 等副作用节点。

  集成能力包括：

  - **HTTP**：支持常用方法、查询/头/body 参数、Bearer/Basic/API Key/自定义认证，以及 JSON、URL encoded 和 multipart 表单。
  - **MCP**：支持 HTTP endpoint 探测或启动 `launchCommand`；目前不是完整的 MCP transport 与工具发现客户端。
  - **Scripts**：在 Node `vm` 沙箱运行。`require`、`process`、文件系统、动态 `import`、`eval` 与 `new Function` 均不可用，最长执行 60 秒。

  HTTP 请求响应大小、上传文件和超时均受应用限制。请只连接可信服务，并避免将敏感信息写入脚本或日志。

  ## 消息渠道

  渠道运行时默认监听 `127.0.0.1:3000`，提供以下端点：

  ```text
  GET  /health
  GET  /webhook/:platform/:channelId
  POST /webhook/:platform/:channelId
  ```

  可通过环境变量生成面向公网的 Webhook 地址：

  ```bash
  WEBHOOK_HOST=example.com
  WEBHOOK_PORT=443
  NODE_ENV=production
  ```

  这些变量只影响应用显示/生成的地址；运行时仍默认绑定本地回环地址。若第三方平台需要回调，请自行通过反向代理、端口映射或其他安全的公网暴露方案转发请求。

  ## 架构

  ```mermaid
  flowchart LR
    R[React Renderer<br/>src/] --> P[Preload Bridge<br/>electron/preload.ts]
    P --> I[Electron IPC handlers<br/>electron/ipc/]
    I --> S[Desktop services<br/>AI / channels / integrations / tools]
    I --> D[(Local SQLite<br/>userData/workspace/suora.sqlite)]
    S --> X[LLM APIs / HTTP / MCP / SMTP / channels]

    R --> W[Repositories & domain layer<br/>src/data/]
    W --> P
  ```

  - `src/`：React 渲染进程、页面、领域模型、仓储和服务层。
  - `electron/preload.ts`：在 context isolation 下暴露受控的 `window.suora` API。
  - `electron/ipc/`：按业务域注册 Electron IPC handlers。
  - `electron/database/`：SQLite 初始化、迁移与数据库核心。
  - `electron/others/`：AI 请求、渠道、集成、代理、更新与系统工具等桌面服务。

  本地数据库默认位于 Electron `userData/workspace/suora.sqlite`。当前未提供应用级密钥加密或系统钥匙串集成，因此请保护设备用户目录和数据库备份。

  ## 开发命令

  | 命令 | 说明 |
  | --- | --- |
  | `npm run dev` | 启动 Electron 开发环境。 |
  | `npm run dev:root` | 以 `NO_SANDBOX=1` 启动开发环境。 |
  | `npm run lint` | 执行 ESLint。 |
  | `npm run type-check` | 执行 TypeScript 类型检查。 |
  | `npm run test` | 以 watch 模式运行 Vitest。 |
  | `npm run test:run` | 单次运行 Vitest。 |
  | `npm run test:coverage` | 运行测试并生成覆盖率。 |
  | `npm run build` | 使用 electron-vite 构建应用。 |
  | `npm run preview` | 预览构建产物。 |
  | `npm run package` | 构建并使用 electron-builder 打包当前平台。 |
  | `npm run package:win` | 构建 Windows NSIS 与 portable 安装包。 |
  | `npm run test:e2e` | 运行 Playwright E2E 测试。 |
  | `npm run test:e2e:workflows` | 执行工作流冒烟场景。 |
  | `npm run test:e2e:full-chain` | 执行完整链路冒烟场景。 |

  工作流冒烟脚本要求已启动一个开放 `127.0.0.1:9222` Chrome DevTools Protocol 的 Electron 实例，并可能写入本地数据或调用外部 API；请勿将其作为无条件的 CI 测试步骤。

  ## 构建与发布

  ```bash
  npm run lint
  npm run type-check
  npm run test:run
  npm run build
  npm run package
  ```

  `npm run build` 会生成 `out/main`、`out/preload` 和 `out/renderer`。打包配置支持 Windows（NSIS、portable）、macOS（DMG、ZIP）和 Linux（AppImage、DEB、RPM）。跨平台安装包通常应在对应平台的 CI 或构建环境中生成。

  ## 安全说明

  - 将 API Key、渠道凭据和 SMTP 密码视为敏感数据；不要提交数据库、日志或包含密钥的配置到版本库。
  - 为 Agent 最小化授予文档、工作流、集成、命令与文件系统访问权限。
  - 仅信任已审查的工作流、脚本和 HTTP/MCP 服务。
  - 启用 Webhook 前，请验证来源签名、网络边界和反向代理策略。

  ## 贡献

  提交前请确保：

  ```bash
  npm run lint
  npm run type-check
  npm run test:run
  npm run build
  ```

  请遵循仓库中的 [`AGENTS.md`](AGENTS.md) 约定：新 UI 使用 `workflow` 命名，保持页面结构可复用，并避免修改 `src/components/ui` 中的 shadcn 源文件。

  ## License

  本仓库当前未声明许可证。使用、分发或二次开发前，请先联系项目维护者确认许可范围。
