import { useParams } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { getCatalogDetail } from "@/data/repositories/catalog-detail-repository"

type CatalogDetailPageProps = {
  route: string
  title: string
  description: string
  paramKey: string
}

const CatalogDetailPage = ({ route, title, description, paramKey }: CatalogDetailPageProps) => {
  const params = useParams()
  const itemId = params[paramKey]
  const { data, error, isLoading, reload } = useAsyncResource(
    async () => {
      const detail = await getCatalogDetail(route, itemId ?? "")
      if (!detail) {
        throw new Error(`${title} item was not found.`)
      }
      return detail
    },
    [route, itemId, title]
  )

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title={data?.title ?? title} description={description} />
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-4xl">
          {isLoading ? <LoadingCard title={`Loading ${title.toLowerCase()}...`} /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>{data.title}</CardTitle>
                  <Badge variant="outline">{data.kind}</Badge>
                </div>
                <CardDescription>{data.meta || "Detail view backed by the local catalog table."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <div className="text-muted-foreground">ID</div>
                  <div className="font-medium">{data.id}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Updated</div>
                  <div className="font-medium">{new Date(data.updatedAt).toLocaleString()}</div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default CatalogDetailPage