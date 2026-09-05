import { useNavigate } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { listSchedulers } from "@/data/repositories/scheduler-repository"
import PageHeader from "@/views/components/page-header"
import { EmptyCard, ErrorCard, LoadingCard } from "@/views/components/resource-state"

const SchedulersPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => listSchedulers(), [])

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title="Schedulers" />
      <div className="flex-1 p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading schedulers..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data?.length === 0 ? <EmptyCard title="No schedulers yet" description="Create the first scheduler configuration." /> : null}
          {!isLoading && !error && data?.length
            ? data.map((item) => (
                <Card key={item.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{item.title}</CardTitle>
                      <Badge variant={item.enabled ? "default" : "secondary"}>{item.enabled ? "Enabled" : "Disabled"}</Badge>
                      <Badge variant="outline">{item.targetType}</Badge>
                    </div>
                    <CardDescription>{item.description || "No description yet."}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-muted-foreground">
                        {(item.targetName || "No target selected")} · {item.schedule}
                      </div>
                      <Button variant="outline" onClick={() => navigate(`/schedulers/${item.id}`)}>Open scheduler</Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            : null}
        </div>
      </div>
    </div>
  )
}

export default SchedulersPage