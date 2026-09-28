import { render, screen } from "@testing-library/react"
import { IntlProvider } from "react-intl"
import { act } from "react"
import { describe, expect, it, vi } from "vitest"

import { ChatTranscript } from "@/pages/chats/components/chat-transcript"

vi.mock("@/pages/chats/components/chat-message-item", () => ({
  ChatMessageItem: ({ content }: { content: string }) => <div>{content}</div>,
}))

vi.mock("@/pages/chats/components/chat-assistant-response-group", () => ({
  ChatAssistantResponseGroup: ({
    isActiveTurn,
    parts,
  }: {
    isActiveTurn?: boolean
    parts: Array<{ type: string; content?: string }>
  }) => (
    <div data-testid="assistant-group" data-active-turn={isActiveTurn ? "true" : "false"}>
      {parts.map((part) => part.content ?? "").join(" ")}
    </div>
  ),
}))

describe("chat transcript", () => {
  it("renders the latest message content without requiring a manual scroll to reveal it", () => {
    render(
      <IntlProvider locale="en" messages={{}}>
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
        </div>
      </IntlProvider>,
    )

    expect(screen.getByText("latest visible message")).toBeTruthy()
  })

  it("does not restore an older saved scroll position while auto-scroll is active", () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      })
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined)

    const { rerender } = render(
      <IntlProvider locale="en" messages={{}}>
        <div style={{ height: 480 }}>
          <ChatTranscript
            activeProviderType="openai"
            assistantResponseMessageId={null}
            assistantResponseParts={[]}
            autoScroll
            selectedChat={null}
          />
        </div>
      </IntlProvider>,
    )

    const viewport = screen.getByLabelText("Chat transcript") as HTMLDivElement
    act(() => {
      viewport.scrollTop = 120
    })

    rerender(
      <IntlProvider locale="en" messages={{}}>
        <div style={{ height: 480 }}>
          <ChatTranscript
            activeProviderType="openai"
            assistantResponseMessageId={null}
            assistantResponseParts={[{ id: "pending-text", type: "text", content: "streaming", isPending: true }]}
            autoScroll
            selectedChat={null}
          />
        </div>
      </IntlProvider>,
    )

    expect(viewport.scrollTop).toBe(120)
    expect(requestAnimationFrameSpy).not.toHaveBeenCalled()

    requestAnimationFrameSpy.mockRestore()
    cancelAnimationFrameSpy.mockRestore()
  })

  it("anchors the last real transcript item instead of the synthetic conversation end marker", () => {
    const { container } = render(
      <IntlProvider locale="en" messages={{}}>
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
                { id: "m2", role: "assistant", content: "second", createdAt: 2 },
              ],
            }}
          />
        </div>
      </IntlProvider>,
    )

    expect(container.querySelector('[data-message-id="m1"]')?.getAttribute("data-scroll-anchor")).toBe("false")
    expect(container.querySelector('[data-message-id="m2"]')?.getAttribute("data-scroll-anchor")).toBe("true")
    expect(container.querySelector('[data-message-id="conversation-end"]')?.getAttribute("data-scroll-anchor")).toBe(
      "false",
    )
  })

  it("moves the scroll anchor to the streaming assistant group when the reply is not yet persisted", () => {
    const { container } = render(
      <IntlProvider locale="en" messages={{}}>
        <div style={{ height: 480 }}>
          <ChatTranscript
            activeProviderType="openai"
            assistantResponseMessageId={null}
            assistantResponseParts={[{ id: "pending-text", type: "text", content: "streaming", isPending: true }]}
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
              messages: [{ id: "m1", role: "user", content: "first", createdAt: 1 }],
            }}
          />
        </div>
      </IntlProvider>,
    )

    expect(container.querySelector('[data-message-id="m1"]')?.getAttribute("data-scroll-anchor")).toBe("false")
    expect(
      container.querySelector('[data-message-id="assistant-streaming-group"]')?.getAttribute("data-scroll-anchor"),
    ).toBe("true")
    expect(container.querySelector('[data-message-id="conversation-end"]')?.getAttribute("data-scroll-anchor")).toBe(
      "false",
    )
  })

  it("marks the active assistant group as still responding until the turn completes", () => {
    render(
      <IntlProvider locale="en" messages={{}}>
        <div style={{ height: 480 }}>
          <ChatTranscript
            activeProviderType="openai"
            assistantResponseMessageId="m2"
            assistantResponseParts={[{ id: "pending-text", type: "text", content: "streaming", isPending: false }]}
            autoScroll
            isResponding
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
                { id: "m2", role: "assistant", content: "second", createdAt: 2, parts: [] },
              ],
            }}
          />
        </div>
      </IntlProvider>,
    )

    const groups = screen.getAllByTestId("assistant-group")
    expect(groups.at(-1)?.getAttribute("data-active-turn")).toBe("true")
  })
})
