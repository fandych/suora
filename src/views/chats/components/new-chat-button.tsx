import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

export function NewChatButton({ className }: { className?: string }) {
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      navigate("/chats")
      toast.add({ title: "New draft", description: "Start typing to create a real chat.", type: "info", timeout: 2500 })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Button className={cn("h-8 shrink-0 whitespace-nowrap", className)} size="sm" variant="outline" type="button" data-chat-new-button onClick={() => void handleCreate()} disabled={isCreating}>
      {isCreating ? <Spinner /> : <PlusIcon />}
      {isCreating ? "Creating..." : "New chat"}
    </Button>
  )
}