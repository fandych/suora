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

const PreferenceSidebar = () => {
  const [query, setQuery] = useState("")
  const sections = [
    { label: "General", targetId: "general" },
    { label: "Security", targetId: "security" },
    { label: "Mail Service", targetId: "mail-service" },
    { label: "Environment Monitor", targetId: "environment-monitor" },
    { label: "Global Environment", targetId: "global-environment" },
    { label: "About", targetId: "about" },
  ]
  const normalizedQuery = query.trim().toLowerCase()
  const visibleSections = normalizedQuery
    ? sections.filter((section) => section.label.toLowerCase().includes(normalizedQuery))
    : sections

  const scrollToSection = (targetId: string) => {
    const element = document.getElementById(targetId)
    if (!element) {
      return
    }

    element.scrollIntoView({ behavior: "smooth", block: "start" })
  }

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
                <SidebarMenuItem key={section.targetId}>
                  <SidebarMenuButton onClick={() => scrollToSection(section.targetId)}>
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