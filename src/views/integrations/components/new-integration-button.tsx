import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { createIntegration } from "@/data/repositories/integration-repository"
import { cn } from "@/lib/utils"

export function NewIntegrationButton({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const detail = await createIntegration("http")
      navigate(`/integrations/${detail.integration.id}`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Button className={cn(iconOnly ? "h-8 shrink-0" : "h-8 shrink-0 whitespace-nowrap", className)} size={iconOnly ? "icon-sm" : "sm"} variant="outline" type="button" onClick={() => void handleCreate()} disabled={isCreating} aria-label="New integration" title="New integration">
      {isCreating ? <Spinner /> : <PlusIcon />}
      {iconOnly ? null : isCreating ? "Creating..." : "New integration"}
    </Button>
  )
}