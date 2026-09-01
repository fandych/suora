import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInput } from "@/components/ui/sidebar"

const ChatSidebar = () => {
    return (
        <Sidebar collapsible="none" className="hidden flex-1 md:flex"        >
            <SidebarHeader className="gap-3.5 border-b p-4">
                <div className="flex w-full items-center justify-between">
                    <div className="text-base font-medium text-foreground">
                        Chats
                    </div>
                </div>
                <SidebarInput placeholder="Type to search..." />
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Today                    </SidebarGroupLabel>
                </SidebarGroup>

            </SidebarContent>
        </Sidebar>
    )
}

export default ChatSidebar