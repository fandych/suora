import { GlobalErrorBoundary } from "@/pages/components/global-error-boundary"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import AppSidebar from "@/pages/components/app-sidebar"
import { Outlet, useLocation } from "react-router"

const RootLayout = () => {
  const location = useLocation()

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
          <GlobalErrorBoundary key={location.pathname}>
            <Outlet />
          </GlobalErrorBoundary>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default RootLayout
