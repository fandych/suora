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
import { useIntl } from "react-intl"
import { useLocation, useNavigate } from "react-router"
import { getPreferenceSections } from "@/pages/nav-config"

const PreferenceSidebar = () => {
  const intl = useIntl()
  const location = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const preferenceSections = getPreferenceSections(intl)
  const normalizedQuery = query.trim().toLowerCase()
  const visibleSections = normalizedQuery
    ? preferenceSections.filter((section) => section.label.toLowerCase().includes(normalizedQuery))
    : preferenceSections

  return (
    <Sidebar collapsible="none" className="hidden flex-1 border-l md:flex">
      <SidebarHeader className="gap-3.5 border-b p-4">
        <div className="flex w-full items-center justify-between">
          <div className="text-base font-medium text-foreground">{intl.formatMessage({ id: "nav.preference.title", defaultMessage: "Preference" })}</div>
        </div>
        <SidebarInput
          placeholder={intl.formatMessage({ id: "preference.sidebar.search", defaultMessage: "Search preferences..." })}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{intl.formatMessage({ id: "preference.sidebar.settings", defaultMessage: "Settings" })}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleSections.map((section) => (
                <SidebarMenuItem key={section.id}>
                  <SidebarMenuButton
                    isActive={location.pathname === section.href}
                    onClick={() => navigate(section.href)}
                  >
                    <span>{section.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            {visibleSections.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                {intl.formatMessage({ id: "preference.sidebar.noMatch", defaultMessage: "No matching preferences." })}
              </div>
            ) : null}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

export default PreferenceSidebar
