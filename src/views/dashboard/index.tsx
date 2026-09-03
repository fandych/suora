import { useMemo } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { hasSuoraBridge } from "@/lib/ipc"
import { LoadingCard, ErrorCard } from "@/views/components/resource-state"
import PageHeader from "@/views/components/page-header"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { getDashboardSnapshot } from "@/data/repositories/catalog-repository"

const DashboardPage = () => {
  const hasBridge = hasSuoraBridge()
  const { data, error, isLoading, reload } = useAsyncResource(() => getDashboardSnapshot(), [])

  const cards = useMemo(() => {
    if (!data) {
      return []
    }

    return [
      ["Chats", data.counts.chats],
      ["Workflows", data.counts.workflows],
      ["Skills", data.counts.skills],
      ["Documents", data.counts.documents],
      ["Agents", data.counts.agents],
      ["Providers", data.counts.providers],
    ]
  }, [data])

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title="Dashboard"
        actions={data ? <Badge variant="outline">Storage: {data.storage}</Badge> : null}
      />

      <div className="flex-1 p-6">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-3">
          {!hasBridge ? (
            <Card className="md:col-span-2 xl:col-span-3">
              <CardHeader>
                <CardTitle>Open In Electron</CardTitle>
                <CardDescription>This page is running in a browser preview, so the Electron IPC bridge is unavailable.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Launch the desktop window with `npm run dev` and use the Electron app to view channels, models, documents, and other local workspace data.
              </CardContent>
            </Card>
          ) : null}
          {isLoading ? <LoadingCard title="Loading workspace snapshot..." /> : null}
          {hasBridge && error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data
            ? cards.map(([label, value]) => (
                <Card key={label}>
                  <CardHeader>
                    <CardTitle>{label}</CardTitle>
                    <CardDescription>Records currently stored locally.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold">{value}</div>
                  </CardContent>
                </Card>
              ))
            : null}
        </div>
      </div>
    </div>
  )
}

export default DashboardPage