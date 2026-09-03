import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { createAgent } from "@/data/repositories/agent-repository"
import { cn } from "@/lib/utils"

export function NewAgentButton({ className }: { className?: string }) {
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const detail = await createAgent()
      navigate(`/agents/${detail.agent.id}`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Button className={cn("h-8 shrink-0 whitespace-nowrap", className)} size="sm" variant="outline" type="button" onClick={() => void handleCreate()} disabled={isCreating}>
      {isCreating ? <Spinner /> : <PlusIcon />}
      {isCreating ? "Creating..." : "New agent"}
    </Button>
  )
}