import type { CSSProperties, ReactNode } from "react"
import { MenuIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { DocsSidebar } from "@/components/docs-sidebar"
import { findDocument } from "@/lib/docs-navigation"

export function SidebarLayout({ path, children }: { path: string; children: ReactNode }) {
  const document = findDocument(path)

  return (
    <SidebarProvider style={{ "--sidebar-width": "17rem" } as CSSProperties}>
      <DocsSidebar currentPath={path} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-8">
          <SidebarTrigger className="md:hidden"><MenuIcon /></SidebarTrigger>
          <div className="min-w-0 text-sm text-muted-foreground">文档 <span className="mx-2">/</span> <span className="text-foreground">{document?.title ?? "页面未找到"}</span></div>
          <a href="https://github.com/fandych/suora" target="_blank" rel="noreferrer" className="ml-auto">
            <Button variant="outline" size="sm">GitHub</Button>
          </a>
        </header>
        <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-10">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}