import { z } from "zod"
import crypto from "node:crypto"
import { appendChatMessage } from "@/electron/app/chats/repository"
import { runChatAgent } from "@/electron/app/chats/agent"
import { chatApplicationService } from "@/electron/app/chats/service"
import { validateChatAttachments } from "@/electron/app/chats/chat-attachment-policy"
import { classifyChatRuntimeError } from "@/electron/app/chats/chat-runtime-error-classifier"
import { parseChatSendMessagePayload } from "@/electron/app/chats/chat-schemas"
import type { ChatMessagePart } from "@/types/chat"

const runControllers = new Map<string, { controller: AbortController; chatId: string; sender: Electron.WebContents }>()
const runtimeStatuses = new Map<
  string,
  { requestId: string; chatId: string; status: "running" | "completed" | "failed" | "cancelled"; error?: string; errorKind?: string; updatedAt: number }
>()
const COMPLETED_STATUS_TTL_MS = 5 * 60_000

function scheduleRuntimeStatusCleanup(requestId: string) {
  const handle = globalThis.setTimeout(() => runtimeStatuses.delete(requestId), COMPLETED_STATUS_TTL_MS)
  ;(handle as { unref?: () => void }).unref?.()
}

function setRuntimeStatus(
  requestId: string,
  chatId: string,
  status: "running" | "completed" | "failed" | "cancelled",
  error?: string,
  errorKind?: string,
) {
  runtimeStatuses.set(requestId, { requestId, chatId, status, error, errorKind, updatedAt: Date.now() })
  if (status !== "running") scheduleRuntimeStatusCleanup(requestId)
}

export function getChatRuntimeStatus(requestId: string) {
  return runtimeStatuses.get(requestId) ?? null
}

export async function startChatRuntime(value: unknown, sender: Electron.WebContents) {
  const input = parseChatSendMessagePayload(value)
  const requestId = crypto.randomUUID()
  const controller = new AbortController()
  runControllers.set(requestId, { controller, chatId: input.sessionId, sender })
  setRuntimeStatus(requestId, input.sessionId, "running")
  try {
    validateChatAttachments(input.message.attachments)
    const settings = await chatApplicationService.getSessionSettings(input.sessionId)
    const textParts: ChatMessagePart[] = input.message.content.trim()
      ? [{ id: "user-text", type: "text", content: input.message.content.trim() }]
      : []
    const attachmentParts: ChatMessagePart[] = input.message.attachments.map((attachment, index) => ({
      id: `user-attachment-${index + 1}`,
      type: "attachment",
      attachment,
    }))
    const parts: ChatMessagePart[] = [...textParts, ...attachmentParts]
    const content =
      input.message.content.trim() || input.message.attachments.map((attachment) => `[Attachment: ${attachment.name}]`).join("\n")
    const detail = await appendChatMessage({ chatId: input.sessionId, content, parts }, "user")
    sender.send("chat-runtime-listener", { requestId, type: "started", chatId: input.sessionId })

    void (async () => {
      try {
        const result = await runChatAgent(sender, {
          requestId,
          chatId: input.sessionId,
          settings: settings.runtime,
          selectedAgentId: settings.selectedAgentId || undefined,
          abortSignal: controller.signal,
        })
        setRuntimeStatus(requestId, input.sessionId, result.status, result.error, result.errorKind)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const errorKind = classifyChatRuntimeError(error)
        setRuntimeStatus(requestId, input.sessionId, "failed", message, errorKind)
        if (!sender.isDestroyed())
          sender.send("chat-runtime-listener", {
            requestId,
            chatId: input.sessionId,
            type: "error",
            error: message,
            errorKind,
          })
      } finally {
        runControllers.delete(requestId)
      }
    })().catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Unhandled chat runtime failure for ${requestId}:`, error)
      setRuntimeStatus(requestId, input.sessionId, "failed", message, classifyChatRuntimeError(error))
    })

    if (!detail) {
      throw new Error(`Chat ${input.sessionId} was not found.`)
    }

    return { requestId, sessionId: input.sessionId, detail }
  } catch (error) {
    runControllers.delete(requestId)
    const message = error instanceof Error ? error.message : String(error)
    const errorKind = classifyChatRuntimeError(error)
    setRuntimeStatus(requestId, input.sessionId, "failed", message, errorKind)
    throw error
  }
}

export function cancelChatRuntime(requestId: string) {
  const id = z.string().min(1).max(128).parse(requestId)
  const run = runControllers.get(id)
  if (run) {
    setRuntimeStatus(id, run.chatId, "cancelled")
  }
  run?.controller.abort()
  return { cancelled: Boolean(run), requestId: id }
}
