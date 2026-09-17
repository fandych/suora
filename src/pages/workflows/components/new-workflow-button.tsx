import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { WorkflowApi } from "@/services/workflow-service"
import { emitDataChanged } from "@/services/data-events"
import { cn } from "@/lib/utils"

export function NewWorkflowButton({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const detail = await WorkflowApi.create()
      emitDataChanged("/workflows")
      navigate(`/workflows/${detail.workflow.id}`)
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
      aria-label="New workflow"
      title="New workflow"
    >
      {isCreating ? <Spinner /> : <PlusIcon />}
      {iconOnly ? null : isCreating ? "Creating..." : "New workflow"}
    </Button>
  )
}
