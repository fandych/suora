import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { useAppIntl } from "@/lib/i18n"
import { ChannelApi } from "@/services/channel-service"
import { emitDataChanged } from "@/services/data-events"
import { cn } from "@/lib/utils"

export function NewChannelButton({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const { t } = useAppIntl()
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const detail = await ChannelApi.create()
      emitDataChanged("/channels")
      navigate(`/channels/${detail.channel.id}`)
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
      aria-label={t("newChannel.button", "New channel")}
      title={t("newChannel.button", "New channel")}
    >
      <PlusIcon className="size-4" />
      {iconOnly ? null : isCreating ? t("newChannel.creating", "Creating...") : t("newChannel.button", "New channel")}
    </Button>
  )
}
