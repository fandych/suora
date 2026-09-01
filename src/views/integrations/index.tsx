import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import PageHeader from "@/views/components/page-header"
import { EmptyCard, ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { createIntegration, listIntegrationSummaries } from "@/data/repositories/integration-repository"

const IntegrationsPage = () => {
  const navigate = useNavigate()
  const { data, error, isLoading, reload } = useAsyncResource(() => listIntegrationSummaries(), [])

  const handleCreate = async () => {
    const detail = await createIntegration("http")
    navigate(`/integrations/${detail.integration.id}`)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title="Integrations"
        description="Manage versioned HTTP, script, and MCP integrations."
        actions={<Button onClick={handleCreate}>New integration</Button>}
      />

      <div className="flex-1 p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          {isLoading ? <LoadingCard title="Loading integrations..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data?.length === 0 ? (
            <EmptyCard title="No integrations yet" description="Create an HTTP, script, or MCP integration and version it like the other runtime modules." />
          ) : null}
          {!isLoading && !error && data?.length
            ? data.map((integration) => (
                <Card key={integration.id}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CardTitle>{integration.title}</CardTitle>
                      <Badge variant="outline">{integration.kind}</Badge>
                    </div>
                    <CardDescription>{integration.endpoint || "No endpoint configured yet."}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" onClick={() => navigate(`/integrations/${integration.id}`)}>
                      Open integration
                    </Button>
                  </CardContent>
                </Card>
              ))
            : null}
        </div>
      </div>
    </div>
  )
}

export default IntegrationsPage