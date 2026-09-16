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
import { ChannelApi } from "@/services/channel-service"
import type { PrimaryNavItem } from "@/pages/nav-config"
import { getChannelPlatformSidebarLogo } from "@/pages/channels/components/channel-utils"
import type { ChannelSummary } from "@/types/channel"
export default function ChannelSidebar({
  item,
  headerAction,
}: {
  item: PrimaryNavItem
  headerAction?: React.ReactNode
}) {
  const [items, setItems] = useState<
    Array<{
      id: string
      title: string
      platform: ChannelSummary["platform"]
      customPlatformName?: string
      bindingState?: string
      catalogId?: string
    }>
  >([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    void ChannelApi.listAll()
      .then((next) =>
        setItems(
          next.map((x) => ({
            id: x.id,
            title: x.title,
            platform: x.platform,
            customPlatformName: x.customPlatformName,
            bindingState: x.bindingState,
            catalogId: x.catalogId,
          })),
        ),
      )
      .finally(() => setLoading(false))
  }, [])
  const filteredItems = items.filter((x) =>
    `${x.title} ${x.platform}`.toLowerCase().includes(query.toLowerCase()),
  )
  const groups = [
    { id: "connected", title: "Connected", items: filteredItems.filter((x) => x.bindingState === "connected") },
    { id: "catalog", title: "Catalog", items: filteredItems.filter((x) => x.bindingState !== "connected") },
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
                {group.items.map((x) => {
                  const Logo = getChannelPlatformSidebarLogo(x)
                  return (
                    <SidebarMenuItem key={x.id}>
                      <SidebarMenuButton
                        isActive={location.pathname === `/channels/${x.id}`}
                        onClick={() => navigate(`/channels/${x.id}`)}
                      >
                        <Logo className="size-4 shrink-0" />
                        {x.title}
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
