import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/views/components/app-sidebar";
import { Outlet } from "react-router";


const RootLayout = () => {
    return (<SidebarProvider
        style={
            {
                "--sidebar-width": "320px",
            } as React.CSSProperties
        }
    >
        <AppSidebar />
        <SidebarInset className="min-h-0">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <Outlet />
            </div>
        </SidebarInset>
    </SidebarProvider>)
}

export default RootLayout;
