import type { SidebarGroupData, SidebarItemData } from "@/data/domain/models"
import { listAgents } from "@/data/repositories/agent-repository"
import { listChannels } from "@/data/repositories/channel-repository"
import { listChats } from "@/data/repositories/chat-repository"
import { listDocuments } from "@/data/repositories/document-repository"
import { listIntegrationSummaries } from "@/data/repositories/integration-repository"
import { listModelProviders } from "@/data/repositories/model-config-repository"
import { listSchedulers } from "@/data/repositories/scheduler-repository"
import { listSkills } from "@/data/repositories/skill-repository"
import { listWorkflows } from "@/data/repositories/workflow-repository"
import { getProviderLogo } from "@/views/components/provider-logo"
import type { PrimaryNavItem } from "@/views/nav-config"

function emptyGroups(item: PrimaryNavItem): SidebarGroupData[] {
  return item.secondarySidebar.groups.map((group) => ({ id: group.id, title: group.title, items: [] }))
}

function mapItems(
  item: PrimaryNavItem,
  records: Array<{ id: string; title: string; group: string; meta?: string; count?: number; icon?: SidebarItemData["icon"]; actions?: SidebarItemData["actions"] }>
): SidebarGroupData[] {
  return item.secondarySidebar.groups.map((group) => ({
    id: group.id,
    title: group.title,
    items: records
      .filter((record) => record.group === group.id)
      .map(
        (record) =>
          ({ id: record.id, label: record.title, href: `${item.url}/${record.id}`, meta: record.meta, count: record.count, icon: record.icon, actions: record.actions }) satisfies SidebarItemData
      ),
  }))
}

function getProviderIcon(providerType: string) {
  return getProviderLogo(providerType)
}

export async function loadSidebarGroups(item: PrimaryNavItem) {
  switch (item.url) {
    case "/dashboard":
      return [
        {
          id: "overview",
          title: undefined,
          items: [{ id: "overview", label: "Workspace Overview", href: "/dashboard", meta: "Local SQLite" }],
        },
      ]
    case "/chats": {
      const records = await listChats()
      const now = Date.now()
      const oneDay = 24 * 60 * 60 * 1000
      const sevenDays = 7 * oneDay

      return mapItems(
        item,
        records.map((record) => ({
          id: record.id,
          title: record.title,
          meta: record.summary,
          group: now - record.updatedAt < oneDay ? "today" : now - record.updatedAt < sevenDays ? "recent" : "older",
          actions: [{ id: "delete", label: "Delete", variant: "destructive" as const }],
        }))
      )
    }
    case "/agents":
      return mapItems(item, (await listAgents()).map((record) => ({
        id: record.id,
        title: record.title,
        group: record.kind === "custom" ? "custom" : "builtin",
        meta: record.summary,
      })))
    case "/workflows":
      return mapItems(item, (await listWorkflows()).map((record) => ({ id: record.id, title: record.title, group: "workflows", meta: record.summary })))
    case "/schedulers":
      return mapItems(item, (await listSchedulers()).map((record) => ({ id: record.id, title: record.title, group: "schedulers", meta: record.description || record.schedule })))
    case "/integrations":
      return mapItems(item, (await listIntegrationSummaries()).map((record) => ({ id: record.id, title: record.title, group: record.kind, meta: record.endpoint })))
    case "/documents":
      return mapItems(item, (await listDocuments()).map((record) => ({ id: record.id, title: record.title, group: "documents", meta: record.summary, actions: [{ id: "delete", label: "Delete", variant: "destructive" }] })))
    case "/channels":
      return mapItems(item, (await listChannels()).map((record) => ({ id: record.id, title: record.title, group: "channels", meta: record.meta || `${record.platform} · ${record.status}` })))
    case "/skills":
      return mapItems(item, (await listSkills()).map((record) => ({ id: record.id, title: record.title, group: record.source === "custom" ? "custom" : "builtin", meta: record.summary, actions: [{ id: "disable", label: "Disable" }, { id: "delete", label: "Delete", variant: "destructive" }] })))
    case "/models":
      return mapItems(item, (await listModelProviders()).map((record) => ({
        id: record.id,
        title: record.title,
        group: record.apiKey.trim().length > 0 ? "connected" : "catalog",
        meta: record.baseUrl || record.providerType,
        count: record.models.filter((model) => model.enabled).length,
        icon: getProviderIcon(record.providerType),
        actions: [
          { id: "rename", label: "Edit info" },
          { id: record.enabled ? "disable" : "enable", label: record.enabled ? "Disable" : "Enable" },
          ...(record.providerType === "custom" ? [{ id: "delete", label: "Delete", variant: "destructive" as const }] : []),
        ],
      })))
    default:
      return emptyGroups(item)
  }
}