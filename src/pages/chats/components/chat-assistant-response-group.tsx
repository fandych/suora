import { Fragment } from "react"

import { Avatar } from "@/components/ui/avatar"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageAvatar, MessageContent, MessageHeader } from "@/components/ui/message"
import { ChatMessageActions } from "@/pages/chats/components/chat-message-actions"
import { ChatRichContent } from "@/pages/chats/components/chat-rich-content"
import { ChatToolEventItem, type ChatToolActivity } from "@/pages/chats/components/chat-tool-event-item"
import { getProviderLogo } from "@/pages/components/provider-logo"
import type { AssistantResponsePart } from "@/types/chat"

export type { AssistantResponsePart }

type ChatAssistantResponseGroupProps = {
  createdAt?: number
  messageId?: string | null
  onRetryTool?: (messageId: string | null, activity: ChatToolActivity) => Promise<void> | void
  parts: AssistantResponsePart[]
  providerType: string
}

type AssistantRenderSection =
  | { id: string; type: "text"; content: string; isPending?: boolean }
  | { id: string; type: "tool"; activity: ChatToolActivity }

function buildActionContent(parts: AssistantResponsePart[]) {
  return parts
    .map((part) => {
      if (part.type === "text") {
        return part.content.trim()
      }

      if (part.activity.error) {
        return `TOOL ERROR ${part.activity.toolName}\n${part.activity.error}`
      }

      if (part.activity.stopped) {
        return `TOOL STOPPED ${part.activity.toolName}\nStopped before a tool result was returned.`
      }

      if (part.activity.output !== undefined) {
        return `TOOL RESULT ${part.activity.toolName}\n${part.activity.output}`
      }

      if (part.activity.input) {
        return `TOOL CALL ${part.activity.toolName}\n${JSON.stringify(part.activity.input, null, 2)}`
      }

      return ""
    })
    .filter(Boolean)
    .join("\n\n")
}

function buildSections(parts: AssistantResponsePart[]): AssistantRenderSection[] {
  const sections: AssistantRenderSection[] = []
  let bufferedTextParts: Array<Extract<AssistantResponsePart, { type: "text" }>> = []

  const flushTextBuffer = () => {
    if (bufferedTextParts.length === 0) return
    const content = bufferedTextParts
      .map((part) => part.content.trim())
      .filter(Boolean)
      .join("\n\n---\n\n")
    if (!content) {
      bufferedTextParts = []
      return
    }
    const isPending = bufferedTextParts.some((part) => part.isPending)
    sections.push({
      id: bufferedTextParts.map((part) => part.id).join(":"),
      type: "text",
      content,
      isPending,
    })
    bufferedTextParts = []
  }

  for (const part of parts) {
    if (part.type === "text") {
      bufferedTextParts.push(part)
      continue
    }

    flushTextBuffer()
    sections.push({ id: part.activity.id, type: "tool", activity: part.activity })
  }

  flushTextBuffer()

  return sections
}

export function ChatAssistantResponseGroup({
  createdAt,
  messageId = null,
  onRetryTool,
  parts,
  providerType,
}: ChatAssistantResponseGroupProps) {
  const AssistantLogo = getProviderLogo(providerType)
  const hasPendingText = parts.some((part) => part.type === "text" && part.isPending)
  const hasRunningTools = parts.some(
    (part) =>
      part.type === "tool" && part.activity.output === undefined && !part.activity.error && !part.activity.stopped,
  )
  const actionContent = buildActionContent(parts)
  const sections = buildSections(parts)

  return (
    <Message align="start">
      <MessageAvatar className="self-start bg-transparent">
        <Avatar size="sm" className="bg-background">
          <div className="flex size-full items-center justify-center text-foreground">
            <AssistantLogo className="size-3.5" />
          </div>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>Assistant</MessageHeader>
        <div className="flex max-w-[min(100%,56rem)] min-w-0 flex-col gap-3 self-start">
          {sections.map((section) => (
            <Fragment key={section.id}>
              {section.type === "tool" ? (
                <ChatToolEventItem
                  activity={section.activity}
                  onRetry={onRetryTool ? (activity) => onRetryTool(messageId, activity) : undefined}
                />
              ) : (
                <Bubble variant="outline" align="start" className="max-w-full">
                  <BubbleContent>
                    <div className="relative">
                      <ChatRichContent content={section.content} isStreaming={Boolean(section.isPending)} />
                      {section.isPending ? (
                        <span
                          aria-hidden="true"
                          className="ml-1 inline-block h-4 w-0.5 animate-pulse rounded bg-current align-middle"
                        />
                      ) : null}
                    </div>
                  </BubbleContent>
                </Bubble>
              )}
            </Fragment>
          ))}
          {!hasPendingText && !hasRunningTools && actionContent.trim() ? (
            <ChatMessageActions
              baseName="assistant-message"
              className="w-full"
              content={actionContent}
              createdAt={createdAt}
            />
          ) : null}
        </div>
        {hasPendingText && createdAt ? (
          <div className="px-1 pt-1 text-[11px] text-muted-foreground">{new Date(createdAt).toLocaleString()}</div>
        ) : null}
      </MessageContent>
    </Message>
  )
}
