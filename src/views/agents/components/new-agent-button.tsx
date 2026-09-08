import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { createAgent } from "@/data/repositories/agent-repository"
import { emitDataChanged } from "@/data/repositories/data-events"
import { cn } from "@/lib/utils"

export function NewAgentButton({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const detail = await createAgent()
      emitDataChanged("/agents")
      navigate(`/agents/${detail.agent.id}`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Button className={cn(iconOnly ? "h-8 shrink-0" : "h-8 shrink-0 whitespace-nowrap", className)} size={iconOnly ? "icon-sm" : "sm"} variant="outline" type="button" onClick={() => void handleCreate()} disabled={isCreating} aria-label="New agent" title="New agent">
      {isCreating ? <Spinner /> : <PlusIcon />}
      {iconOnly ? null : isCreating ? "Creating..." : "New agent"}
    </Button>
  )
}