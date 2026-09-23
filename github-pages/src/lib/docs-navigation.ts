import type { LucideIcon } from "lucide-react"
import { BookOpenIcon, BoxesIcon, RocketIcon } from "lucide-react"

import { docsSiteMetadata } from "@/lib/docs-site"

export const docLocales = ["zh", "en"] as const
export type DocLocale = (typeof docLocales)[number]

export const defaultDocLocale: DocLocale = "zh"

type LocalizedText = Record<DocLocale, string>

export type DocItem = {
  title: string
  path: string
  description: string
}

export type DocSection = {
  title: string
  icon: LucideIcon
  items: DocItem[]
}

type CanonicalDocItem = {
  path: string
  title: LocalizedText
  description: LocalizedText
}

type CanonicalDocSection = {
  title: LocalizedText
  icon: LucideIcon
  items: CanonicalDocItem[]
}

const canonicalDocumentationSections: CanonicalDocSection[] = [
  {
    title: { zh: "开始使用", en: "Get Started" },
    icon: RocketIcon,
    items: [
      { title: { zh: "概览", en: "Overview" }, path: "/doc", description: { zh: "认识 SUORA 文档站", en: "Start with the SUORA documentation portal" } },
      {
        title: { zh: "安装与启动", en: "Installation & Startup" },
        path: "/doc/getting-started/installation",
        description: { zh: "安装桌面应用并配置首个模型", en: "Install the desktop app and configure the first model" },
      },
    ],
  },
  {
    title: { zh: "用户文档", en: "User Docs" },
    icon: BookOpenIcon,
    items: [
      { title: { zh: "聊天", en: "Chats" }, path: "/doc/chat/overview", description: { zh: "创建会话、发送消息与导出转录", en: "Create chats, send messages, and export transcripts" } },
      { title: { zh: "工作流", en: "Workflows" }, path: "/doc/workflows/overview", description: { zh: "设计、验证、发布并运行工作流", en: "Design, validate, publish, and run workflows" } },
      { title: { zh: "智能体", en: "Agents" }, path: "/doc/agents/overview", description: { zh: "配置模型、资源范围与工具边界", en: "Configure models, resource scope, and tool boundaries" } },
      { title: { zh: "文档", en: "Documents" }, path: "/doc/documents/overview", description: { zh: "组织页面、资源与本地知识", en: "Organize pages, assets, and local knowledge" } },
      { title: { zh: "技能", en: "Skills" }, path: "/doc/skills/overview", description: { zh: "创建、组织并复用本地技能包", en: "Create, organize, and reuse local skill bundles" } },
      { title: { zh: "集成", en: "Integrations" }, path: "/doc/integrations/overview", description: { zh: "连接 HTTP、脚本和 MCP 端点", en: "Connect HTTP, script, and MCP endpoints" } },
      { title: { zh: "渠道", en: "Channels" }, path: "/doc/channels/overview", description: { zh: "接入外部消息平台与自动回复", en: "Connect external messaging platforms and auto replies" } },
      { title: { zh: "调度器", en: "Schedulers" }, path: "/doc/schedulers/overview", description: { zh: "维护工作流和智能体的调度配置", en: "Maintain workflow and agent scheduling configs" } },
      { title: { zh: "模型", en: "Models" }, path: "/doc/models/overview", description: { zh: "配置提供商、模型和远程模型目录", en: "Configure providers, models, and remote model catalogs" } },
      { title: { zh: "偏好设置", en: "Preferences" }, path: "/doc/preferences/overview", description: { zh: "设置外观、工具策略、SMTP 和更新行为", en: "Configure appearance, tool policy, SMTP, and updates" } },
    ],
  },
  {
    title: { zh: "技术文档", en: "Technical Docs" },
    icon: BoxesIcon,
    items: [
      { title: { zh: "应用架构", en: "Architecture" }, path: "/doc/technical/architecture", description: { zh: "Renderer、IPC 与本地服务", en: "Renderer, IPC, and local services" } },
      { title: { zh: "IPC 通信", en: "IPC" }, path: "/doc/technical/ipc", description: { zh: "Preload、IPC handlers 与安全边界", en: "Preload, IPC handlers, and safety boundaries" } },
      { title: { zh: "SQLite 数据层", en: "SQLite Data Layer" }, path: "/doc/technical/database", description: { zh: "Migration、Schema 与本地持久化", en: "Migrations, schema, and local persistence" } },
      { title: { zh: "AI 服务与工具", en: "AI Services & Tools" }, path: "/doc/technical/ai", description: { zh: "Provider、ToolLoopAgent 与工具护栏", en: "Providers, ToolLoopAgent, and tool guardrails" } },
      { title: { zh: "工作流引擎", en: "Workflow Engine" }, path: "/doc/technical/workflow-engine", description: { zh: "图调度、节点执行与运行时语义", en: "Graph scheduling, node execution, and runtime semantics" } },
      { title: { zh: "渠道运行时", en: "Channel Runtime" }, path: "/doc/technical/channel-runtime", description: { zh: "Webhook、Stream、消息队列与健康检查", en: "Webhooks, streams, message queues, and health checks" } },
      { title: { zh: "测试与发布", en: "Testing & Release" }, path: "/doc/technical/testing-release", description: { zh: "测试、CI、打包与发布流程", en: "Testing, CI, packaging, and release flows" } },
      { title: { zh: "生产发布检查清单", en: "Production Release Checklist" }, path: "/doc/technical/production-checklist", description: { zh: "上线前的人工作业与风险核对项", en: "Pre-release operational and risk checks" } },
      { title: { zh: "安全护栏", en: "Security Guardrails" }, path: "/doc/technical/security", description: { zh: "URL、工具、脚本、MCP 与 IPC 安全边界", en: "URL, tools, scripts, MCP, and IPC boundaries" } },
      { title: { zh: "浏览器工具", en: "Browser Tools" }, path: "/doc/technical/browser", description: { zh: "浏览器会话、页面读取与表单操作", en: "Browser sessions, page reads, and form actions" } },
      { title: { zh: "开发与发布", en: "Development & Delivery" }, path: "/doc/technical/development", description: { zh: "质量检查、构建与发布", en: "Quality checks, builds, and delivery" } },
    ],
  },
]

export const docsUiMessages: Record<
  DocLocale,
  {
    siteTitle: string
    githubProject: string
    githubButton: string
    breadcrumbRoot: string
    notFoundTitle: string
    notFoundDescription: string
    notFoundBack: string
    loading: string
    languageLabel: string
    zhLabel: string
    enLabel: string
    homeTitle: string
    homeDescription: string
    releaseButton: string
    latestReleaseLabel: string
  }
> = {
  zh: {
    siteTitle: docsSiteMetadata.brandName,
    githubProject: "在 GitHub 查看项目",
    githubButton: "GitHub",
    breadcrumbRoot: "文档",
    notFoundTitle: "未找到此文档",
    notFoundDescription: "请选择左侧导航中的文档，或返回文档概览。",
    notFoundBack: "返回概览",
    loading: "正在加载文档…",
    languageLabel: "语言",
    zhLabel: "中文",
    enLabel: "English",
    homeTitle: `${docsSiteMetadata.brandName} 文档`,
    homeDescription: "本地优先 AI 工作台的用户与技术文档。",
    releaseButton: "Release",
    latestReleaseLabel: "最新版本",
  },
  en: {
    siteTitle: docsSiteMetadata.brandName,
    githubProject: "View the project on GitHub",
    githubButton: "GitHub",
    breadcrumbRoot: "Docs",
    notFoundTitle: "Document not found",
    notFoundDescription: "Choose a page from the left navigation or go back to the documentation overview.",
    notFoundBack: "Back to overview",
    loading: "Loading documentation…",
    languageLabel: "Language",
    zhLabel: "中文",
    enLabel: "English",
    homeTitle: `${docsSiteMetadata.brandName} Docs`,
    homeDescription: "User and technical documentation for the local-first AI workbench.",
    releaseButton: "Release",
    latestReleaseLabel: "Latest release",
  },
}

export function isDocLocale(value: string): value is DocLocale {
  return docLocales.includes(value as DocLocale)
}

export function localizeDocPath(locale: DocLocale, canonicalPath: string) {
  if (canonicalPath === "/") return `/${locale}`
  return `/${locale}${canonicalPath}`
}

export function stripDocLocale(path: string) {
  const match = path.match(/^\/(zh|en)(\/.*)?$/)
  if (!match) {
    return { locale: defaultDocLocale, canonicalPath: path || "/doc" }
  }

  const locale = match[1] as DocLocale
  const canonicalPath = match[2] || "/"
  return { locale, canonicalPath }
}

export function getLocalizedSections(locale: DocLocale): DocSection[] {
  return canonicalDocumentationSections.map((section) => ({
    title: section.title[locale],
    icon: section.icon,
    items: section.items.map((item) => ({
      title: item.title[locale],
      path: localizeDocPath(locale, item.path),
      description: item.description[locale],
    })),
  }))
}

export function findDocument(path: string, locale?: DocLocale) {
  const parsed = locale ? { locale, canonicalPath: path } : stripDocLocale(path)
  return canonicalDocumentationSections
    .flatMap((section) => section.items)
    .find((item) => item.path === parsed.canonicalPath)
}

export function getDocumentTitle(path: string, locale: DocLocale) {
  return findDocument(path, locale)?.title[locale]
}

export function getDocumentDescription(path: string, locale: DocLocale) {
  if (path === "/doc") return docsUiMessages[locale].homeDescription
  return findDocument(path, locale)?.description[locale]
}

export function getDocumentPageTitle(path: string, locale: DocLocale) {
  if (path === "/doc") return docsUiMessages[locale].homeTitle

  const title = getDocumentTitle(path, locale)
  return title ? `${title} · ${docsUiMessages[locale].siteTitle}` : docsUiMessages[locale].siteTitle
}

export function getLocaleSwitchPath(currentPath: string, targetLocale: DocLocale) {
  const { canonicalPath } = stripDocLocale(currentPath)
  const nextCanonicalPath = canonicalPath === "/" ? "/doc" : canonicalPath
  return localizeDocPath(targetLocale, nextCanonicalPath)
}
