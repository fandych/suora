import { Fragment } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageAvatar, MessageContent, MessageHeader } from "@/components/ui/message"
import { ChatMessageActions } from "@/views/chats/components/chat-message-actions"
import { ChatRichContent } from "@/views/chats/components/chat-rich-content"
import { ChatToolEventItem, type ChatToolActivity } from "@/views/chats/components/chat-tool-event-item"
import { getProviderLogo } from "@/views/components/provider-logo"

export type AssistantResponsePart =
  | { id: string; type: "text"; content: string; isPending?: boolean }
  | { id: string; type: "tool"; activity: ChatToolActivity; stepLabel?: string }

type ChatAssistantResponseGroupProps = {
  createdAt?: number
  messageId?: string | null
  onRetryTool?: (messageId: string | null, activity: ChatToolActivity) => Promise<void> | void
  parts: AssistantResponsePart[]
  providerType: string
}

export function ChatAssistantResponseGroup({ createdAt, messageId = null, onRetryTool, parts, providerType }: ChatAssistantResponseGroupProps) {
  const AssistantLogo = getProviderLogo(providerType)
  let toolIndex = 0
  const toolCount = parts.filter((part) => part.type === "tool").length
  const combinedText = parts.filter((part) => part.type === "text").map((part) => part.content).join("\n\n")
  const hasPendingText = parts.some((part) => part.type === "text" && part.isPending)

  return (
    <Message align="start">
      <MessageAvatar className="self-start bg-transparent">
        <Avatar size="sm" className="bg-background">
          <div className="flex size-full items-center justify-center text-foreground">
            <AssistantLogo className="size-3.5" />
          </div>
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>Assistant</MessageHeader>
        <div className="flex max-w-[min(100%,56rem)] min-w-0 flex-col gap-3 self-start">
          {parts.map((part) => (
            <Fragment key={part.id}>
              {part.type === "tool" ? (
                <ChatToolEventItem activity={part.activity} onRetry={onRetryTool ? (activity) => onRetryTool(messageId, activity) : undefined} stepLabel={(() => {
                  toolIndex += 1
                  return toolCount > 1 ? `${toolIndex}/${toolCount}` : undefined
                })()} />
              ) : (
                <Bubble variant="outline" align="start" className="max-w-full">
                  <BubbleContent>
                    {part.isPending ? (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {part.content}
                        <span aria-hidden="true" className="ml-1 inline-block h-4 w-0.5 animate-pulse rounded bg-current align-middle" />
                      </div>
                    ) : (
                      <ChatRichContent content={part.content} />
                    )}
                  </BubbleContent>
                </Bubble>
              )}
            </Fragment>
          ))}
          {!hasPendingText && combinedText.trim() ? <ChatMessageActions baseName="assistant-message" className="w-full" content={combinedText} createdAt={createdAt} /> : null}
        </div>
        {hasPendingText && createdAt ? <div className="px-1 pt-1 text-[11px] text-muted-foreground">{new Date(createdAt).toLocaleString()}</div> : null}
      </MessageContent>
    </Message>
  )
}