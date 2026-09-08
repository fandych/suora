import { FileTextIcon, GitBranchIcon } from "lucide-react"
import { Link } from "react-router-dom"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { documentationSections } from "@/lib/docs-navigation"

export function DocsSidebar({ currentPath }: { currentPath: string }) {
  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <Link to="/doc" className="flex items-center gap-3 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">S</span>
          <span>SUORA Docs</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {documentationSections.map((section) => {
          const Icon = section.icon
          return (
            <SidebarGroup key={section.title}>
              <SidebarGroupLabel><Icon />{section.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton render={<Link to={item.path} />} isActive={currentPath === item.path}>
                        <FileTextIcon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
      <SidebarFooter className="p-4">
        <a className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" href="https://github.com/fandych/suora" target="_blank" rel="noreferrer">
          <GitBranchIcon /> 在 GitHub 查看项目
        </a>
      </SidebarFooter>
    </Sidebar>
  )
}