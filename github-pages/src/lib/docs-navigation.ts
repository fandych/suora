import type { LucideIcon } from "lucide-react"
import { BookOpenIcon, BoxesIcon, RocketIcon, WrenchIcon } from "lucide-react"

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

export const documentationSections: DocSection[] = [
  {
    title: "开始使用",
    icon: RocketIcon,
    items: [
      { title: "概览", path: "/doc", description: "认识 SUORA 文档站" },
      { title: "安装与启动", path: "/doc/getting-started/installation", description: "安装桌面应用并配置首个模型" },
    ],
  },
  {
    title: "用户文档",
    icon: BookOpenIcon,
    items: [
      { title: "Chats", path: "/doc/chat/overview", description: "创建会话、发送消息与导出转录" },
      { title: "Workflows", path: "/doc/workflows/overview", description: "设计、验证、发布并运行 workflow" },
      { title: "Agents", path: "/doc/agents/overview", description: "配置模型、资源范围与工具边界" },
      { title: "Documents", path: "/doc/documents/overview", description: "组织页面、资源与本地知识" },
      { title: "Skills", path: "/doc/skills/overview", description: "创建、组织并复用本地 Skill 包" },
      { title: "Integrations", path: "/doc/integrations/overview", description: "连接 HTTP、脚本和 MCP 端点" },
      { title: "Channels", path: "/doc/channels/overview", description: "接入外部消息平台与自动回复" },
      { title: "Schedulers", path: "/doc/schedulers/overview", description: "维护 workflow 和 Agent 的调度配置" },
      { title: "Models", path: "/doc/models/overview", description: "配置 Provider、模型和远程模型目录" },
      { title: "Preferences", path: "/doc/preferences/overview", description: "设置外观、工具策略、SMTP 和更新行为" },
    ],
  },
  {
    title: "技术文档",
    icon: BoxesIcon,
    items: [
      { title: "应用架构", path: "/doc/technical/architecture", description: "Renderer、IPC 与本地服务" },
      { title: "IPC 通信", path: "/doc/technical/ipc", description: "Preload、IPC handlers 与安全边界" },
      { title: "SQLite 数据层", path: "/doc/technical/database", description: "Migration、Schema 与本地持久化" },
      { title: "AI 服务与工具", path: "/doc/technical/ai", description: "Provider、ToolLoopAgent 与工具护栏" },
      { title: "Workflow Engine", path: "/doc/technical/workflow-engine", description: "图调度、节点执行与运行时语义" },
      { title: "Channel Runtime", path: "/doc/technical/channel-runtime", description: "Webhook、Stream、消息队列与健康检查" },
      { title: "测试与发布", path: "/doc/technical/testing-release", description: "测试、CI、打包与发布流程" },
      { title: "安全护栏", path: "/doc/technical/security", description: "URL、工具、脚本、MCP 与 IPC 安全边界" },
      { title: "Browser Tools", path: "/doc/technical/browser", description: "浏览器会话、页面读取与表单操作" },
      { title: "开发与发布", path: "/doc/technical/development", description: "质量检查、构建与发布" },
    ],
  },
]

export const documentationTools = [{ title: "GitHub 仓库", path: "https://github.com/fandych/suora", icon: WrenchIcon }]

export function findDocument(path: string) {
  return documentationSections.flatMap((section) => section.items).find((item) => item.path === path)
}