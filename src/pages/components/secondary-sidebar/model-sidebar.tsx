import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar"
import { ModelApi } from "@/services/model-service"
import { subscribeToDataChanges } from "@/services/data-events"
import { getProviderLogo, getProviderBrandClassName } from "@/pages/components/provider-logo"
import type { PrimaryNavItem } from "@/pages/nav-config"
export default function ModelSidebar({ item, headerAction }: { item: PrimaryNavItem; headerAction?: React.ReactNode }) {
  const [items, setItems] = useState<Array<{ id: string; title: string; providerType: string; connected: boolean }>>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const loadItems = () =>
      ModelApi.listAll()
        .then((providers) => {
          setItems(
            providers.map((provider) => ({
              id: provider.id,
              title: provider.title,
              providerType: provider.providerType,
              connected: provider.enabled && provider.models.some((model) => model.enabled),
            })),
          )
        })
        .finally(() => setLoading(false))

    void loadItems()
    return subscribeToDataChanges((route) => {
      if (route === "/models") void loadItems()
    })
  }, [])
  const filteredItems = items.filter((item) =>
    `${item.title} ${item.providerType}`.toLowerCase().includes(query.toLowerCase()),
  )
  const groupTitles = new Map(item.secondarySidebar.groups.map((group) => [group.id, group.title ?? group.id]))
  const groups = [
    {
      id: "connected",
      title: groupTitles.get("connected") ?? "Connected",
      items: filteredItems.filter((item) => item.connected),
    },
    {
      id: "catalog",
      title: groupTitles.get("catalog") ?? "Catalog",
      items: filteredItems.filter((item) => !item.connected),
    },
  ]
  return (
    <Sidebar collapsible="none" className="hidden min-h-0 flex-1 border-l md:flex">
      <SidebarHeader className="gap-2.5 border-b p-3">
        <div className="flex justify-between">
          <b>{item.title}</b>
          {headerAction}
        </div>
        <SidebarInput
          placeholder={item.secondarySidebar.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            {loading ? (
              <SidebarMenuSkeleton />
            ) : (
              <SidebarMenu>
                {group.items.map((provider) => {
                  const Logo = getProviderLogo(provider.providerType)
                  return (
                    <SidebarMenuItem key={provider.id}>
                      <SidebarMenuButton
                        isActive={location.pathname === `/models/${provider.id}`}
                        onClick={() => navigate(`/models/${provider.id}`)}
                      >
                        <Logo className={`size-4 shrink-0 ${getProviderBrandClassName(provider.providerType)}`} />
                        <span className="truncate">{provider.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            )}
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
