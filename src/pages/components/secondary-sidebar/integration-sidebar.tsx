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
import { IntegrationApi } from "@/services/integration-service"
import { subscribeToDataChanges } from "@/services/data-events"
import type { IntegrationSummary } from "@/types/integration"
import type { PrimaryNavItem } from "@/pages/nav-config"

const GROUPS: Array<{ id: string; title: string; kinds: string[] }> = [
  { id: "http", title: "HTTP", kinds: ["http"] },
  { id: "scripts", title: "Script", kinds: ["scripts", "script"] },
  { id: "mcp", title: "MCP", kinds: ["mcp"] },
]

export default function IntegrationSidebar({
  item,
  headerAction,
}: {
  item: PrimaryNavItem
  headerAction?: React.ReactNode
}) {
  const [items, setItems] = useState<IntegrationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const loadItems = () =>
      IntegrationApi.listAll()
        .then(setItems)
        .finally(() => setLoading(false))

    void loadItems()
    return subscribeToDataChanges((route) => {
      if (route === "/integrations") void loadItems()
    })
  }, [])
  const filteredItems = items.filter((x) =>
    `${x.title} ${x.endpoint}`.toLowerCase().includes(query.toLowerCase()),
  )
  const groups = GROUPS.map((group) => ({
    ...group,
    items: filteredItems.filter((x) => group.kinds.includes(x.kind)),
  }))
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
        {loading ? (
          <SidebarMenuSkeleton />
        ) : (
          groups
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <SidebarGroup key={group.id}>
                <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
                <SidebarMenu>
                  {group.items.map((x) => (
                    <SidebarMenuItem key={x.id}>
                      <SidebarMenuButton
                        isActive={location.pathname === `/integrations/${x.id}`}
                        onClick={() => navigate(`/integrations/${x.id}`)}
                      >
                        {x.title}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            ))
        )}
      </SidebarContent>
    </Sidebar>
  )
}
