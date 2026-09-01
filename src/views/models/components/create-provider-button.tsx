import { useState } from "react"
import { useNavigate } from "react-router"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { emitDataChanged } from "@/data/repositories/data-events"
import { createModelProvider } from "@/data/repositories/model-config-repository"

type CreateProviderButtonProps = {
  className?: string
  iconOnly?: boolean
  size?: React.ComponentProps<typeof Button>["size"]
  variant?: React.ComponentProps<typeof Button>["variant"]
}

export function CreateProviderButton({ className, iconOnly = false, size = "sm", variant = "outline" }: CreateProviderButtonProps) {
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateProvider = async () => {
    setIsCreating(true)
    try {
      const provider = await createModelProvider("custom")
      emitDataChanged("/models")
      navigate(`/models/${provider.id}`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Button className={className} size={size} variant={variant} onClick={handleCreateProvider} disabled={isCreating}>
      <PlusIcon className="size-4" />
      {iconOnly ? null : <span>{isCreating ? "Creating..." : "Add provider"}</span>}
    </Button>
  )
}