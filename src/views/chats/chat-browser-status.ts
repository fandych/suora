import type { ChatAgentEvent } from "@/services/ai-service"

export type ChatBrowserInteractionState = {
  status: "idle" | "working" | "navigating" | "awaiting-user" | "error"
  url: string
  visible: boolean
  loading?: boolean
  error?: string
}

export function deriveChatBrowserInteractionState(options: {
  browserState: { open: boolean; visible: boolean; url: string; loading?: boolean; error?: string }
  toolEvents: ChatAgentEvent[]
  isResponding: boolean
}): ChatBrowserInteractionState {
  const lastEvent = options.toolEvents[options.toolEvents.length - 1]
  const isBrowserEvent = lastEvent?.type === "tool-call" || lastEvent?.type === "tool-result"
    ? ["browser_navigate", "browser_page", "browser_click", "browser_fill"].includes(lastEvent.toolName)
    : false

  if (!isBrowserEvent && !options.browserState.error) {
    return {
      status: "idle",
      url: "",
      visible: false,
    }
  }

  if (options.browserState.error && isBrowserEvent) {
    return {
      status: "error",
      url: options.browserState.url,
      visible: options.browserState.visible,
      loading: options.browserState.loading,
      error: options.browserState.error,
    }
  }

  if (isBrowserEvent && lastEvent.type === "tool-call") {
    return {
      status: lastEvent.toolName === "browser_navigate" ? "navigating" : "working",
      url: options.browserState.url,
      visible: options.browserState.visible,
      loading: options.browserState.loading,
      error: options.browserState.error,
    }
  }

  if (options.browserState.open && !options.isResponding) {
    return {
      status: "awaiting-user",
      url: options.browserState.url,
      visible: options.browserState.visible,
      loading: options.browserState.loading,
      error: options.browserState.error,
    }
  }

  return {
    status: "idle",
    url: "",
    visible: false,
  }
}