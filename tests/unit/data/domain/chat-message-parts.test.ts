import { describe, expect, it } from "vitest"

import { getAttachmentParts, getTextParts, normalizeChatMessageParts } from "@/data/domain/chat-message-parts"

describe("chat message parts", () => {
  it("keeps valid text, tool, and attachment parts while discarding malformed entries", () => {
    const parts = normalizeChatMessageParts([
      { id: "text-1", type: "text", content: "hello" },
      { id: "tool-1", type: "tool", activity: { id: "tool-1", toolName: "listWorkspaceFiles", output: "ok" } },
      { id: "attachment-1", type: "attachment", attachment: { id: "attachment-1", sourceKey: "source", name: "image.png", mediaType: "image/png", data: "data:image/png;base64,abc", kind: "image" } },
      { id: "broken", type: "attachment", attachment: { id: "broken" } },
    ])

    expect(parts).toHaveLength(3)
    expect(getTextParts(parts)).toHaveLength(1)
    expect(getAttachmentParts(parts)).toHaveLength(1)
  })

  it("does not misinterpret a version envelope as direct parts input", () => {
    const parts = normalizeChatMessageParts({
      version: 1,
      parts: [
        { id: "text-1", type: "text", content: "hello" },
      ],
    } as unknown as unknown[])

    expect(parts).toEqual([])
  })
})