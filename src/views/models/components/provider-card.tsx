import { Badge } from "@/components/ui/badge"
import type { ProviderConfigRecord } from "@/data/domain/models"

import { BrandedResourceCard } from "@/views/components/branded-resource-card"
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
    <BrandedResourceCard
      title={provider.title}
      description={provider.baseUrl || "No base URL configured."}
      leading={<ProviderLogoBadge providerType={provider.providerType} className="size-10 shrink-0" iconClassName="size-5" />}
      badges={(
        <>
          <Badge variant="outline">{provider.providerType}</Badge>
          <Badge variant={provider.enabled ? "secondary" : "outline"}>{provider.enabled ? "Enabled" : "Disabled"}</Badge>
        </>
      )}
      actionLabel="Open provider"
      onOpen={() => onOpen(provider.id)}
      metrics={[
        { label: "URL", value: provider.baseUrl || "No base URL configured." },
        { label: "Key", value: maskedKey || "Not configured", mono: true },
      ]}
    />
  )
}