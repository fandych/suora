import { cn } from "@/lib/utils"
import { getProviderBrandClassName, getProviderLogo } from "@/views/components/provider-logo"

type ProviderLogoBadgeProps = {
  providerType: string
  className?: string
  iconClassName?: string
}

export function ProviderLogoBadge({ providerType, className, iconClassName }: ProviderLogoBadgeProps) {
  const ProviderLogo = getProviderLogo(providerType)
  const brandClassName = getProviderBrandClassName(providerType)

  return (
    <span className={cn("flex size-9 items-center justify-center rounded-xl border border-border bg-background", className)}>
      <ProviderLogo className={cn("size-5 shrink-0", brandClassName, iconClassName)} />
    </span>
  )
}