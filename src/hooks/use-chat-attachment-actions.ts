import type { ChangeEvent, Dispatch, SetStateAction } from "react"
import type { ChatAttachment } from "@/types/chat"
import { showToast } from "@/services/toast-service"
import { fileToChatAttachment, mergeChatAttachments } from "@/lib/chat/chat-controller-utils"

export function useChatAttachmentActions(setAttachments: Dispatch<SetStateAction<ChatAttachment[]>>) {
  const handleAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    try {
      const nextAttachments = await Promise.all(files.map(fileToChatAttachment))
      setAttachments((current) => mergeChatAttachments(current, nextAttachments))
    } catch (error) {
      showToast({
        title: "Attachment unavailable",
        description: error instanceof Error ? error.message : String(error),
        type: "error",
      })
    }
    event.target.value = ""
  }
  const removeAttachment = (attachmentId: string) =>
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
  return { handleAttachmentChange, removeAttachment }
}
