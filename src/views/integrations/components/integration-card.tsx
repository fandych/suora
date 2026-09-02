import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { IntegrationSummary } from "@/data/domain/models"

type IntegrationCardProps = {
  integration: IntegrationSummary
  onOpen: (integrationId: string) => void
}

export function IntegrationCard({ integration, onOpen }: IntegrationCardProps) {
  return (
    <Card
      className="min-w-0 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/20 hover:shadow-sm"
      onClick={() => onOpen(integration.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(integration.id)
        }
      }}
      role="button"
      tabIndex={0}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="truncate text-base">{integration.title}</CardTitle>
          <Badge variant="outline">{integration.kind}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm leading-6 text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">
          {integration.endpoint || "No endpoint configured yet."}
        </div>
      </CardContent>
    </Card>
  )
}
