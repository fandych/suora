import { describe, expect, it } from "vitest"

import { deriveChatBrowserInteractionState } from "@/views/chats/chat-browser-status"

describe("chat browser interaction state", () => {
  it("does not show a browser state for an unrelated chat", () => {
    const state = deriveChatBrowserInteractionState({
      browserState: { open: true, visible: false, url: "https://example.com" },
      toolEvents: [],
      isResponding: false,
    })

    expect(state.status).toBe("idle")
  })

  it("shows navigation work while the browser tool is running", () => {
    const state = deriveChatBrowserInteractionState({
      browserState: { open: true, visible: false, url: "https://example.com", loading: true },
      toolEvents: [{ type: "tool-call", toolCallId: "tool-1", toolName: "browser_navigate", input: { url: "https://example.com" } }],
      isResponding: true,
    })

    expect(state.status).toBe("navigating")
    expect(state.visible).toBe(false)
  })

  it("shows a user handoff after the run has stopped", () => {
    const state = deriveChatBrowserInteractionState({
      browserState: { open: true, visible: false, url: "https://login.example.com" },
      toolEvents: [{ type: "tool-result", toolCallId: "tool-1", toolName: "browser_navigate", output: "opened" }],
      isResponding: false,
    })

    expect(state.status).toBe("awaiting-user")
  })
})
