import { describe, expect, it } from "vitest"

import { createPersistedAssistantPayload, hasVisibleAssistantContent } from "@/services/chat/assistant-persistence"
import { finalizeAssistantResponseParts, updateAssistantToolActivity } from "@/services/chat/assistant-response-parts"

describe("chat persistence helpers", () => {
  it("detects visible content and creates payloads", () => {
    expect(hasVisibleAssistantContent("answer", [])).toBe(true)
    expect(hasVisibleAssistantContent("", [])).toBe(false)
    const payload = createPersistedAssistantPayload("answer", [], false)
    expect(payload.persistedText).toBe("answer")
    expect(payload.persistedParts).toEqual([])
  })

  it("finalizes parts and updates tool activity", () => {
    const parts = [{ id: "text-1", type: "text", content: "hello", isPending: true }] as never
    expect(finalizeAssistantResponseParts(parts)).toEqual([{ id: "text-1", type: "text", content: "hello", isPending: false }])
    expect(updateAssistantToolActivity(parts, "missing", { state: "output-available" })).toEqual(parts)
  })
})
