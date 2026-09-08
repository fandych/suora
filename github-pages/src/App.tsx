import { MDXProvider } from "@mdx-js/react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { lazy, Suspense, type ComponentType } from "react"

import { mdxComponents } from "@/components/mdx-components"
import { SidebarLayout } from "@/components/sidebar-layout"

const Architecture = lazy(() => import("./pages/technical/architecture.mdx"))
const Ai = lazy(() => import("./pages/technical/ai.mdx"))
const ChannelRuntime = lazy(() => import("./pages/technical/channel-runtime.mdx"))
const Development = lazy(() => import("./pages/technical/development.mdx"))
const Database = lazy(() => import("./pages/technical/database.mdx"))
const Ipc = lazy(() => import("./pages/technical/ipc.mdx"))
const WorkflowEngine = lazy(() => import("./pages/technical/workflow-engine.mdx"))
const TestingRelease = lazy(() => import("./pages/technical/testing-release.mdx"))
const Security = lazy(() => import("./pages/technical/security.mdx"))
const Browser = lazy(() => import("./pages/technical/browser.mdx"))
const Chats = lazy(() => import("./pages/user/chats.mdx"))
const Channels = lazy(() => import("./pages/user/channels.mdx"))
const Documents = lazy(() => import("./pages/user/documents.mdx"))
const Installation = lazy(() => import("./pages/user/installation.mdx"))
const Integrations = lazy(() => import("./pages/user/integrations.mdx"))
const Models = lazy(() => import("./pages/user/models.mdx"))
const Agents = lazy(() => import("./pages/user/agents.mdx"))
const Preferences = lazy(() => import("./pages/user/preferences.mdx"))
const Schedulers = lazy(() => import("./pages/user/schedulers.mdx"))
const Skills = lazy(() => import("./pages/user/skills.mdx"))
const Workflows = lazy(() => import("./pages/user/workflows.mdx"))
const Welcome = lazy(() => import("./pages/welcome.mdx"))

const pageComponents: Record<string, ComponentType> = {
  "/doc": Welcome,
  "/doc/chat/overview": Chats,
  "/doc/channels/overview": Channels,
  "/doc/documents/overview": Documents,
  "/doc/integrations/overview": Integrations,
  "/doc/models/overview": Models,
  "/doc/preferences/overview": Preferences,
  "/doc/schedulers/overview": Schedulers,
  "/doc/skills/overview": Skills,
  "/doc/getting-started/installation": Installation,
  "/doc/workflows/overview": Workflows,
  "/doc/agents/overview": Agents,
  "/doc/technical/architecture": Architecture,
  "/doc/technical/ipc": Ipc,
  "/doc/technical/database": Database,
  "/doc/technical/ai": Ai,
  "/doc/technical/workflow-engine": WorkflowEngine,
  "/doc/technical/channel-runtime": ChannelRuntime,
  "/doc/technical/testing-release": TestingRelease,
  "/doc/technical/security": Security,
  "/doc/technical/browser": Browser,
  "/doc/technical/development": Development,
}

const legacyTechnicalRoutes: Record<string, string> = {
  "/tech/ipc": "/doc/technical/ipc",
  "/tech/database": "/doc/technical/database",
  "/tech/ai": "/doc/technical/ai",
  "/tech/workflow-engine": "/doc/technical/workflow-engine",
  "/tech/channel-runtime": "/doc/technical/channel-runtime",
  "/tech/testing-release": "/doc/technical/testing-release",
  "/tech/security": "/doc/technical/security",
  "/tech/browser": "/doc/technical/browser",
}

function DocumentPage({ path, Page }: { path: string; Page: ComponentType }) {
  return (
    <SidebarLayout path={path}>
      <Suspense fallback={<PageLoading />}>
        <Page />
      </Suspense>
    </SidebarLayout>
  )
}

function PageLoading() {
  return <p className="text-sm text-muted-foreground">正在加载文档…</p>
}

function App() {
  return (
    <MDXProvider components={mdxComponents}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          {Object.entries(pageComponents).map(([path, Page]) => (
            <Route key={path} path={path} element={<DocumentPage path={path} Page={Page} />} />
          ))}
          {Object.entries(legacyTechnicalRoutes).map(([path, destination]) => (
            <Route key={path} path={path} element={<Navigate replace to={destination} />} />
          ))}
          <Route path="*" element={<SidebarLayout path="/not-found"><NotFound /></SidebarLayout>} />
        </Routes>
      </BrowserRouter>
    </MDXProvider>
  )
}

function NotFound() {
  return (
    <section>
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">未找到此文档</h1>
      <p className="mt-5 leading-8 text-muted-foreground">请选择左侧导航中的文档，或返回文档概览。</p>
      <a className="mt-6 inline-flex text-sm font-medium text-primary hover:underline" href={`${import.meta.env.BASE_URL}doc`}>返回概览</a>
    </section>
  )
}

export default App
