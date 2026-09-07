import { useMemo } from "react"
import { BotIcon } from "lucide-react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport } from "@/components/ui/message-scroller"
import type { ChatDetail } from "@/data/domain/models"
import { finalizeAssistantResponseParts, toAssistantResponseParts } from "@/views/chats/assistant-response-parts"
import { ChatMessageItem } from "@/views/chats/components/chat-message-item"
import type { ChatToolActivity } from "@/views/chats/components/chat-tool-event-item"
import { ChatAssistantResponseGroup, type AssistantResponsePart } from "@/views/chats/components/chat-assistant-response-group"

type ChatTranscriptProps = {
  activeProviderType: string
  assistantResponseMessageId: string | null
  assistantResponseParts: AssistantResponsePart[]
  autoScroll: boolean
  onRetryTool?: (messageId: string | null, activity: ChatToolActivity) => Promise<void> | void
  selectedChat: ChatDetail | null
}

export function ChatTranscript({ activeProviderType, assistantResponseMessageId, assistantResponseParts, autoScroll, onRetryTool, selectedChat }: ChatTranscriptProps) {
  const hasMessages = (selectedChat?.messages.length ?? 0) > 0 || assistantResponseParts.length > 0
  const hasPersistedAssistantResponse = Boolean(assistantResponseMessageId && selectedChat?.messages.some((message) => message.id === assistantResponseMessageId))
  const responseMessageCreatedAt = useMemo(() => {
    if (!assistantResponseMessageId) {
      return undefined
    }

    return selectedChat?.messages.find((message) => message.id === assistantResponseMessageId)?.createdAt
  }, [assistantResponseMessageId, selectedChat?.messages])

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <MessageScrollerProvider autoScroll={autoScroll} defaultScrollPosition="end" scrollPreviousItemPeek={12}>
        <MessageScroller className="flex-1 min-h-0">
          <MessageScrollerViewport aria-label="Chat transcript" className="border-t bg-muted/20">
            <MessageScrollerContent className="min-h-0 gap-3 px-(--card-spacing) py-4">
              {selectedChat?.messages.map((message) => (
                <MessageScrollerItem key={message.id} messageId={message.id}>
                  {message.id === assistantResponseMessageId && assistantResponseParts.length > 0 ? (
                    <ChatAssistantResponseGroup createdAt={responseMessageCreatedAt} messageId={message.id} onRetryTool={onRetryTool} parts={assistantResponseParts} providerType={activeProviderType} />
                  ) : message.role === "assistant" && message.parts?.length ? (
                    <ChatAssistantResponseGroup createdAt={message.createdAt} messageId={message.id} onRetryTool={onRetryTool} parts={finalizeAssistantResponseParts(toAssistantResponseParts(message.parts))} providerType={activeProviderType} />
                  ) : (
                    <ChatMessageItem content={message.content} createdAt={message.createdAt} label={message.role === "user" ? "You" : message.role === "assistant" ? "Assistant" : "System"} parts={message.parts} providerType={activeProviderType} role={message.role} />
                  )}
                </MessageScrollerItem>
              ))}
              {(!assistantResponseMessageId || !hasPersistedAssistantResponse) && assistantResponseParts.length > 0 ? (
                <MessageScrollerItem messageId="assistant-streaming-group">
                  <ChatAssistantResponseGroup onRetryTool={onRetryTool} parts={assistantResponseParts} providerType={activeProviderType} />
                </MessageScrollerItem>
              ) : null}
              <MessageScrollerItem messageId="conversation-end" scrollAnchor className="h-px" />
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      {!hasMessages && assistantResponseParts.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <Empty className="max-w-2xl flex-none border border-dashed border-border bg-background/88 px-6 py-12 shadow-sm backdrop-blur-xs">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BotIcon />
              </EmptyMedia>
              <EmptyTitle>Ready for a new chat</EmptyTitle>
              <EmptyDescription>
                Start typing below to create a new chat. Existing sessions stay available in the sidebar.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : null}
    </div>
  )
}