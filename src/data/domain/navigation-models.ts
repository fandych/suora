import type { ComponentType } from "react"

export type ResolvedSecondarySidebarItem = {
  id: string
  label: string
  href: string
  meta?: string
  count?: number
  icon?: ComponentType<{ className?: string }>
  iconKey?: string
  actions?: Array<{ id: string; label: string; variant?: "default" | "destructive" }>
}

export type ResolvedSecondarySidebarGroup = {
  id: string
  title?: string
  items: ResolvedSecondarySidebarItem[]
}

export type SidebarGroupData = ResolvedSecondarySidebarGroup
export type SidebarItemData = ResolvedSecondarySidebarItem

export type SimpleCatalogItem = {
  id: string
  title: string
  kind: string
  meta?: string
  updatedAt: number
}
