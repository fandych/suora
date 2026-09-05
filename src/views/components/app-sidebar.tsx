import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { preferenceRoute, getPrimaryNavItem, isPreferencePath, primaryNavItems } from "@/views/nav-config";
import { useSecondarySidebarData } from "@/views/secondary-sidebar-data";
import { SettingsIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import PreferenceSidebar from "@/views/components/secondary-sidebar/preference-sidebar";
import SectionSidebar from "@/views/components/secondary-sidebar/section-sidebar";
import { NewAgentButton } from "@/views/agents/components/new-agent-button";
import { CreateProviderButton } from "@/views/models/components/create-provider-button";
import { SkillCreateButton } from "@/views/skills/components/skill-create-button";
import { DocumentCreateButton } from "@/views/documents/components/document-create-button";
import { NewChatButton } from "@/views/chats/components/new-chat-button";
import { NewChannelButton } from "@/views/channels/components/new-channel-button";
import { NewWorkflowButton } from "@/views/workflows/components/new-workflow-button";
import { NewIntegrationButton } from "@/views/integrations/components/new-integration-button";
import { NewSchedulerButton } from "@/views/schedulers/components/new-scheduler-button";
import { SuoraLogo } from "@/views/components/suora-logo";

const AppSidebar = (props: React.ComponentProps<typeof Sidebar>) => {
    const { setOpen } = useSidebar()
    const navigate = useNavigate();
    const location = useLocation();

    const activeItem = getPrimaryNavItem(location.pathname);
    const showPreferenceSidebar = isPreferencePath(location.pathname);
    const { groups, isLoading } = useSecondarySidebarData(activeItem);

    return <Sidebar
        collapsible="icon"
        className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
        {...props}
    >
        <Sidebar
            collapsible="none"
            className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
        >
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
                                const Icon = item.icon;

                                return (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        tooltip={{ children: item.title, hidden: false }}
                                        onClick={() => {
                                            setOpen(true);
                                            navigate(item.url);
                                        }}
                                        isActive={activeItem?.title === item.title}
                                        className={cn(activeItem?.title === item.title ? "bg-sidebar-accent text-sidebar-accent-foreground" : "")}
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
                                setOpen(true);
                                navigate(preferenceRoute.url);
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

        {activeItem && !showPreferenceSidebar && (
            <SectionSidebar
                title={activeItem.title}
                searchPlaceholder={activeItem.secondarySidebar.searchPlaceholder}
                groups={groups}
                isLoading={isLoading}
                                headerAction={activeItem.url === "/models"
                                    ? <CreateProviderButton iconOnly size="sm" variant="outline" />
                                    : activeItem.url === "/chats"
                                        ? <NewChatButton iconOnly />
                                    : activeItem.url === "/agents"
                                        ? <NewAgentButton iconOnly />
                                    : activeItem.url === "/workflows"
                                        ? <NewWorkflowButton iconOnly />
                                    : activeItem.url === "/integrations"
                                        ? <NewIntegrationButton iconOnly />
                                    : activeItem.url === "/schedulers"
                                        ? <NewSchedulerButton iconOnly />
                                    : activeItem.url === "/skills"
                                        ? <SkillCreateButton iconOnly />
                                        : activeItem.url === "/documents"
                                            ? <DocumentCreateButton iconOnly />
                                            : activeItem.url === "/channels"
                                                ? <NewChannelButton iconOnly />
                                            : null}
            />
        )}



    </Sidebar>
}

export default AppSidebar;