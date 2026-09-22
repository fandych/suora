import { useState } from "react"
import { useNavigate } from "react-router"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAppIntl } from "@/lib/i18n"
import { emitDataChanged } from "@/services/data-events"
import { ModelApi } from "@/services/model-service"

type CreateProviderButtonProps = {
  className?: string
  iconOnly?: boolean
  size?: React.ComponentProps<typeof Button>["size"]
  variant?: React.ComponentProps<typeof Button>["variant"]
}

export function CreateProviderButton({
  className,
  iconOnly = false,
  size = "sm",
  variant = "outline",
}: CreateProviderButtonProps) {
  const { t } = useAppIntl()
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateProvider = async () => {
    setIsCreating(true)
    try {
      const provider = await ModelApi.create({ providerType: "custom" })
      emitDataChanged("/models")
      navigate(`/models/${provider.id}`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Button
      className={className}
      size={iconOnly ? "icon-sm" : size}
      variant={variant}
      onClick={handleCreateProvider}
      disabled={isCreating}
      aria-label={t("newProvider.button", "Add provider")}
      title={t("newProvider.button", "Add provider")}
    >
      <PlusIcon className="size-4" />
      {iconOnly ? null : (
        <span>{isCreating ? t("newProvider.creating", "Creating...") : t("newProvider.button", "Add provider")}</span>
      )}
    </Button>
  )
}
