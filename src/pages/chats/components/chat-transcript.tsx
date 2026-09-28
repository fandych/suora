import { useEffect, useMemo, useRef } from "react"
import { BotIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useAppIntl } from "@/lib/i18n"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import type { ChatDetail } from "@/types/chat"
import { finalizeAssistantResponseParts, toAssistantResponseParts } from "@/lib/chat/response-parts"
import type { AssistantResponsePart } from "@/types/chat"
import { ChatMessageItem } from "@/pages/chats/components/chat-message-item"
import type { ChatToolActivity } from "@/pages/chats/components/chat-tool-event-item"
import { ChatAssistantResponseGroup } from "@/pages/chats/components/chat-assistant-response-group"

type ChatTranscriptProps = {
  activeProviderType: string
  assistantResponseMessageId: string | null
  assistantResponseParts: AssistantResponsePart[]
  autoScroll: boolean
  hasOlderMessages?: boolean
  isResponding?: boolean
  isLoadingOlderMessages?: boolean
  onLoadEarlierMessages?: () => Promise<void> | void
  onRetryTool?: (messageId: string | null, activity: ChatToolActivity) => Promise<void> | void
  selectedChat: ChatDetail | null
}

const transcriptScrollPositions = new Map<string, number>()

export function ChatTranscript({
  activeProviderType,
  assistantResponseMessageId,
  assistantResponseParts,
  autoScroll,
  hasOlderMessages = false,
  isResponding = false,
  isLoadingOlderMessages = false,
  onLoadEarlierMessages,
  onRetryTool,
  selectedChat,
}: ChatTranscriptProps) {
  const { t } = useAppIntl()
  const transcriptKey = selectedChat?.chat.id ?? "draft"
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const restoredTranscriptKeyRef = useRef<string | null>(null)
  const hasMessages = (selectedChat?.messages.length ?? 0) > 0 || assistantResponseParts.length > 0
  const hasPersistedAssistantResponse = Boolean(
    assistantResponseMessageId && selectedChat?.messages.some((message) => message.id === assistantResponseMessageId),
  )
  const hasStreamingAssistantGroup =
    (!assistantResponseMessageId || !hasPersistedAssistantResponse) && assistantResponseParts.length > 0
  const lastPersistedMessageId = selectedChat?.messages.at(-1)?.id ?? null
  const responseMessageCreatedAt = useMemo(() => {
    if (!assistantResponseMessageId) {
      return undefined
    }

    return selectedChat?.messages.find((message) => message.id === assistantResponseMessageId)?.createdAt
  }, [assistantResponseMessageId, selectedChat?.messages])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const handleScroll = () => {
      transcriptScrollPositions.set(transcriptKey, viewport.scrollTop)
    }

    handleScroll()
    viewport.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      transcriptScrollPositions.set(transcriptKey, viewport.scrollTop)
      viewport.removeEventListener("scroll", handleScroll)
    }
  }, [transcriptKey])

  useEffect(() => {
    if (restoredTranscriptKeyRef.current === transcriptKey) {
      return
    }

    if (autoScroll) {
      restoredTranscriptKeyRef.current = transcriptKey
      return
    }

    const viewport = viewportRef.current
    const savedScrollTop = transcriptScrollPositions.get(transcriptKey)
    if (!viewport || typeof savedScrollTop !== "number") {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      viewport.scrollTop = savedScrollTop
      restoredTranscriptKeyRef.current = transcriptKey
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [autoScroll, transcriptKey])

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <MessageScrollerProvider
        key={transcriptKey}
        autoScroll={autoScroll}
        defaultScrollPosition="end"
        scrollPreviousItemPeek={12}
      >
        <MessageScroller className="flex-1 min-h-0">
          <MessageScrollerViewport
            ref={viewportRef}
            aria-label={t("chat.transcript.label", "Chat transcript")}
            className="border-t bg-muted/20"
          >
            <MessageScrollerContent className="min-h-0 gap-3 px-(--card-spacing) py-4">
              {hasOlderMessages ? (
                <MessageScrollerItem messageId="conversation-load-earlier" className="flex justify-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isLoadingOlderMessages}
                    onClick={() => void onLoadEarlierMessages?.()}
                  >
                    {isLoadingOlderMessages
                      ? t("chat.transcript.loadingEarlier", "Loading…")
                      : t("chat.transcript.loadEarlier", "Load earlier messages")}
                  </Button>
                </MessageScrollerItem>
              ) : null}
              {selectedChat?.messages.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={!hasStreamingAssistantGroup && message.id === lastPersistedMessageId}
                >
                  {message.id === assistantResponseMessageId && assistantResponseParts.length > 0 ? (
                    <ChatAssistantResponseGroup
                      createdAt={responseMessageCreatedAt}
                      isActiveTurn={isResponding}
                      messageId={message.id}
                      onRetryTool={onRetryTool}
                      parts={assistantResponseParts}
                      providerType={activeProviderType}
                    />
                  ) : message.role === "assistant" && message.parts?.length ? (
                    <ChatAssistantResponseGroup
                      createdAt={message.createdAt}
                      messageId={message.id}
                      onRetryTool={onRetryTool}
                      parts={finalizeAssistantResponseParts(toAssistantResponseParts(message.parts))}
                      providerType={activeProviderType}
                    />
                  ) : (
                    <ChatMessageItem
                      content={message.content}
                      createdAt={message.createdAt}
                      label={
                        message.role === "user"
                          ? t("chat.transcript.user", "You")
                          : message.role === "assistant"
                            ? t("chat.transcript.assistant", "Assistant")
                            : t("chat.transcript.system", "System")
                      }
                      parts={message.parts}
                      providerType={activeProviderType}
                      role={message.role}
                    />
                  )}
                </MessageScrollerItem>
              ))}
              {hasStreamingAssistantGroup ? (
                <MessageScrollerItem messageId="assistant-streaming-group" scrollAnchor>
                  <ChatAssistantResponseGroup
                    isActiveTurn={isResponding}
                    onRetryTool={onRetryTool}
                    parts={assistantResponseParts}
                    providerType={activeProviderType}
                  />
                </MessageScrollerItem>
              ) : null}
              <MessageScrollerItem messageId="conversation-end" className="h-px" />
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
              <EmptyTitle>{t("chat.transcript.empty.title", "Ready for a new chat")}</EmptyTitle>
              <EmptyDescription>
                {t(
                  "chat.transcript.empty.description",
                  "Start typing below to create a new chat. Existing sessions stay available in the sidebar.",
                )}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : null}
    </div>
  )
}
