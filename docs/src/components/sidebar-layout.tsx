import type { CSSProperties, ReactNode } from "react"
import { useEffect } from "react"
import { MenuIcon } from "lucide-react"
import { Link } from "react-router-dom"

import { Button, buttonVariants } from "@/components/ui/button"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { DocsSidebar } from "@/components/docs-sidebar"
import { docsSiteMetadata } from "@/lib/docs-site"
import { cn } from "@/lib/utils"
import {
  docsUiMessages,
  getDocumentDescription,
  getDocumentPageTitle,
  getDocumentTitle,
  getLocaleSwitchPath,
  localizeDocPath,
  type DocLocale,
} from "@/lib/docs-navigation"

export function SidebarLayout({ path, locale, children }: { path: string; locale: DocLocale; children: ReactNode }) {
  const title = getDocumentTitle(path, locale)
  const messages = docsUiMessages[locale]
  const pageTitle = title ? getDocumentPageTitle(path, locale) : `${messages.notFoundTitle} · ${messages.siteTitle}`
  const pageDescription = title ? getDocumentDescription(path, locale) ?? messages.homeDescription : messages.notFoundDescription

  useEffect(() => {
    document.title = pageTitle

    let descriptionTag = document.querySelector('meta[name="description"]')
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta")
      descriptionTag.setAttribute("name", "description")
      document.head.appendChild(descriptionTag)
    }

    descriptionTag.setAttribute("content", pageDescription)
  }, [pageDescription, pageTitle])

  return (
    <SidebarProvider style={{ "--sidebar-width": "17rem" } as CSSProperties}>
      <DocsSidebar currentPath={localizeDocPath(locale, path)} locale={locale} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-8">
          <SidebarTrigger className="md:hidden"><MenuIcon /></SidebarTrigger>
          <div className="min-w-0 text-sm text-muted-foreground">
            {messages.breadcrumbRoot} <span className="mx-2">/</span> <span className="text-foreground">{title ?? messages.notFoundTitle}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">{messages.languageLabel}</span>
            <Link
              to={getLocaleSwitchPath(localizeDocPath(locale, path), "zh")}
              className={cn(buttonVariants({ variant: locale === "zh" ? "default" : "outline", size: "sm" }))}
            >
              {messages.zhLabel}
            </Link>
            <Link
              to={getLocaleSwitchPath(localizeDocPath(locale, path), "en")}
              className={cn(buttonVariants({ variant: locale === "en" ? "default" : "outline", size: "sm" }))}
            >
              {messages.enLabel}
            </Link>
            <a href={docsSiteMetadata.repository.url} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">{messages.githubButton}</Button>
            </a>
            <a href={docsSiteMetadata.latestRelease.url} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">{messages.releaseButton}</Button>
            </a>
          </div>
        </header>
        <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-10">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}