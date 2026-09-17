import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import AppSidebar from "@/pages/components/app-sidebar"
import { Outlet } from "react-router"

const RootLayout = () => {
  return (
    <SidebarProvider
      className="h-svh overflow-hidden"
      style={
        {
          "--sidebar-width": "320px",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="min-h-0 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default RootLayout
