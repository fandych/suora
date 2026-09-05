import { normalizeChatMessageParts } from "@/data/domain/chat-message-parts"

export const CHAT_MESSAGE_PARTS_VERSION = 2
export const CHAT_SETTINGS_STORE_VERSION = 2

export function parseVersionedChatMessageParts(raw: string | null | undefined) {
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return normalizeChatMessageParts(parsed)
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "parts" in parsed) {
      return normalizeChatMessageParts((parsed as { parts?: unknown }).parts)
    }

    return []
  } catch {
    return []
  }
}

export function serializeVersionedChatMessageParts(parts: unknown[]) {
  return JSON.stringify({ version: CHAT_MESSAGE_PARTS_VERSION, parts })
}

export function parseVersionedChatSettingsStore(raw: string | null | undefined) {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (typeof parsed.version === "number" && parsed.store && typeof parsed.store === "object" && !Array.isArray(parsed.store)) {
      return { version: CHAT_SETTINGS_STORE_VERSION, store: parsed.store }
    }

    if (parsed.model || parsed.proxy || parsed.defaultRuntime || parsed.chats || parsed.drafts) {
      return {
        version: CHAT_SETTINGS_STORE_VERSION,
        store: parsed.model || parsed.proxy
          ? {
              defaultRuntime: parsed,
              defaultSelectedAgentId: "agent-general-assistant",
              drafts: {},
              chats: {},
            }
          : parsed,
      }
    }

    return null
  } catch {
    return null
  }
}

export function serializeVersionedChatSettingsStore(store: Record<string, unknown>) {
  return JSON.stringify({ version: CHAT_SETTINGS_STORE_VERSION, store })
}