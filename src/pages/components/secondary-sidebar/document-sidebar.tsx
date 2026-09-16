import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar"
import { DocumentApi } from "@/services/document-service"
import type { PrimaryNavItem } from "@/pages/nav-config"
export default function DocumentSidebar({
  item,
  headerAction,
}: {
  item: PrimaryNavItem
  headerAction?: React.ReactNode
}) {
  const [items, setItems] = useState<Array<{ id: string; title: string; summary: string }>>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    void DocumentApi.listAll()
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])
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
          <SidebarMenu>
            {items
              .filter((x) => `${x.title} ${x.summary}`.toLowerCase().includes(query.toLowerCase()))
              .map((x) => (
                <SidebarMenuItem key={x.id}>
                  <SidebarMenuButton
                    isActive={location.pathname === `/documents/${x.id}`}
                    onClick={() => navigate(`/documents/${x.id}`)}
                  >
                    {x.title}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
          </SidebarMenu>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
