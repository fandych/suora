import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { deleteChat } from "@/data/repositories/chat-repository"
import { emitDataChanged } from "@/data/repositories/data-events"
import { cn } from "@/lib/utils"

type ChatDeleteButtonProps = {
  className?: string
  chatId: string
  isActive: boolean
}

export function ChatDeleteButton({ className, chatId, isActive }: ChatDeleteButtonProps) {
  const navigate = useNavigate()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const deleted = await deleteChat(chatId)
      if (!deleted) {
        toast.add({ title: "Delete failed", description: "The chat could not be deleted.", type: "error" })
        return
      }

      emitDataChanged("/chats")
      if (isActive) {
        navigate("/chats")
      }
      toast.add({ title: "Chat deleted", description: "The conversation was removed.", type: "success" })
    } catch (error) {
      toast.add({ title: "Delete failed", description: error instanceof Error ? error.message : String(error), type: "error" })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" className={cn("shrink-0", className)} data-chat-delete-trigger={chatId} disabled={isDeleting} />}>
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete chat</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the chat transcript and its messages. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isDeleting} onClick={() => void handleDelete()}>
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}