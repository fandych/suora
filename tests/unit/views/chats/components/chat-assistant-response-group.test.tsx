import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ChatAssistantResponseGroup } from "@/pages/chats/components/chat-assistant-response-group"

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/bubble", () => ({
  Bubble: ({ children }: { children?: React.ReactNode }) => <div data-testid="text-wrapper">{children}</div>,
  BubbleContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/message", () => ({
  Message: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  MessageAvatar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  MessageContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  MessageHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/pages/chats/components/chat-message-actions", () => ({
  ChatMessageActions: () => <div data-testid="message-actions" />,
}))

vi.mock("@/pages/chats/components/chat-rich-content", () => ({
  ChatRichContent: ({ content }: { content: string }) => <div data-testid="rich-content">{content}</div>,
}))

vi.mock("@/pages/chats/components/chat-tool-event-item", () => ({
  ChatToolEventItem: ({ activity }: { activity: { toolName: string } }) => (
    <div data-testid="tool-item">{activity.toolName}</div>
  ),
}))

vi.mock("@/pages/components/provider-logo", () => ({
  getProviderLogo: () => () => <div data-testid="provider-logo" />,
}))

describe("chat assistant response group", () => {
  it("renders tool activities as separate flat items in transcript order", () => {
    render(
      <ChatAssistantResponseGroup
        parts={[
          { id: "text-1", type: "text", content: "First paragraph" },
          { id: "tool-1", type: "tool", activity: { id: "activity-1", toolName: "listWorkspaceFiles" } },
          { id: "text-2", type: "text", content: "Second paragraph" },
          {
            id: "tool-2",
            type: "tool",
            activity: { id: "activity-2", toolName: "readWorkspaceFile", output: "{}" },
          },
        ]}
        providerType="openai"
      />,
    )

    expect(screen.getAllByTestId("tool-item")).toHaveLength(2)
    expect(screen.getAllByTestId("rich-content")).toHaveLength(2)
    expect(screen.queryByText("Show tools")).toBeNull()
  })
})