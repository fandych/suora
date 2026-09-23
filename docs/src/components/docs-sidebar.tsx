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
import { SuoraLogo } from "@/components/suora-logo"
import { docsSiteMetadata } from "@/lib/docs-site"
import { docsUiMessages, getLocalizedSections, localizeDocPath, type DocLocale } from "@/lib/docs-navigation"

export function DocsSidebar({ currentPath, locale }: { currentPath: string; locale: DocLocale }) {
  const documentationSections = getLocalizedSections(locale)
  const messages = docsUiMessages[locale]

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <Link to={localizeDocPath(locale, "/doc")} className="flex items-center gap-3 font-semibold tracking-tight">
          <SuoraLogo className="size-8 shrink-0" />
          <span>{messages.siteTitle}</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {documentationSections.map((section) => {
          const Icon = section.icon
          return (
            <SidebarGroup key={section.title}>
              <SidebarGroupLabel>
                <Icon />
                {section.title}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const ItemIcon = item.icon ?? FileTextIcon
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton render={<Link to={item.path} />} isActive={currentPath === item.path}>
                          <ItemIcon className={item.iconClassName} />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="space-y-2">
          <a
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            href={docsSiteMetadata.repository.url}
            target="_blank"
            rel="noreferrer"
          >
            <GitBranchIcon /> {messages.githubProject}
          </a>
          <a
            className="block text-xs text-muted-foreground hover:text-foreground"
            href={docsSiteMetadata.latestRelease.url}
            target="_blank"
            rel="noreferrer"
          >
            {messages.latestReleaseLabel}: {docsSiteMetadata.latestRelease.tagName}
          </a>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
