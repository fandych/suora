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
import { subscribeToDataChanges } from "@/services/data-events"
import { ChatApi } from "@/services/chat-service"
import type { PrimaryNavItem } from "@/pages/nav-config"

export default function ChatSidebar({ item, headerAction }: { item: PrimaryNavItem; headerAction?: React.ReactNode }) {
  const [query, setQuery] = useState("")
  const [records, setRecords] = useState<Array<{ id: string; title: string; summary: string; updatedAt: number }>>([])
  const [loadedAt, setLoadedAt] = useState(0)
  const [loading, setLoading] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void ChatApi.listAll()
      .then((next) => {
        if (!cancelled) {
          setRecords(next)
          setLoadedAt(Date.now())
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(
    () =>
      subscribeToDataChanges((route) => {
        if (route === item.url) {
          void ChatApi.listAll().then((next) => {
            setRecords(next)
            setLoadedAt(Date.now())
          })
        }
      }),
    [item.url],
  )
  const groups = [
    {
      id: "today",
      title: "今天",
      records: records.filter((record) => record.updatedAt >= loadedAt - 86400000),
    },
    { id: "week", title: "本周", records },
    { id: "older", title: "更早", records: [] },
  ]
  return (
    <Sidebar collapsible="none" className="hidden min-h-0 flex-1 border-l md:flex">
      <SidebarHeader className="gap-2.5 border-b p-3">
        <div className="flex items-center justify-between">
          <div className="text-base font-medium">{item.title}</div>
          {headerAction}
        </div>
        <SidebarInput
          placeholder={item.secondarySidebar.searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
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
                {group.records
                  .filter((record) => `${record.title} ${record.summary}`.toLowerCase().includes(query.toLowerCase()))
                  .map((record) => (
                    <SidebarMenuItem key={record.id}>
                      <SidebarMenuButton
                        isActive={location.pathname === `/chats/${record.id}`}
                        onClick={() => navigate(`/chats/${record.id}`)}
                      >
                        {record.title}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            )}
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
