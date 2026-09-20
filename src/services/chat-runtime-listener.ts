import type { ChatDetail } from "@/types/chat"
import type { ChatAgentEvent } from "@/types/chat"
import { hasAppBridge } from "@/services/bridge"
import { ChatApi, type SendChatMessage } from "@/services/chat-service"

export type ChatRuntimePayload =
  | { requestId: string; chatId: string; type: "started" }
  | { requestId: string; chatId: string; type: "completed"; detail: ChatDetail }
  | { requestId: string; chatId: string; type: "cancelled" }
  | ({ requestId: string; chatId: string } & ChatAgentEvent)

type ChatRuntimeListener = (event: ChatRuntimePayload) => void

let warnedMissingRuntimeBridge = false

export function subscribeToChatRuntime(listener: ChatRuntimeListener) {
  if (!hasAppBridge()) {
    if (!warnedMissingRuntimeBridge) {
      warnedMissingRuntimeBridge = true
      console.warn("Chat runtime listener is unavailable because the Electron app bridge is missing.")
    }
    return () => undefined
  }
  const bridgeListener = (...args: unknown[]) => {
    const payload = args[1] as ChatRuntimePayload | undefined
    if (payload?.requestId && payload.chatId && payload.type) listener(payload)
  }
  ChatApi.onRuntimeEvent(bridgeListener)
  return () => ChatApi.offRuntimeEvent(bridgeListener)
}

export function sendChatMessage(sessionId: string, message: SendChatMessage) {
  return ChatApi.sendMessage(sessionId, message)
}

export function cancelChatRuntime(requestId: string) {
  return ChatApi.cancelRuntime(requestId)
}
