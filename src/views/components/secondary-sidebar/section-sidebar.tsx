import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EllipsisIcon, Trash2Icon } from "lucide-react"

import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { useLocation } from "react-router"
import { deleteDocument } from "@/data/repositories/document-repository"
import { emitDataChanged } from "@/data/repositories/data-events"
import { deleteModelProvider, listModelProviders, saveModelProvider } from "@/data/repositories/model-config-repository"
import { deleteSkill, getSkillDetail, saveSkillDraft } from "@/data/repositories/skill-repository"
import { ChatDeleteButton } from "@/views/chats/components/chat-delete-button"

import type { ResolvedSecondarySidebarGroup } from "@/views/nav-config"

type SectionSidebarProps = {
  title: string
  searchPlaceholder: string
  groups: ResolvedSecondarySidebarGroup[]
  isLoading?: boolean
  headerAction?: React.ReactNode
  renderGroupAction?: (group: ResolvedSecondarySidebarGroup) => React.ReactNode
}

const SectionSidebar = ({ title, searchPlaceholder, groups, isLoading = false, headerAction, renderGroupAction }: SectionSidebarProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState("")

  const handleItemAction = async (itemId: string, actionId: string) => {
    if (title === "Models") {
      if (actionId === "delete") {
        await deleteModelProvider(itemId)
      } else {
        const providers = await listModelProviders()
        const provider = providers.find((record) => record.id === itemId)
        if (!provider) return
        if (actionId === "enable" || actionId === "disable") {
          await saveModelProvider({ ...provider, enabled: actionId === "enable" })
        }
      }
      emitDataChanged("/models")
      if (location.pathname === `/models/${itemId}`) navigate("/models")
      return
    }

    if (title === "Skills") {
      const detail = actionId !== "delete" ? await getSkillDetail(itemId) : null
      if (actionId === "delete") {
        await deleteSkill(itemId)
      } else if (detail && actionId === "disable") {
        const nextFiles = detail.files.map((file) => file.path === "SKILL.md" ? { ...file, content: detail.files.find((candidate) => candidate.path === "SKILL.md")?.content ?? file.content } : file)
        await saveSkillDraft(itemId, { title: detail.skill.title, source: detail.skill.source, summary: `[disabled] ${detail.skill.summary}`.trim(), files: nextFiles })
      }
      emitDataChanged("/skills")
      if (location.pathname === `/skills/${itemId}`) navigate("/skills")
      return
    }

    if (title === "Documents") {
      if (actionId === "delete") {
        await deleteDocument(itemId)
        emitDataChanged("/documents")
        if (location.pathname === `/documents/${itemId}`) navigate("/documents")
      }
      return
    }
  }

  const filteredGroups = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) {
      return groups
    }

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const haystack = `${item.label} ${item.meta ?? ""}`.toLowerCase()
          return haystack.includes(keyword)
        }),
      }))
      .filter((group) => group.items.length > 0)
  }, [groups, query])

  return (
    <Sidebar collapsible="none" className="hidden flex-1 border-l md:flex">
      <SidebarHeader className="gap-2.5 border-b p-3">
        <div className="flex min-w-0 w-full items-center justify-between gap-2">
          <div className="min-w-0 truncate text-base font-medium text-foreground">{title}</div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>
        <SidebarInput placeholder={searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} />
      </SidebarHeader>
      <SidebarContent className="overflow-y-auto">
        {filteredGroups.map((group) => {
          const groupKey = group.id
          const groupAction = renderGroupAction?.(group)

          return (
            <SidebarGroup key={groupKey}>
              {group.title || groupAction ? (
                <div className="flex items-center justify-between gap-2 px-2 pb-0.5">
                  {group.title ? <SidebarGroupLabel className="h-auto px-0 py-0">{group.title}</SidebarGroupLabel> : <span />}
                  {groupAction}
                </div>
              ) : null}
              <SidebarGroupContent>
                <SidebarMenu>
                  {isLoading
                    ? Array.from({ length: 3 }).map((_, index) => (
                        <SidebarMenuItem key={`${groupKey}-loading-${index}`}>
                          <SidebarMenuSkeleton />
                        </SidebarMenuItem>
                      ))
                    : group.items.map((item) => (
                        <SidebarMenuItem key={item.id} {...(title === "Chats" ? { "data-chat-history-item": item.id } : {})}>
                          <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
                            <SidebarMenuButton isActive={location.pathname === item.href} onClick={() => navigate(item.href)} className="min-w-0 justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-2 overflow-hidden">
                                {item.icon ? <item.icon className="size-4 shrink-0 text-muted-foreground" /> : null}
                                <span className="block min-w-0 flex-1 truncate">{item.label}</span>
                              </span>
                              {typeof item.count === "number" ? <Badge variant="secondary" className="shrink-0">{item.count}</Badge> : null}
                            </SidebarMenuButton>
                            {title === "Chats" && item.actions?.some((action) => action.id === "delete") ? (
                              <ChatDeleteButton className="opacity-100 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" chatId={item.id} isActive={location.pathname === item.href} />
                            ) : null}
                            {title !== "Models" && title !== "Chats" && item.actions?.length ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="shrink-0" />}>
                                  <EllipsisIcon />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 min-w-40">
                                  {item.actions.map((action) => (
                                    <DropdownMenuItem key={action.id} variant={action.variant ?? "default"} onClick={() => void handleItemAction(item.id, action.id)}>
                                      {action.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                          </div>
                        </SidebarMenuItem>
                      ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
    </Sidebar>
  )
}

export default SectionSidebar