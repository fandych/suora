import { describe, expect, it } from "vitest"

import { detectChatErrorKind, getChatErrorPresentation, getChatErrorToolName } from "@/data/domain/chat/chat-error-state"

describe("chat error state", () => {
  it("classifies operational errors", () => {
    expect(detectChatErrorKind("tool-call step limit reached")).toBe("step-limit")
    expect(detectChatErrorKind("request timed out")).toBe("timeout")
    expect(detectChatErrorKind("path outside the allowed directory")).toBe("permission")
    expect(detectChatErrorKind("integration tool failed")).toBe("tool")
    expect(detectChatErrorKind("fetch failed: ECONNRESET")).toBe("request")
    expect(detectChatErrorKind("unexpected issue")).toBe("unknown")
  })

  it("provides stable presentation metadata", () => {
    const presentation = getChatErrorPresentation("blocked", "permission")
    expect(presentation.title).toBe("Operation blocked")
    expect(presentation.detail).toBe("blocked")
    expect(getChatErrorToolName("timeout")).toBe("Request timeout")
    expect(getChatErrorToolName("unknown")).toBe("Runtime error")
  })
})
