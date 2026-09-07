import {
  BookOpenTextIcon,
  BotIcon,
  BrainCircuitIcon,
  CalendarClockIcon,
  LayoutDashboardIcon,
  MessageCircleIcon,
  PlugZapIcon,
  RadioTowerIcon,
  SparklesIcon,
  WorkflowIcon,
  type LucideIcon,
} from "lucide-react"
import type { ComponentType } from "react"

export type PrimaryNavItem = {
  title: string
  url: string
  icon: LucideIcon
  iconClassName: string
  description: string
  secondarySidebar: {
    searchPlaceholder: string
    collapsibleGroups?: boolean
    groups: {
      id: string
      title?: string
    }[]
  }
}

export type ResolvedSecondarySidebarItem = {
  id: string
  label: string
  href: string
  meta?: string
  count?: number
  icon?: ComponentType<{ className?: string }>
  actions?: Array<{
    id: string
    label: string
    variant?: "default" | "destructive"
  }>
}

export const primaryNavItems: PrimaryNavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboardIcon,
    iconClassName: "text-slate-500",
    description: "Track workspace health, workflow status, and recent activity in one place.",
    secondarySidebar: {
      searchPlaceholder: "搜索 dashboard...",
      groups: [
        {
          id: "overview",
        },
      ],
    },
  },
  {
    title: "Chats",
    url: "/chats",
    icon: MessageCircleIcon,
    iconClassName: "text-sky-500",
    description: "Review conversations, drafts, and active discussion threads.",
    secondarySidebar: {
      searchPlaceholder: "搜索聊天记录...",
      groups: [
        {
          id: "today",
          title: "今天",
        },
        {
          id: "recent",
          title: "7天内",
        },
        {
          id: "older",
          title: "更早以前",
        },
      ],
    },
  },
  {
    title: "Agents",
    url: "/agents",
    icon: BotIcon,
    iconClassName: "text-indigo-500",
    description: "Manage agent definitions, responsibilities, and execution status.",
    secondarySidebar: {
      searchPlaceholder: "搜索 agents...",
      groups: [
        {
          id: "custom",
          title: "自定义",
        },
        {
          id: "builtin",
          title: "System",
        },
      ],
    },
  },
  {
    title: "Workflows",
    url: "/workflows",
    icon: WorkflowIcon,
    iconClassName: "text-emerald-600",
    description: "Compose repeatable flows for multi-step operational work.",
    secondarySidebar: {
      searchPlaceholder: "搜索 workflows...",
      groups: [
        {
          id: "workflows",
        },
      ],
    },
  },
  {
    title: "Schedulers",
    url: "/schedulers",
    icon: CalendarClockIcon,
    iconClassName: "text-amber-500",
    description: "Schedule recurring tasks and inspect upcoming automation windows.",
    secondarySidebar: {
      searchPlaceholder: "搜索 schedulers...",
      groups: [
        {
          id: "schedulers",
        },
      ],
    },
  },
  {
    title: "Integrations",
    url: "/integrations",
    icon: PlugZapIcon,
    iconClassName: "text-orange-500",
    description: "Configure external services, API links, and delivery endpoints.",
    secondarySidebar: {
      searchPlaceholder: "搜索 integrations...",
      collapsibleGroups: true,
      groups: [
        {
          id: "http",
          title: "HTTP",
        },
        {
          id: "mcp",
          title: "MCP",
        },
        {
          id: "scripts",
          title: "Scripts",
        },
      ],
    },
  },
  {
    title: "Documents",
    url: "/documents",
    icon: BookOpenTextIcon,
    iconClassName: "text-blue-500",
    description: "Browse product knowledge, uploaded files, and generated references.",
    secondarySidebar: {
      searchPlaceholder: "搜索 documents...",
      groups: [
        {
          id: "documents",
          title: "Documents",
        },
      ],
    },
  },
  {
    title: "Channels",
    url: "/channels",
    icon: RadioTowerIcon,
    iconClassName: "text-teal-500",
    description: "Organize communication surfaces, routing rules, and message sources.",
    secondarySidebar: {
      searchPlaceholder: "搜索 channels...",
      groups: [
        {
          id: "connected",
          title: "Connected",
        },
        {
          id: "catalog",
          title: "Channel Catalog",
        },
      ],
    },
  },
  {
    title: "Skills",
    url: "/skills",
    icon: SparklesIcon,
    iconClassName: "text-fuchsia-500",
    description: "Register reusable capabilities and inspect versioned skill bundles.",
    secondarySidebar: {
      searchPlaceholder: "搜索 skills...",
      collapsibleGroups: true,
      groups: [
        {
          id: "custom",
          title: "Custom",
        },
        {
          id: "builtin",
          title: "Built-in",
        },
        {
          id: "codex",
          title: "Codex",
        },
        {
          id: "claude",
          title: "Claude",
        },
        {
          id: "agents",
          title: ".agents",
        },
      ],
    },
  },
  {
    title: "Models",
    url: "/models",
    icon: BrainCircuitIcon,
    iconClassName: "text-rose-500",
    description: "Compare model configurations, defaults, and environment policies.",
    secondarySidebar: {
      searchPlaceholder: "搜索 providers...",
      groups: [
        {
          id: "connected",
          title: "Connected",
        },
        {
          id: "catalog",
          title: "Provider Catalog",
        },
      ],
    },
  },
]

export type ResolvedSecondarySidebarGroup = {
  id: string
  title?: string
  items: ResolvedSecondarySidebarItem[]
}

export const preferenceRoute = {
  title: "Preference",
  url: "/preference",
  iconClassName: "text-amber-500",
  description: "Tune product behavior, defaults, and operator-level settings.",
}

export function getPrimaryNavItem(pathname: string) {
  return primaryNavItems.find(
    (item) => pathname === item.url || pathname.startsWith(`${item.url}/`)
  )
}

export function isPreferencePath(pathname: string) {
  return (
    pathname === preferenceRoute.url ||
    pathname.startsWith(`${preferenceRoute.url}/`)
  )
}