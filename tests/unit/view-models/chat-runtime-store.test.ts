import { describe, expect, it } from "vitest"
import { EMPTY_CHAT_RUNTIME, useChatRuntimeStore } from "@/stores/chat-runtime-store"

describe("chat runtime store", () => {
  it("patches and clears runtime snapshots", () => {
    useChatRuntimeStore.getState().setSnapshot("chat-1", { ...EMPTY_CHAT_RUNTIME, isResponding: true })
    expect(useChatRuntimeStore.getState().entries["chat-1"]?.isResponding).toBe(true)
    useChatRuntimeStore.getState().clear("chat-1")
    expect(useChatRuntimeStore.getState().entries["chat-1"]).toBeUndefined()
  })
})
