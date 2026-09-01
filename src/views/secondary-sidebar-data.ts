import { startTransition, useEffect, useState } from "react"

import type { PrimaryNavItem, ResolvedSecondarySidebarGroup } from "@/views/nav-config"
import { subscribeToDataChanges } from "@/data/repositories/data-events"
import { loadSidebarGroups } from "@/data/repositories/sidebar-repository"

function createEmptyGroups(item: PrimaryNavItem): ResolvedSecondarySidebarGroup[] {
  return item.secondarySidebar.groups.map((group) => ({
    id: group.id,
    title: group.title,
    items: [],
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

    loadSidebarGroups(item).then((nextGroups) => {
      if (cancelled) {
        return
      }

      startTransition(() => {
        setGroups(nextGroups)
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