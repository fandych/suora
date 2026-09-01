import { useMemo } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingCard, ErrorCard } from "@/views/components/resource-state"
import PageHeader from "@/views/components/page-header"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { getDashboardSnapshot } from "@/data/repositories/catalog-repository"

const DashboardPage = () => {
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
        description="Overview of local modules stored in the SQLite workspace."
        actions={data ? <Badge variant="outline">Storage: {data.storage}</Badge> : null}
      />

      <div className="flex-1 p-6">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading ? <LoadingCard title="Loading workspace snapshot..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
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