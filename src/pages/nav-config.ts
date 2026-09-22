import {
  BookOpenTextIcon,
  BotIcon,
  BrainCircuitIcon,
  CalendarClockIcon,
  MessageCircleIcon,
  PlugZapIcon,
  RadioTowerIcon,
  SparklesIcon,
  WorkflowIcon,
  type LucideIcon,
} from "lucide-react"
import type { IntlShape } from "react-intl"
export type { ResolvedSecondarySidebarGroup, ResolvedSecondarySidebarItem } from "@/types/navigation"

type LocalizedText = {
  id: string
  defaultMessage: string
}

type PrimaryNavItemDefinition = {
  title: LocalizedText
  url: string
  icon: LucideIcon
  iconClassName: string
  description: LocalizedText
  secondarySidebar: {
    searchPlaceholder: LocalizedText
    collapsibleGroups?: boolean
    groups: {
      id: string
      title?: LocalizedText
    }[]
  }
}

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

const primaryNavDefinitions: PrimaryNavItemDefinition[] = [
  {
    title: { id: "nav.chats.title", defaultMessage: "Chats" },
    url: "/chats",
    icon: MessageCircleIcon,
    iconClassName: "text-sky-500",
    description: { id: "nav.chats.description", defaultMessage: "Review conversations, drafts, and active discussion threads." },
    secondarySidebar: {
      searchPlaceholder: { id: "nav.chats.search", defaultMessage: "Search chats..." },
      groups: [
        {
          id: "today",
          title: { id: "nav.chats.group.today", defaultMessage: "Today" },
        },
        {
          id: "week",
          title: { id: "nav.chats.group.week", defaultMessage: "This week" },
        },
        {
          id: "older",
          title: { id: "nav.chats.group.older", defaultMessage: "Earlier" },
        },
      ],
    },
  },
  {
    title: { id: "nav.agents.title", defaultMessage: "Agents" },
    url: "/agents",
    icon: BotIcon,
    iconClassName: "text-indigo-500",
    description: { id: "nav.agents.description", defaultMessage: "Manage agent definitions, responsibilities, and execution status." },
    secondarySidebar: {
      searchPlaceholder: { id: "nav.agents.search", defaultMessage: "Search agents..." },
      collapsibleGroups: true,
      groups: [
        {
          id: "custom",
          title: { id: "nav.agents.group.custom", defaultMessage: "Custom" },
        },
        {
          id: "builtin",
          title: { id: "nav.agents.group.builtin", defaultMessage: "System" },
        },
      ],
    },
  },
  {
    title: { id: "nav.workflows.title", defaultMessage: "Workflows" },
    url: "/workflows",
    icon: WorkflowIcon,
    iconClassName: "text-emerald-600",
    description: { id: "nav.workflows.description", defaultMessage: "Compose repeatable flows for multi-step operational work." },
    secondarySidebar: {
      searchPlaceholder: { id: "nav.workflows.search", defaultMessage: "Search workflows..." },
      groups: [
        {
          id: "workflows",
        },
      ],
    },
  },
  {
    title: { id: "nav.schedulers.title", defaultMessage: "Schedulers" },
    url: "/schedulers",
    icon: CalendarClockIcon,
    iconClassName: "text-amber-500",
    description: { id: "nav.schedulers.description", defaultMessage: "Schedule recurring tasks and inspect upcoming automation windows." },
    secondarySidebar: {
      searchPlaceholder: { id: "nav.schedulers.search", defaultMessage: "Search schedulers..." },
      groups: [
        {
          id: "schedulers",
        },
      ],
    },
  },
  {
    title: { id: "nav.integrations.title", defaultMessage: "Integrations" },
    url: "/integrations",
    icon: PlugZapIcon,
    iconClassName: "text-orange-500",
    description: { id: "nav.integrations.description", defaultMessage: "Configure external services, API links, and delivery endpoints." },
    secondarySidebar: {
      searchPlaceholder: { id: "nav.integrations.search", defaultMessage: "Search integrations..." },
      collapsibleGroups: true,
      groups: [
        {
          id: "http",
          title: { id: "nav.integrations.group.http", defaultMessage: "HTTP" },
        },
        {
          id: "mcp",
          title: { id: "nav.integrations.group.mcp", defaultMessage: "MCP" },
        },
        {
          id: "scripts",
          title: { id: "nav.integrations.group.scripts", defaultMessage: "Scripts" },
        },
      ],
    },
  },
  {
    title: { id: "nav.documents.title", defaultMessage: "Documents" },
    url: "/documents",
    icon: BookOpenTextIcon,
    iconClassName: "text-blue-500",
    description: { id: "nav.documents.description", defaultMessage: "Browse product knowledge, uploaded files, and generated references." },
    secondarySidebar: {
      searchPlaceholder: { id: "nav.documents.search", defaultMessage: "Search documents..." },
      groups: [
        {
          id: "documents",
          title: { id: "nav.documents.group.documents", defaultMessage: "Documents" },
        },
      ],
    },
  },
  {
    title: { id: "nav.channels.title", defaultMessage: "Channels" },
    url: "/channels",
    icon: RadioTowerIcon,
    iconClassName: "text-teal-500",
    description: { id: "nav.channels.description", defaultMessage: "Organize communication surfaces, routing rules, and message sources." },
    secondarySidebar: {
      searchPlaceholder: { id: "nav.channels.search", defaultMessage: "Search channels..." },
      groups: [
        {
          id: "connected",
          title: { id: "nav.channels.group.connected", defaultMessage: "Connected" },
        },
        {
          id: "catalog",
          title: { id: "nav.channels.group.catalog", defaultMessage: "Catalog" },
        },
      ],
    },
  },
  {
    title: { id: "nav.skills.title", defaultMessage: "Skills" },
    url: "/skills",
    icon: SparklesIcon,
    iconClassName: "text-fuchsia-500",
    description: { id: "nav.skills.description", defaultMessage: "Register reusable capabilities and inspect versioned skill bundles." },
    secondarySidebar: {
      searchPlaceholder: { id: "nav.skills.search", defaultMessage: "Search skills..." },
      collapsibleGroups: true,
      groups: [
        {
          id: "custom",
          title: { id: "nav.skills.group.custom", defaultMessage: "Custom" },
        },
        {
          id: "builtin",
          title: { id: "nav.skills.group.builtin", defaultMessage: "Builtin" },
        },
        {
          id: "codex",
          title: { id: "nav.skills.group.codex", defaultMessage: "Codex (~/.codex/skills)" },
        },
        {
          id: "claude",
          title: { id: "nav.skills.group.claude", defaultMessage: "ClaudeCode (~/.claude/skills)" },
        },
        {
          id: "agents",
          title: { id: "nav.skills.group.agents", defaultMessage: "Other (~/.agents/skills)" },
        },
      ],
    },
  },
  {
    title: { id: "nav.models.title", defaultMessage: "Models" },
    url: "/models",
    icon: BrainCircuitIcon,
    iconClassName: "text-rose-500",
    description: { id: "nav.models.description", defaultMessage: "Compare model configurations, defaults, and environment policies." },
    secondarySidebar: {
      searchPlaceholder: { id: "nav.models.search", defaultMessage: "Search providers..." },
      groups: [
        {
          id: "connected",
          title: { id: "nav.channels.group.connected", defaultMessage: "Connected" },
        },
        {
          id: "catalog",
          title: { id: "nav.channels.group.catalog", defaultMessage: "Catalog" },
        },
      ],
    },
  },
]

const preferenceRouteDefinition = {
  title: { id: "nav.preference.title", defaultMessage: "Preference" },
  iconClassName: "text-amber-500",
  description: { id: "nav.preference.description", defaultMessage: "Tune product behavior, defaults, and operator-level settings." },
}

const preferenceSectionDefinitions = [
  { id: "general", label: { id: "nav.preference.section.general", defaultMessage: "General" }, href: "/preference/general" },
  { id: "security", label: { id: "nav.preference.section.security", defaultMessage: "Security" }, href: "/preference/security" },
  { id: "mail-service", label: { id: "nav.preference.section.mailService", defaultMessage: "Mail Service" }, href: "/preference/mail-service" },
  {
    id: "environment-monitor",
    label: { id: "nav.preference.section.environmentMonitor", defaultMessage: "Environment Monitor" },
    href: "/preference/environment-monitor",
  },
  {
    id: "global-environment",
    label: { id: "nav.preference.section.globalEnvironment", defaultMessage: "Global Environment" },
    href: "/preference/global-environment",
  },
  { id: "about", label: { id: "nav.preference.section.about", defaultMessage: "About" }, href: "/preference/about" },
] as const

function resolveText(intl: IntlShape, text: LocalizedText) {
  return intl.formatMessage(text)
}

export function getPrimaryNavItems(intl: IntlShape): PrimaryNavItem[] {
  return primaryNavDefinitions.map((item) => ({
    title: resolveText(intl, item.title),
    url: item.url,
    icon: item.icon,
    iconClassName: item.iconClassName,
    description: resolveText(intl, item.description),
    secondarySidebar: {
      searchPlaceholder: resolveText(intl, item.secondarySidebar.searchPlaceholder),
      collapsibleGroups: item.secondarySidebar.collapsibleGroups,
      groups: item.secondarySidebar.groups.map((group) => ({
        id: group.id,
        title: group.title ? resolveText(intl, group.title) : undefined,
      })),
    },
  }))
}

export const preferenceRoutePath = "/preference"

export function getPreferenceRoute(intl: IntlShape) {
  return {
    title: resolveText(intl, preferenceRouteDefinition.title),
    url: preferenceRoutePath,
    iconClassName: preferenceRouteDefinition.iconClassName,
    description: resolveText(intl, preferenceRouteDefinition.description),
  }
}

export function getPreferenceSections(intl: IntlShape) {
  return preferenceSectionDefinitions.map((section) => ({
    id: section.id,
    label: resolveText(intl, section.label),
    href: section.href,
  }))
}

export function getPrimaryNavItem(pathname: string, intl: IntlShape) {
  return getPrimaryNavItems(intl).find((item) => pathname === item.url || pathname.startsWith(`${item.url}/`))
}

export function isPreferencePath(pathname: string) {
  return pathname === preferenceRoutePath || pathname.startsWith(`${preferenceRoutePath}/`)
}
