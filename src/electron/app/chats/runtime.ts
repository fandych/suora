import { z } from "zod"
import crypto from "node:crypto"
import { appendChatMessage } from "@/electron/app/chats/repository"
import { runChatAgent } from "@/electron/app/chats/agent"
import { chatApplicationService } from "@/electron/app/chats/service"
import { validateChatAttachments } from "@/electron/app/chats/chat-attachment-policy"
import { classifyChatRuntimeError } from "@/electron/app/chats/chat-runtime-error-classifier"

const sendMessageSchema = z.object({
  sessionId: z.string().min(1),
  message: z.object({
    content: z.string().max(100_000),
    attachments: z
      .array(
        z.object({
          id: z.string().min(1),
          sourceKey: z.string().min(1),
          name: z.string().min(1),
          mediaType: z.string().min(1),
          kind: z.enum(["image", "file"]),
          data: z.string().min(1),
          sizeBytes: z.number().nonnegative().optional(),
        }),
      )
      .default([]),
  }),
})

const runControllers = new Map<string, { controller: AbortController; chatId: string; sender: Electron.WebContents }>()

export function startChatRuntime(value: unknown, sender: Electron.WebContents) {
  const input = sendMessageSchema.parse(value)
  const requestId = crypto.randomUUID()
  const controller = new AbortController()
  runControllers.set(requestId, { controller, chatId: input.sessionId, sender })
  void (async () => {
    try {
      validateChatAttachments(input.message.attachments)
      const settings = await chatApplicationService.getSessionSettings(input.sessionId)
      const parts = [
        ...(input.message.content.trim()
          ? [{ id: "user-text", type: "text", content: input.message.content.trim() }]
          : []),
        ...input.message.attachments.map((attachment, index) => ({
          id: `user-attachment-${index + 1}`,
          type: "attachment",
          attachment,
        })),
      ]
      const content =
        input.message.content.trim() ||
        input.message.attachments.map((attachment) => `[Attachment: ${attachment.name}]`).join("\n")
      sender.send("chat-runtime-listener", { requestId, type: "started", chatId: input.sessionId })
      await appendChatMessage({ chatId: input.sessionId, content, parts }, "user")
      await runChatAgent(sender, {
        requestId,
        chatId: input.sessionId,
        settings: settings.runtime,
        selectedAgentId: settings.selectedAgentId || undefined,
        abortSignal: controller.signal,
      })
    } catch (error) {
      if (!sender.isDestroyed())
        sender.send("chat-runtime-listener", {
          requestId,
          chatId: input.sessionId,
          type: "error",
          error: error instanceof Error ? error.message : String(error),
          errorKind: classifyChatRuntimeError(error),
        })
    } finally {
      runControllers.delete(requestId)
    }
  })()
  return { requestId, sessionId: input.sessionId }
}

export function cancelChatRuntime(requestId: string) {
  const id = z.string().min(1).max(128).parse(requestId)
  const run = runControllers.get(id)
  run?.controller.abort()
  return { cancelled: Boolean(run), requestId: id }
}
