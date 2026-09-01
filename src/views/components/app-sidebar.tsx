import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { preferenceRoute, getPrimaryNavItem, isPreferencePath, primaryNavItems } from "@/views/nav-config";
import { useSecondarySidebarData } from "@/views/secondary-sidebar-data";
import { SettingsIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import PreferenceSidebar from "@/views/components/secondary-sidebar/preference-sidebar";
import SectionSidebar from "@/views/components/secondary-sidebar/section-sidebar";
import { CreateProviderButton } from "@/views/models/components/create-provider-button";

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
                SOURA
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
                                        className={cn(activeItem?.title === item.title ? "text-primary" : "")}
                                    >
                                        <Icon />
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
                            <SettingsIcon className="size-4 text-amber-500" />
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
                headerAction={activeItem.url === "/models" ? <CreateProviderButton size="sm" variant="outline" /> : null}
            />
        )}



    </Sidebar>
}

export default AppSidebar;