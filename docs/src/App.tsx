import { MDXProvider } from "@mdx-js/react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { lazy, Suspense, type ComponentType } from "react"

import { mdxComponents } from "@/components/mdx-components"
import { SidebarLayout } from "@/components/sidebar-layout"
import { defaultDocLocale, docsUiMessages, localizeDocPath, type DocLocale } from "@/lib/docs-navigation"

const ArchitectureZh = lazy(() => import("./pages/technical/architecture.mdx"))
const AiZh = lazy(() => import("./pages/technical/ai.mdx"))
const ChannelRuntimeZh = lazy(() => import("./pages/technical/channel-runtime.mdx"))
const DevelopmentZh = lazy(() => import("./pages/technical/development.mdx"))
const DatabaseZh = lazy(() => import("./pages/technical/database.mdx"))
const IpcZh = lazy(() => import("./pages/technical/ipc.mdx"))
const WorkflowEngineZh = lazy(() => import("./pages/technical/workflow-engine.mdx"))
const TestingReleaseZh = lazy(() => import("./pages/technical/testing-release.mdx"))
const ProductionChecklistZh = lazy(() => import("./pages/technical/production-checklist.mdx"))
const SecurityZh = lazy(() => import("./pages/technical/security.mdx"))
const BrowserZh = lazy(() => import("./pages/technical/browser.mdx"))
const ChatsZh = lazy(() => import("./pages/user/chats.mdx"))
const ChannelsZh = lazy(() => import("./pages/user/channels.mdx"))
const DocumentsZh = lazy(() => import("./pages/user/documents.mdx"))
const InstallationZh = lazy(() => import("./pages/user/installation.mdx"))
const IntegrationsZh = lazy(() => import("./pages/user/integrations.mdx"))
const ModelsZh = lazy(() => import("./pages/user/models.mdx"))
const AgentsZh = lazy(() => import("./pages/user/agents.mdx"))
const PreferencesZh = lazy(() => import("./pages/user/preferences.mdx"))
const SchedulersZh = lazy(() => import("./pages/user/schedulers.mdx"))
const SkillsZh = lazy(() => import("./pages/user/skills.mdx"))
const WorkflowsZh = lazy(() => import("./pages/user/workflows.mdx"))
const WelcomeZh = lazy(() => import("./pages/welcome.mdx"))

const ArchitectureEn = lazy(() => import("./pages/en/technical/architecture.mdx"))
const AiEn = lazy(() => import("./pages/en/technical/ai.mdx"))
const ChannelRuntimeEn = lazy(() => import("./pages/en/technical/channel-runtime.mdx"))
const DevelopmentEn = lazy(() => import("./pages/en/technical/development.mdx"))
const DatabaseEn = lazy(() => import("./pages/en/technical/database.mdx"))
const IpcEn = lazy(() => import("./pages/en/technical/ipc.mdx"))
const WorkflowEngineEn = lazy(() => import("./pages/en/technical/workflow-engine.mdx"))
const TestingReleaseEn = lazy(() => import("./pages/en/technical/testing-release.mdx"))
const ProductionChecklistEn = lazy(() => import("./pages/en/technical/production-checklist.mdx"))
const SecurityEn = lazy(() => import("./pages/en/technical/security.mdx"))
const BrowserEn = lazy(() => import("./pages/en/technical/browser.mdx"))
const ChatsEn = lazy(() => import("./pages/en/user/chats.mdx"))
const ChannelsEn = lazy(() => import("./pages/en/user/channels.mdx"))
const DocumentsEn = lazy(() => import("./pages/en/user/documents.mdx"))
const InstallationEn = lazy(() => import("./pages/en/user/installation.mdx"))
const IntegrationsEn = lazy(() => import("./pages/en/user/integrations.mdx"))
const ModelsEn = lazy(() => import("./pages/en/user/models.mdx"))
const AgentsEn = lazy(() => import("./pages/en/user/agents.mdx"))
const PreferencesEn = lazy(() => import("./pages/en/user/preferences.mdx"))
const SchedulersEn = lazy(() => import("./pages/en/user/schedulers.mdx"))
const SkillsEn = lazy(() => import("./pages/en/user/skills.mdx"))
const WorkflowsEn = lazy(() => import("./pages/en/user/workflows.mdx"))
const WelcomeEn = lazy(() => import("./pages/en/welcome.mdx"))

const pageComponentsByLocale: Record<DocLocale, Record<string, ComponentType>> = {
  zh: {
    "/doc": WelcomeZh,
    "/doc/chat/overview": ChatsZh,
    "/doc/channels/overview": ChannelsZh,
    "/doc/documents/overview": DocumentsZh,
    "/doc/integrations/overview": IntegrationsZh,
    "/doc/models/overview": ModelsZh,
    "/doc/preferences/overview": PreferencesZh,
    "/doc/schedulers/overview": SchedulersZh,
    "/doc/skills/overview": SkillsZh,
    "/doc/getting-started/installation": InstallationZh,
    "/doc/workflows/overview": WorkflowsZh,
    "/doc/agents/overview": AgentsZh,
    "/doc/technical/architecture": ArchitectureZh,
    "/doc/technical/ipc": IpcZh,
    "/doc/technical/database": DatabaseZh,
    "/doc/technical/ai": AiZh,
    "/doc/technical/workflow-engine": WorkflowEngineZh,
    "/doc/technical/channel-runtime": ChannelRuntimeZh,
    "/doc/technical/testing-release": TestingReleaseZh,
    "/doc/technical/production-checklist": ProductionChecklistZh,
    "/doc/technical/security": SecurityZh,
    "/doc/technical/browser": BrowserZh,
    "/doc/technical/development": DevelopmentZh,
  },
  en: {
    "/doc": WelcomeEn,
    "/doc/chat/overview": ChatsEn,
    "/doc/channels/overview": ChannelsEn,
    "/doc/documents/overview": DocumentsEn,
    "/doc/integrations/overview": IntegrationsEn,
    "/doc/models/overview": ModelsEn,
    "/doc/preferences/overview": PreferencesEn,
    "/doc/schedulers/overview": SchedulersEn,
    "/doc/skills/overview": SkillsEn,
    "/doc/getting-started/installation": InstallationEn,
    "/doc/workflows/overview": WorkflowsEn,
    "/doc/agents/overview": AgentsEn,
    "/doc/technical/architecture": ArchitectureEn,
    "/doc/technical/ipc": IpcEn,
    "/doc/technical/database": DatabaseEn,
    "/doc/technical/ai": AiEn,
    "/doc/technical/workflow-engine": WorkflowEngineEn,
    "/doc/technical/channel-runtime": ChannelRuntimeEn,
    "/doc/technical/testing-release": TestingReleaseEn,
    "/doc/technical/production-checklist": ProductionChecklistEn,
    "/doc/technical/security": SecurityEn,
    "/doc/technical/browser": BrowserEn,
    "/doc/technical/development": DevelopmentEn,
  },
}

const canonicalLegacyTechnicalRoutes: Record<string, string> = {
  "/tech/ipc": "/doc/technical/ipc",
  "/tech/database": "/doc/technical/database",
  "/tech/ai": "/doc/technical/ai",
  "/tech/workflow-engine": "/doc/technical/workflow-engine",
  "/tech/channel-runtime": "/doc/technical/channel-runtime",
  "/tech/testing-release": "/doc/technical/testing-release",
  "/tech/security": "/doc/technical/security",
  "/tech/browser": "/doc/technical/browser",
}

function DocumentPage({ path, locale, Page }: { path: string; locale: DocLocale; Page: ComponentType }) {
  return (
    <SidebarLayout path={path} locale={locale}>
      <Suspense fallback={<PageLoading locale={locale} />}>
        <Page />
      </Suspense>
    </SidebarLayout>
  )
}

function PageLoading({ locale }: { locale: DocLocale }) {
  return <p className="text-sm text-muted-foreground">{docsUiMessages[locale].loading}</p>
}

function NotFound({ locale }: { locale: DocLocale }) {
  const messages = docsUiMessages[locale]

  return (
    <section>
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{messages.notFoundTitle}</h1>
      <p className="mt-5 leading-8 text-muted-foreground">{messages.notFoundDescription}</p>
      <a className="mt-6 inline-flex text-sm font-medium text-primary hover:underline" href={`${import.meta.env.BASE_URL}${localizeDocPath(locale, "/doc").slice(1)}`}>
        {messages.notFoundBack}
      </a>
    </section>
  )
}

function App() {
  return (
    <MDXProvider components={mdxComponents}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Navigate replace to={localizeDocPath(defaultDocLocale, "/doc")} />} />
          <Route path="/zh" element={<Navigate replace to="/zh/doc" />} />
          <Route path="/en" element={<Navigate replace to="/en/doc" />} />
          {Object.entries(pageComponentsByLocale).flatMap(([locale, pages]) =>
            Object.entries(pages).map(([path, Page]) => (
              <Route
                key={`${locale}:${path}`}
                path={localizeDocPath(locale as DocLocale, path)}
                element={<DocumentPage path={path} locale={locale as DocLocale} Page={Page} />}
              />
            )),
          )}
          {Object.keys(pageComponentsByLocale[defaultDocLocale]).map((path) => (
            <Route key={`legacy:${path}`} path={path} element={<Navigate replace to={localizeDocPath(defaultDocLocale, path)} />} />
          ))}
          {Object.entries(canonicalLegacyTechnicalRoutes).map(([path, destination]) => (
            <Route key={`legacy-tech:${path}`} path={path} element={<Navigate replace to={localizeDocPath(defaultDocLocale, destination)} />} />
          ))}
          {(["zh", "en"] as DocLocale[]).flatMap((locale) =>
            Object.entries(canonicalLegacyTechnicalRoutes).map(([path, destination]) => (
              <Route
                key={`${locale}:${path}`}
                path={`/${locale}${path}`}
                element={<Navigate replace to={localizeDocPath(locale, destination)} />}
              />
            )),
          )}
          <Route path="/zh/*" element={<SidebarLayout path="/not-found" locale="zh"><NotFound locale="zh" /></SidebarLayout>} />
          <Route path="/en/*" element={<SidebarLayout path="/not-found" locale="en"><NotFound locale="en" /></SidebarLayout>} />
          <Route path="*" element={<SidebarLayout path="/not-found" locale={defaultDocLocale}><NotFound locale={defaultDocLocale} /></SidebarLayout>} />
        </Routes>
      </BrowserRouter>
    </MDXProvider>
  )
}

export default App
