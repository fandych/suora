import { describe, expect, it } from "vitest"

import { applyEventToAssistantResponseParts } from "@/lib/chat/response-parts"
import type { AssistantResponsePart } from "@/types/chat"

describe("applyEventToAssistantResponseParts", () => {
  it("clears the previous pending text section when a tool call starts", () => {
    const parts: AssistantResponsePart[] = [{ id: "text-1", type: "text", content: "Draft", isPending: true }]

    const nextParts = applyEventToAssistantResponseParts(
      parts,
      {
        type: "tool-call",
        toolCallId: "tool-1",
        toolName: "readWorkspaceFile",
        input: { path: "README.md" },
      },
      1,
    )

    expect(nextParts).toEqual([
      { id: "text-1", type: "text", content: "Draft", isPending: false },
      {
        id: "tool-1",
        type: "tool",
        activity: { id: "tool-1", toolName: "readWorkspaceFile", input: { path: "README.md" } },
      },
    ])
  })
})
