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
import { getLocalizedAgentSummary, getLocalizedAgentTitle } from "@/lib/agent-localization"
import { useAppIntl } from "@/lib/i18n"
import { listAgents } from "@/services/agent-service"
import { subscribeToDataChanges } from "@/services/data-events"
import type { AgentSummary } from "@/types/agent"
import type { PrimaryNavItem } from "@/pages/nav-config"
export default function AgentSidebar({ item, headerAction }: { item: PrimaryNavItem; headerAction?: React.ReactNode }) {
  const { t } = useAppIntl()
  const [items, setItems] = useState<AgentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const loadItems = () =>
      listAgents()
        .then(setItems)
        .finally(() => setLoading(false))

    void loadItems()
    return subscribeToDataChanges((route) => {
      if (route === "/agents") void loadItems()
    })
  }, [])
  const filteredItems = items.filter((x) =>
    `${getLocalizedAgentTitle(x, t)} ${getLocalizedAgentSummary(x, t)}`.toLowerCase().includes(query.toLowerCase()),
  )
  const groups = [
    { id: "custom", title: t("agents.sidebar.group.custom", "Custom"), items: filteredItems.filter((x) => x.source !== "system") },
    { id: "builtin", title: t("agents.sidebar.group.builtin", "Builtin"), items: filteredItems.filter((x) => x.source === "system") },
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
                        isActive={location.pathname === `/agents/${x.id}`}
                        onClick={() => navigate(`/agents/${x.id}`)}
                      >
                        {getLocalizedAgentTitle(x, t)}
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
