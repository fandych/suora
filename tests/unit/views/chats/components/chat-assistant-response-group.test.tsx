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

vi.mock("@/components/ui/spinner", () => ({
  Spinner: () => <div data-testid="spinner" />,
}))

vi.mock("@/lib/i18n", () => ({
  useAppIntl: () => ({
    t: (_id: string, defaultMessage: string) => defaultMessage,
  }),
}))

vi.mock("@/pages/chats/components/chat-rich-content", () => ({
  ChatRichContent: ({ content, isStreaming }: { content: string; isStreaming?: boolean }) => (
    <div data-testid="rich-content" data-streaming={isStreaming ? "true" : "false"}>
      {content}
    </div>
  ),
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

  it("does not render an empty pending text section before the first tool call", () => {
    render(
      <ChatAssistantResponseGroup
        parts={[
          { id: "text-pending", type: "text", content: "", isPending: true },
          { id: "tool-1", type: "tool", activity: { id: "activity-1", toolName: "readWorkspaceFile" } },
          { id: "text-2", type: "text", content: "Final answer" },
        ]}
        providerType="openai"
      />,
    )

    expect(screen.getAllByTestId("tool-item")).toHaveLength(1)
    expect(screen.getAllByTestId("rich-content")).toHaveLength(1)
    expect(screen.getByText("Final answer")).toBeTruthy()
  })

  it("shows the waiting cursor only for the latest pending text section", () => {
    render(
      <ChatAssistantResponseGroup
        parts={[
          { id: "text-1", type: "text", content: "First draft", isPending: true },
          { id: "tool-1", type: "tool", activity: { id: "activity-1", toolName: "readWorkspaceFile" } },
          { id: "text-2", type: "text", content: "Latest draft", isPending: true },
        ]}
        providerType="openai"
      />,
    )

    const textSections = screen.getAllByTestId("rich-content")
    expect(textSections).toHaveLength(2)
    expect(textSections[0]?.getAttribute("data-streaming")).toBe("false")
    expect(textSections[1]?.getAttribute("data-streaming")).toBe("true")
  })

  it("keeps the active assistant turn from looking completed after tool success", () => {
    render(
      <ChatAssistantResponseGroup
        isActiveTurn
        parts={[
          { id: "tool-1", type: "tool", activity: { id: "activity-1", toolName: "readWorkspaceFile", output: "{}" } },
          { id: "text-1", type: "text", content: "Interim analysis" },
        ]}
        providerType="openai"
      />,
    )

    expect(screen.queryByTestId("message-actions")).toBeNull()
    expect(screen.getByTestId("assistant-thinking-hint")).toBeTruthy()
    expect(screen.getByText("Thinking...")).toBeTruthy()
  })

  it("keeps completed assistant actions for finished historical messages", () => {
    render(
      <ChatAssistantResponseGroup
        parts={[
          { id: "tool-1", type: "tool", activity: { id: "activity-1", toolName: "readWorkspaceFile", output: "{}" } },
          { id: "text-1", type: "text", content: "Final answer" },
        ]}
        providerType="openai"
      />,
    )

    expect(screen.getByTestId("message-actions")).toBeTruthy()
    expect(screen.queryByTestId("assistant-thinking-hint")).toBeNull()
  })
})
