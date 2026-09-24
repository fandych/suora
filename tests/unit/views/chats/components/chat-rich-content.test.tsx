import { render, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ChatRichContent } from "@/pages/chats/components/chat-rich-content"

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async () => ({ svg: "<svg><text>diagram</text></svg>" })),
  },
}))

vi.mock("@/services/toast-service", () => ({
  showToast: vi.fn(),
}))

describe("chat rich content", () => {
  it("enhances math, code blocks, and mermaid output", async () => {
    const { container } = render(
      <ChatRichContent
        content={[
          "Inline math $E=mc^2$",
          "",
          "```ts",
          "const total = 3",
          "```",
          "",
          "```mermaid",
          "graph TD",
          "  A --> B",
          "```",
        ].join("\n")}
      />,
    )

    await waitFor(() => {
      expect(container.querySelectorAll(".document-math-inline").length).toBeGreaterThan(0)
      expect(container.querySelectorAll(".hljs").length).toBeGreaterThan(0)
      expect(container.querySelectorAll(".document-mermaid-block svg").length).toBeGreaterThan(0)
    })
  })
})
