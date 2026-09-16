import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ChatTranscript } from "@/pages/chats/components/chat-transcript"

vi.mock("@/pages/chats/components/chat-message-item", () => ({
  ChatMessageItem: ({ content }: { content: string }) => <div>{content}</div>,
}))

vi.mock("@/pages/chats/components/chat-assistant-response-group", () => ({
  ChatAssistantResponseGroup: ({ parts }: { parts: Array<{ type: string; content?: string }> }) => (
    <div>{parts.map((part) => part.content ?? "").join(" ")}</div>
  ),
}))

describe("chat transcript", () => {
  it("renders the latest message content without requiring a manual scroll to reveal it", () => {
    render(
      <div style={{ height: 480 }}>
        <ChatTranscript
          activeProviderType="openai"
          assistantResponseMessageId={null}
          assistantResponseParts={[]}
          autoScroll
          selectedChat={{
            chat: {
              id: "chat-1",
              title: "Chat 1",
              chatbotId: "bot",
              summary: "",
              updatedAt: Date.now(),
              sourceType: "manual",
              sourceRef: null,
            },
            messages: [
              { id: "m1", role: "user", content: "first", createdAt: 1 },
              { id: "m2", role: "assistant", content: "latest visible message", createdAt: 2 },
            ],
          }}
        />
      </div>,
    )

    expect(screen.getByText("latest visible message")).toBeTruthy()
  })
})
