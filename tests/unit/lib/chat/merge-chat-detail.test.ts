import { describe, expect, it } from "vitest"

import { mergeChatDetail } from "@/lib/chat/merge-chat-detail"
import type { ChatDetail } from "@/types/chat"

function createDetail(messages: ChatDetail["messages"], nextCursor: ChatDetail["nextCursor"] = null): ChatDetail {
  return {
    chat: {
      id: "chat-1",
      title: "Chat 1",
      chatbotId: "assistant-main",
      summary: "",
      updatedAt: 100,
      sourceType: "manual",
      sourceRef: null,
    },
    messages,
    nextCursor,
  }
}

describe("mergeChatDetail", () => {
  it("keeps existing transcript messages while updating newer persisted detail", () => {
    const current = createDetail(
      [
        { id: "m1", role: "user", content: "first", createdAt: 1 },
        { id: "m2", role: "assistant", content: "second", createdAt: 2 },
        { id: "m3", role: "user", content: "third", createdAt: 3 },
      ],
      { createdAt: 1, id: "m1" },
    )
    const next = createDetail([
      { id: "m3", role: "user", content: "third", createdAt: 3 },
      { id: "m4", role: "assistant", content: "fourth", createdAt: 4 },
    ])

    const merged = mergeChatDetail(current, next)

    expect(merged.messages.map((message) => message.id)).toEqual(["m1", "m2", "m3", "m4"])
    expect(merged.nextCursor).toEqual({ createdAt: 1, id: "m1" })
  })
})