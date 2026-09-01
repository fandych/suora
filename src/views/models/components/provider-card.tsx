import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProviderConfigRecord } from "@/data/domain/models"

import { ProviderLogoBadge } from "@/views/models/components/provider-logo-badge"

type ProviderCardProps = {
  provider: ProviderConfigRecord
  onOpen: (providerId: string) => void
}

export function ProviderCard({ provider, onOpen }: ProviderCardProps) {
  const maskedKey = provider.apiKey.length > 6
    ? `${provider.apiKey.slice(0, 3)}***${provider.apiKey.slice(-3)}`
    : provider.apiKey

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <ProviderLogoBadge providerType={provider.providerType} className="size-10 shrink-0" iconClassName="size-5" />
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{provider.title}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{provider.providerType}</Badge>
              <Badge variant={provider.enabled ? "secondary" : "outline"}>{provider.enabled ? "Enabled" : "Disabled"}</Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Name</div>
          <div className="mt-1 truncate font-medium text-foreground">{provider.title}</div>
        </div>
        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">URL</div>
          <div className="mt-1 truncate text-foreground">{provider.baseUrl || "No base URL configured."}</div>
        </div>
        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Key</div>
          <div className="mt-1 font-mono text-foreground">{maskedKey}</div>
        </div>
        <div className="flex items-center justify-end">
          <Button variant="outline" onClick={() => onOpen(provider.id)}>Open provider</Button>
        </div>
      </CardContent>
    </Card>
  )
}