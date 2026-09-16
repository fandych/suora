import { saveDocxFile, savePdfFile, saveTextFile } from "@/lib/browser/file-exports"
import { showToast } from "@/services/toast-service"
import { buildChatTranscript } from "@/lib/chat/chat-controller-utils"
import type { AssistantResponsePart } from "@/types/chat"
import type { ChatDetail } from "@/types/chat"

export function useChatExportActions(
  selectedChat: ChatDetail | null | undefined,
  assistantResponseParts: AssistantResponsePart[],
) {
  return async (format: "markdown" | "pdf" | "docx") => {
    const baseName = `${selectedChat?.chat.title || "chat"}`.replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase() || "chat"
    const transcript = buildChatTranscript(selectedChat ?? null, assistantResponseParts)
    const result =
      format === "markdown"
        ? await saveTextFile(`${baseName}.md`, transcript, "text/markdown;charset=utf-8")
        : format === "pdf"
          ? await savePdfFile(`${baseName}.pdf`, transcript)
          : await saveDocxFile(`${baseName}.docx`, transcript)
    if (!result.canceled)
      showToast({
        title: "Export complete",
        description: result.path ?? `${baseName}.${format} saved.`,
        type: "success",
      })
  }
}
