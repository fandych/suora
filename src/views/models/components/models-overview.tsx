import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProviderConfigRecord } from "@/data/domain/models"

type ModelsOverviewProps = {
  providers: ProviderConfigRecord[]
}

export function ModelsOverview({ providers }: ModelsOverviewProps) {
  const totalProviders = providers.length
  const enabledProviders = providers.filter((provider) => provider.enabled).length
  const totalModels = providers.reduce((count, provider) => count + provider.models.length, 0)
  const enabledModels = providers.reduce((count, provider) => count + provider.models.filter((model) => model.enabled).length, 0)

  const items = [
    { label: "Providers", value: totalProviders, meta: `${enabledProviders} enabled` },
    { label: "Models", value: totalModels, meta: `${enabledModels} active` },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight text-foreground">{item.value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{item.meta}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}