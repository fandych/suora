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
} from "@/components/ui/sidebar"
import { useState } from "react"
import { useLocation, useNavigate } from "react-router"
import { preferenceSections } from "@/views/nav-config"

const PreferenceSidebar = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLowerCase()
  const visibleSections = normalizedQuery
    ? preferenceSections.filter((section) => section.label.toLowerCase().includes(normalizedQuery))
    : preferenceSections

  return (
    <Sidebar collapsible="none" className="hidden flex-1 border-l md:flex">
      <SidebarHeader className="gap-3.5 border-b p-4">
        <div className="flex w-full items-center justify-between">
          <div className="text-base font-medium text-foreground">Preference</div>
        </div>
        <SidebarInput placeholder="Search preferences..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleSections.map((section) => (
                <SidebarMenuItem key={section.id}>
                  <SidebarMenuButton isActive={location.pathname === section.href} onClick={() => navigate(section.href)}>
                    <span>{section.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            {visibleSections.length === 0 ? <div className="px-2 py-2 text-xs text-muted-foreground">No matching preferences.</div> : null}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

export default PreferenceSidebar