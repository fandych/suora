import type { ResolvedSecondarySidebarGroup, ResolvedSecondarySidebarItem } from "@/views/nav-config"

export type SidebarGroupData = ResolvedSecondarySidebarGroup
export type SidebarItemData = ResolvedSecondarySidebarItem

export type SimpleCatalogItem = {
  id: string
  title: string
  kind: string
  meta?: string
  updatedAt: number
}
