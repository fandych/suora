import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { createChannel } from "@/data/repositories/channel-repository"
import { cn } from "@/lib/utils"

export function NewChannelButton({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const detail = await createChannel()
      navigate(`/channels/${detail.channel.id}`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Button className={cn(iconOnly ? "h-8 shrink-0" : "h-8 shrink-0 whitespace-nowrap", className)} size={iconOnly ? "icon-sm" : "sm"} variant="outline" type="button" onClick={() => void handleCreate()} disabled={isCreating} aria-label="New channel" title="New channel">
      <PlusIcon className="size-4" />
      {iconOnly ? null : isCreating ? "Creating..." : "New channel"}
    </Button>
  )
}