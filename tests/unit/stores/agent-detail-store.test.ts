import { describe, expect, it } from "vitest"
import { useAgentDetailStore } from "@/stores/agent-detail-store"

describe("agent detail store", () => {
  it("starts with an empty draft", () => {
    expect(useAgentDetailStore.getState().draft).toBeNull()
    expect(useAgentDetailStore.getState().isLoading).toBe(false)
  })
})
