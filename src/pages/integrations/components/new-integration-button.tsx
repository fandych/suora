import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useAppIntl } from "@/lib/i18n"
import { IntegrationApi } from "@/services/integration-service"
import { emitDataChanged } from "@/services/data-events"
import { cn } from "@/lib/utils"

export function NewIntegrationButton({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const { t } = useAppIntl()
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const detail = await IntegrationApi.create({ kind: "http" })
      emitDataChanged("/integrations")
      navigate(`/integrations/${detail.integration.id}`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Button
      className={cn(iconOnly ? "h-8 shrink-0" : "h-8 shrink-0 whitespace-nowrap", className)}
      size={iconOnly ? "icon-sm" : "sm"}
      variant="outline"
      type="button"
      onClick={() => void handleCreate()}
      disabled={isCreating}
      aria-label={t("newIntegration.button", "New integration")}
      title={t("newIntegration.button", "New integration")}
    >
      {isCreating ? <Spinner /> : <PlusIcon />}
      {iconOnly ? null : isCreating ? t("newIntegration.creating", "Creating...") : t("newIntegration.button", "New integration")}
    </Button>
  )
}
