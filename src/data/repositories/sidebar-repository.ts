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
import { getRunningChatIds } from "@/views/chats/chat-runtime-store"
import { getProviderSidebarLogo } from "@/views/components/provider-logo"
import { getChannelPlatformSidebarLogo } from "@/views/channels/components/channel-utils"
import type { PrimaryNavItem } from "@/views/nav-config"

function getChannelCatalogGroup(record: { platform: string; bindingState?: string; enabled: boolean }) {
  return record.bindingState === "connected" || record.enabled ? "connected" : "catalog"
}

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
  return getProviderSidebarLogo(providerType)
}

function compareModelSidebarRecords(
  left: { title: string; providerType?: string; group: string },
  right: { title: string; providerType?: string; group: string }
) {
  if (left.group === right.group) {
    const leftIsCustom = left.providerType === "custom"
    const rightIsCustom = right.providerType === "custom"

    if (leftIsCustom !== rightIsCustom) {
      return leftIsCustom ? 1 : -1
    }

    const byTitle = left.title.localeCompare(right.title, undefined, { sensitivity: "base" })
    if (byTitle !== 0) {
      return byTitle
    }

    return (left.providerType ?? "").localeCompare(right.providerType ?? "", undefined, { sensitivity: "base" })
  }

  return left.group.localeCompare(right.group, undefined, { sensitivity: "base" })
}

function compareSkillSidebarRecords(
  left: { title: string; group: string },
  right: { title: string; group: string }
) {
  if (left.group !== right.group) {
    const order = ["custom", "builtin", "codex", "claude", "agents"]
    const leftIndex = order.indexOf(left.group)
    const rightIndex = order.indexOf(right.group)
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? order.length : leftIndex) - (rightIndex === -1 ? order.length : rightIndex)
    }
    return left.group.localeCompare(right.group, undefined, { sensitivity: "base" })
  }

  return left.title.localeCompare(right.title, undefined, { sensitivity: "base" })
}

async function listExternalSkillSidebarRecords() {
  try {
    const listExternal = window.suora?.skills.listExternal
    if (!listExternal) return []
    const records = await listExternal()
    return Array.isArray(records) ? records as Array<{ id: string; title: string; source: string; summary: string }> : []
  } catch {
    return []
  }
}

function compareChannelSidebarRecords(
  left: { title: string; group: string; customPlatformName?: string; catalogId?: string },
  right: { title: string; group: string; customPlatformName?: string; catalogId?: string }
) {
  if (left.group !== right.group) {
    return left.group.localeCompare(right.group, undefined, { sensitivity: "base" })
  }

  const leftIsCustom = left.catalogId?.includes("custom") || left.customPlatformName?.trim().length
  const rightIsCustom = right.catalogId?.includes("custom") || right.customPlatformName?.trim().length

  if (Boolean(leftIsCustom) !== Boolean(rightIsCustom)) {
    return leftIsCustom ? 1 : -1
  }

  return left.title.localeCompare(right.title, undefined, { sensitivity: "base" })
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
      const runningChatIds = getRunningChatIds()
      const now = Date.now()
      const oneDay = 24 * 60 * 60 * 1000
      const sevenDays = 7 * oneDay

      return mapItems(
        item,
        records.map((record) => ({
          id: record.id,
          title: record.title,
          meta: runningChatIds.has(record.id) ? `${record.summary || "In progress"} · Running` : record.summary,
          group: now - record.updatedAt < oneDay ? "today" : now - record.updatedAt < sevenDays ? "recent" : "older",
          count: runningChatIds.has(record.id) ? 1 : undefined,
          actions: [{ id: "delete", label: "Delete", variant: "destructive" as const }],
        }))
      )
    }
    case "/agents":
      return mapItems(item, (await listAgents()).map((record) => ({
        id: record.id,
        title: record.title,
        group: record.source === "custom" ? "custom" : "builtin",
        meta: record.isDisabled ? `${record.summary} · Disabled` : record.summary,
        actions: record.source === "custom"
          ? [{ id: "delete", label: "Delete", variant: "destructive" as const }]
          : [{ id: record.isDisabled ? "enable" : "disable", label: record.isDisabled ? "Enable" : "Disable" }],
      })))
    case "/workflows":
      return mapItems(item, (await listWorkflows()).map((record) => ({ id: record.id, title: record.title, group: "workflows", meta: record.summary, actions: [{ id: "delete", label: "Delete", variant: "destructive" as const }] })))
    case "/schedulers":
      return mapItems(item, (await listSchedulers()).map((record) => ({ id: record.id, title: record.title, group: "schedulers", meta: record.description || record.schedule })))
    case "/integrations":
      return mapItems(item, (await listIntegrationSummaries()).map((record) => ({ id: record.id, title: record.title, group: record.kind, meta: record.endpoint })))
    case "/documents":
      return mapItems(item, (await listDocuments()).map((record) => ({ id: record.id, title: record.title, group: "documents", meta: record.summary })))
    case "/channels": {
      const records = await listChannels()
      const configuredCatalogIds = new Set(
        records
          .filter((record) => getChannelCatalogGroup(record) !== "catalog" && record.catalogId)
          .map((record) => record.catalogId as string)
      )

      return mapItems(item, records
        .filter((record) => !(getChannelCatalogGroup(record) === "catalog" && record.catalogId && configuredCatalogIds.has(record.catalogId)))
        .map((record) => ({
          id: record.id,
          title: record.title,
          group: getChannelCatalogGroup(record),
          catalogId: record.catalogId,
          customPlatformName: record.customPlatformName,
          meta: record.meta || `${record.platform} · ${record.bindingState || record.status}`,
          icon: getChannelPlatformSidebarLogo(record),
        }))
        .sort(compareChannelSidebarRecords))
    }
    case "/skills": {
      const localSkills = await listSkills()
      const externalSkills = await listExternalSkillSidebarRecords()
      return mapItems(item, [
        ...localSkills.map((record) => ({ id: record.id, title: record.title, group: record.source === "custom" ? "custom" : "builtin", meta: record.summary, actions: [{ id: "disable", label: "Disable" }, { id: "delete", label: "Delete", variant: "destructive" as const }] })),
        ...externalSkills.map((record) => ({ id: record.id, title: record.title, group: record.source, meta: record.summary })),
      ].sort(compareSkillSidebarRecords))
    }
    case "/models":
      return mapItems(item, (await listModelProviders())
        .map((record) => ({
          id: record.id,
          title: record.title,
          providerType: record.providerType,
          group: record.apiKey.trim().length > 0 ? "connected" : "catalog",
          meta: record.baseUrl || record.providerType,
          count: record.models.filter((model) => model.enabled).length,
          icon: getProviderIcon(record.providerType),
          actions: [
            { id: "rename", label: "Edit info" },
            { id: record.enabled ? "disable" : "enable", label: record.enabled ? "Disable" : "Enable" },
            ...(record.providerType === "custom" ? [{ id: "delete", label: "Delete", variant: "destructive" as const }] : []),
          ],
        }))
        .sort(compareModelSidebarRecords))
    default:
      return emptyGroups(item)
  }
}