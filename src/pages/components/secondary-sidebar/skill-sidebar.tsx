import { useCallback, useEffect, useMemo, useState } from "react"
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
import { useAppIntl } from "@/lib/i18n"
import { SkillApi } from "@/services/skill-service"
import { subscribeToDataChanges } from "@/services/data-events"
import type { PrimaryNavItem } from "@/pages/nav-config"

type SkillSidebarItem = { id: string; title: string; source: string; summary: string }

const skillGroups = [
  { id: "custom", sources: ["custom"] as string[] },
  { id: "builtin", sources: ["system", "builtin"] as string[] },
  { id: "claude", sources: ["claude"] as string[] },
  { id: "codex", sources: ["codex"] as string[] },
  { id: "agents", sources: ["agents"] as string[] },
]

export default function SkillSidebar({ item, headerAction }: { item: PrimaryNavItem; headerAction?: React.ReactNode }) {
  const { language, t } = useAppIntl()
  const [items, setItems] = useState<SkillSidebarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const location = useLocation()
  const navigate = useNavigate()
  const groupTitles = new Map(item.secondarySidebar.groups.map((group) => [group.id, group.title ?? group.id]))
  const getLocalizedSkillTitle = useCallback(
    (skill: SkillSidebarItem) => {
      if (skill.title === "find-skills" || skill.id === "find-skills") {
        return language === "en" ? "Find Skills" : t("skills.item.findSkills", "Find Skills")
      }

      return skill.title
    },
    [language, t],
  )
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
    return items.filter((skill) => `${getLocalizedSkillTitle(skill)} ${skill.summary}`.toLowerCase().includes(normalizedQuery))
  }, [getLocalizedSkillTitle, items, query])

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
                    {groupTitles.get(group.id) ?? group.id}
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
                            {getLocalizedSkillTitle(skill)}
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
