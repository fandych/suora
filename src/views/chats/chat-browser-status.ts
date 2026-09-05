import type { ChatAgentEvent } from "@/services/ai-service"

export type ChatBrowserInteractionState = {
  status: "idle" | "navigating" | "awaiting-user"
  url: string
  visible: boolean
}

export function deriveChatBrowserInteractionState(options: {
  browserState: { open: boolean; visible: boolean; url: string }
  toolEvents: ChatAgentEvent[]
}): ChatBrowserInteractionState {
  const lastEvent = options.toolEvents[options.toolEvents.length - 1]
  const isBrowserEvent = lastEvent?.type === "tool-call" || lastEvent?.type === "tool-result"
    ? lastEvent.toolName === "browser_navigate"
    : false

  if (isBrowserEvent && lastEvent.type === "tool-call") {
    return {
      status: "navigating",
      url: options.browserState.url,
      visible: options.browserState.visible,
    }
  }

  if (options.browserState.open) {
    return {
      status: "awaiting-user",
      url: options.browserState.url,
      visible: options.browserState.visible,
    }
  }

  return {
    status: "idle",
    url: "",
    visible: false,
  }
}