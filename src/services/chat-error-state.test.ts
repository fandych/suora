import { describe, expect, it } from "vitest"

import { detectChatErrorKind, getChatErrorPresentation } from "@/services/chat-error-state"

describe("chat error state", () => {
  it("classifies common chat runtime failures", () => {
    expect(detectChatErrorKind("The chat agent reached the tool-call step limit (200).")).toBe("step-limit")
    expect(detectChatErrorKind("AI request timed out after 30000ms")).toBe("timeout")
    expect(detectChatErrorKind("The selected agent cannot access this integration.")).toBe("permission")
    expect(detectChatErrorKind("read ECONNRESET")).toBe("request")
    expect(detectChatErrorKind("Connection reset by peer (ECONNRESET)")).toBe("request")
  })

  it("returns actionable UI copy for timeout failures", () => {
    const presentation = getChatErrorPresentation("AI request timed out after 30000ms", "timeout")

    expect(presentation.title).toBe("Request timed out")
    expect(presentation.label).toContain("configured timeout")
  })
})