import { startTransition, useEffect, useState } from "react"

import type { ChannelPlatform } from "@/data/domain/channel-models"
import type { PrimaryNavItem, ResolvedSecondarySidebarGroup } from "@/views/nav-config"
import { subscribeToDataChanges } from "@/application/shared/data-events"
import { sidebarQueryService } from "@/application/sidebar/sidebar-query-service"
import { getRunningChatIds } from "@/views/chats/chat-runtime-store"
import { getProviderSidebarLogo } from "@/views/components/provider-logo"
import { getChannelPlatformSidebarLogo } from "@/views/channels/components/channel-utils"

function createEmptyGroups(item: PrimaryNavItem): ResolvedSecondarySidebarGroup[] {
  return item.secondarySidebar.groups.map((group) => ({
    id: group.id,
    title: group.title,
    items: [],
  }))
}

function applySidebarPresentation(item: PrimaryNavItem, groups: ResolvedSecondarySidebarGroup[]) {
  const runningChatIds = getRunningChatIds()
  return groups.map((group) => ({
    ...group,
    items: group.items.map((entry) => {
      if (item.url === "/chats" && runningChatIds.has(entry.id)) {
        return { ...entry, meta: `${entry.meta || "In progress"} · Running`, count: 1 }
      }
      if (item.url === "/models" && entry.iconKey) {
        return { ...entry, icon: getProviderSidebarLogo(entry.iconKey) }
      }
      if (item.url === "/channels" && entry.iconKey) {
        return { ...entry, icon: getChannelPlatformSidebarLogo({ platform: entry.iconKey as ChannelPlatform }) }
      }
      return entry
    }),
  }))
}

export function useSecondarySidebarData(item?: PrimaryNavItem) {
  const [groups, setGroups] = useState<ResolvedSecondarySidebarGroup[]>(() =>
    item ? createEmptyGroups(item) : []
  )
  const [isLoading, setIsLoading] = useState(Boolean(item))
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    if (!item) {
      return
    }

    return subscribeToDataChanges((route) => {
      if (route === item.url) {
        setRefreshToken((value) => value + 1)
      }
    })
  }, [item])

  useEffect(() => {
    if (!item) {
      setGroups([])
      setIsLoading(false)
      return
    }

    let cancelled = false

    setGroups(createEmptyGroups(item))
    setIsLoading(true)

    sidebarQueryService.loadGroups(item)
      .then((nextGroups) => {
        if (cancelled) {
          return
        }

        startTransition(() => {
          setGroups(applySidebarPresentation(item, nextGroups))
          setIsLoading(false)
        })
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        startTransition(() => {
          setGroups(createEmptyGroups(item))
          setIsLoading(false)
        })
      })

    return () => {
      cancelled = true
    }
  }, [item, refreshToken])

  return {
    groups,
    isLoading,
  }
}