import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ChatToolEventItem } from "@/pages/chats/components/chat-tool-event-item"

vi.mock("@/lib/browser/clipboard", () => ({
  copyTextToClipboard: vi.fn(async () => undefined),
}))

vi.mock("@/services/toast-service", () => ({
  showToast: vi.fn(),
}))

describe("chat tool event item", () => {
  it("shows a fixed tool title and reveals compact data panels on click", () => {
    render(
      <ChatToolEventItem
        activity={{
          id: "tool-1",
          toolName: "searchDocuments",
          input: { query: "overview", resultLimit: 3 },
          output: '[{"documentTitle":"Guide"}]',
        }}
      />,
    )

    expect(screen.getByText("Tool")).toBeTruthy()
    expect(screen.getByText("searchDocuments")).toBeTruthy()
    expect(screen.queryByText("Input")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Input & output" }))

    expect(screen.getByText("Input")).toBeTruthy()
    expect(screen.getByText("Output")).toBeTruthy()
    expect(screen.getByText(/overview/)).toBeTruthy()
  })
})