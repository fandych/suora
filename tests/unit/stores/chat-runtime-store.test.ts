import { describe, expect, it } from "vitest"
import {
  clearChatRuntime,
  getChatRuntimeSnapshot,
  useChatRuntimeStore,
} from "@/stores/chat-runtime-store"

describe("chat runtime store", () => {
  it("loads without an Electron bridge and clears absent runtime snapshots", () => {
    expect(useChatRuntimeStore.getState().snapshots).toEqual({})
    expect(getChatRuntimeSnapshot("chat-1").isResponding).toBe(false)
    clearChatRuntime("chat-1")
    expect(getChatRuntimeSnapshot("chat-1").isResponding).toBe(false)
  })
})
