import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/views/components/app-sidebar";
import { Outlet } from "react-router";


const RootLayout = () => {
    return (<SidebarProvider
        style={
            {
                "--sidebar-width": "350px",
            } as React.CSSProperties
        }
    >
        <AppSidebar />
        <SidebarInset>
            <Outlet />
        </SidebarInset>
    </SidebarProvider>)
}

export default RootLayout;
