import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router"
import { ChevronRightIcon } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
import { SkillApi } from "@/services/skill-service"
import { subscribeToDataChanges } from "@/services/data-events"
import type { PrimaryNavItem } from "@/pages/nav-config"

type SkillSidebarItem = { id: string; title: string; source: string; summary: string }

const skillGroups = [
  { id: "custom", title: "Custom", sources: ["custom"] as string[] },
  { id: "builtin", title: "Builtin", sources: ["system", "builtin"] as string[] },
  { id: "claude", title: "ClaudeCode (~/.claude/skills)", sources: ["claude"] as string[] },
  { id: "codex", title: "Codex (~/.codex/skills)", sources: ["codex"] as string[] },
  { id: "agents", title: "Other (~/.agents/skills)", sources: ["agents"] as string[] },
]

export default function SkillSidebar({ item, headerAction }: { item: PrimaryNavItem; headerAction?: React.ReactNode }) {
  const [items, setItems] = useState<SkillSidebarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const loadItems = () =>
      Promise.all([SkillApi.listAll(), SkillApi.listExternal()])
        .then(([localItems, externalItems]) => [localItems, externalItems] as [SkillSidebarItem[], SkillSidebarItem[]])
        .then(([localItems, externalItems]) => setItems([...localItems, ...externalItems]))
        .finally(() => setLoading(false))

    void loadItems()
    return subscribeToDataChanges((route) => {
      if (route === "/skills") void loadItems()
    })
  }, [])

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.toLowerCase()
    return items.filter((skill) => `${skill.title} ${skill.summary}`.toLowerCase().includes(normalizedQuery))
  }, [items, query])

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
          <div className="flex flex-col gap-1 p-2">
            {skillGroups.map((group) => {
              const groupItems = filteredItems.filter((skill) => group.sources.includes(skill.source))
              const isCollapsed = collapsedGroups[group.id] ?? false
              return (
                <Collapsible
                  key={group.id}
                  open={!isCollapsed}
                  onOpenChange={(open) => setCollapsedGroups((current) => ({ ...current, [group.id]: !open }))}
                >
                  <CollapsibleTrigger className="group flex h-8 w-full items-center gap-1 rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                    <ChevronRightIcon className="size-3 transition-transform group-aria-expanded:rotate-90" />
                    {group.title}
                    <span className="ml-auto text-[11px] text-muted-foreground">{groupItems.length}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenu>
                      {groupItems.map((skill) => (
                        <SidebarMenuItem key={skill.id}>
                          <SidebarMenuButton
                            isActive={location.pathname === `/skills/${skill.id}`}
                            onClick={() => navigate(`/skills/${skill.id}`)}
                          >
                            {skill.title}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
