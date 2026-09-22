import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { getPreferenceRoute, getPrimaryNavItem, getPrimaryNavItems, isPreferencePath } from "@/pages/nav-config"
import { SettingsIcon } from "lucide-react"
import { useMemo } from "react"
import { useIntl } from "react-intl"
import { useLocation, useNavigate } from "react-router"
import PreferenceSidebar from "@/pages/components/secondary-sidebar/preference-sidebar"
import ChatSidebar from "@/pages/components/secondary-sidebar/chat-sidebar"
import AgentSidebar from "@/pages/components/secondary-sidebar/agent-sidebar"
import ChannelSidebar from "@/pages/components/secondary-sidebar/channel-sidebar"
import DocumentSidebar from "@/pages/components/secondary-sidebar/document-sidebar"
import IntegrationSidebar from "@/pages/components/secondary-sidebar/integration-sidebar"
import ModelSidebar from "@/pages/components/secondary-sidebar/model-sidebar"
import SchedulerSidebar from "@/pages/components/secondary-sidebar/scheduler-sidebar"
import SkillSidebar from "@/pages/components/secondary-sidebar/skill-sidebar"
import WorkflowSidebar from "@/pages/components/secondary-sidebar/workflow-sidebar"
import { NewAgentButton } from "@/pages/agents/components/new-agent-button"
import { CreateProviderButton } from "@/pages/models/components/create-provider-button"
import { SkillCreateButton } from "@/pages/skills/components/skill-create-button"
import { DocumentCreateButton } from "@/pages/documents/components/document-create-button"
import { NewChatButton } from "@/pages/chats/components/new-chat-button"
import { NewChannelButton } from "@/pages/channels/components/new-channel-button"
import { NewWorkflowButton } from "@/pages/workflows/components/new-workflow-button"
import { NewIntegrationButton } from "@/pages/integrations/components/new-integration-button"
import { NewSchedulerButton } from "@/pages/schedulers/components/new-scheduler-button"
import { SuoraLogo } from "@/pages/components/suora-logo"

const AppSidebar = (props: React.ComponentProps<typeof Sidebar>) => {
  const intl = useIntl()
  const { setOpen } = useSidebar()
  const navigate = useNavigate()
  const location = useLocation()
  const primaryNavItems = useMemo(() => getPrimaryNavItems(intl), [intl])
  const preferenceRoute = useMemo(() => getPreferenceRoute(intl), [intl])

  const activeItem = getPrimaryNavItem(location.pathname, intl)
  const showPreferenceSidebar = isPreferencePath(location.pathname)
  const sidebarProps = activeItem
    ? {
        item: activeItem,
        headerAction:
          activeItem.url === "/models" ? (
            <CreateProviderButton iconOnly size="sm" variant="outline" />
          ) : activeItem.url === "/chats" ? (
            <NewChatButton iconOnly />
          ) : activeItem.url === "/agents" ? (
            <NewAgentButton iconOnly />
          ) : activeItem.url === "/workflows" ? (
            <NewWorkflowButton iconOnly />
          ) : activeItem.url === "/integrations" ? (
            <NewIntegrationButton iconOnly />
          ) : activeItem.url === "/schedulers" ? (
            <NewSchedulerButton iconOnly />
          ) : activeItem.url === "/skills" ? (
            <SkillCreateButton iconOnly />
          ) : activeItem.url === "/documents" ? (
            <DocumentCreateButton iconOnly />
          ) : activeItem.url === "/channels" ? (
            <NewChannelButton iconOnly />
          ) : null,
      }
    : null
  const SecondarySidebar =
    activeItem?.url === "/chats"
      ? ChatSidebar
      : activeItem?.url === "/agents"
        ? AgentSidebar
        : activeItem?.url === "/channels"
          ? ChannelSidebar
          : activeItem?.url === "/documents"
            ? DocumentSidebar
            : activeItem?.url === "/integrations"
              ? IntegrationSidebar
              : activeItem?.url === "/models"
                ? ModelSidebar
                : activeItem?.url === "/schedulers"
                  ? SchedulerSidebar
                  : activeItem?.url === "/skills"
                    ? SkillSidebar
                    : activeItem?.url === "/workflows"
                      ? WorkflowSidebar
                      : null

  return (
    <Sidebar collapsible="icon" className="overflow-hidden *:data-[sidebar=sidebar]:flex-row" {...props}>
      <Sidebar collapsible="none" className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r">
        <SidebarHeader>
          <div className="flex items-center justify-center py-1 text-foreground">
            <SuoraLogo className="size-7" />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {primaryNavItems.map((item) => {
                  const Icon = item.icon

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        tooltip={{ children: item.title, hidden: false }}
                        onClick={() => {
                          setOpen(true)
                          navigate(item.url)
                        }}
                        isActive={activeItem?.title === item.title}
                        className={cn(
                          activeItem?.title === item.title ? "bg-sidebar-accent text-sidebar-accent-foreground" : "",
                        )}
                      >
                        <Icon className={cn("size-4", item.iconClassName)} />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={{ children: preferenceRoute.title, hidden: false }}
                onClick={() => {
                  setOpen(true)
                  navigate(preferenceRoute.url)
                }}
                isActive={showPreferenceSidebar}
              >
                <SettingsIcon className={cn("size-4", preferenceRoute.iconClassName)} />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {showPreferenceSidebar && <PreferenceSidebar />}

      {SecondarySidebar && sidebarProps && !showPreferenceSidebar ? <SecondarySidebar {...sidebarProps} /> : null}
    </Sidebar>
  )
}

export default AppSidebar
