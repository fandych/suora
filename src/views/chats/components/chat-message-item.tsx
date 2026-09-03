import { useEffect, useRef, useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Spinner } from "@/components/ui/spinner"
import { Message, MessageAvatar, MessageContent, MessageHeader } from "@/components/ui/message"
import { cn } from "@/lib/utils"
import { ChatMessageActions } from "@/views/chats/components/chat-message-actions"
import { ChatRichContent } from "@/views/chats/components/chat-rich-content"
import { getProviderLogo } from "@/views/components/provider-logo"

type ChatMessageItemProps = {
  content: string
  createdAt?: number
  kind?: "message" | "tool"
  label: string
  providerType?: string
  role: "user" | "assistant" | "system"
  isPending?: boolean
  pendingLabel?: string
}

function buildExportName(label: string) {
  return (label || "message").replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase() || "message"
}

export function ChatMessageItem({
  content,
  createdAt,
  kind = "message",
  label,
  providerType = "openai",
  role,
  isPending = false,
  pendingLabel = "Assistant is responding...",
}: ChatMessageItemProps) {
  const AssistantLogo = getProviderLogo(providerType)
  const align = role === "user" ? "end" : "start"
  const hasContent = content.trim().length > 0

  return (
    <Message align={align}>
      <MessageAvatar className="self-start bg-transparent">
        {role === "assistant" ? (
          <Avatar size="sm" className="bg-background">
            <div className="flex size-full items-center justify-center text-foreground">
              <AssistantLogo className="size-3.5" />
            </div>
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
        ) : (
          <Avatar size="sm" className={cn("bg-background", role === "user" ? "text-primary" : "text-muted-foreground")}>
            <AvatarFallback>{role === "user" ? "U" : kind === "tool" ? "T" : "S"}</AvatarFallback>
          </Avatar>
        )}
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>{label}</MessageHeader>
        <div className={cn("flex max-w-[min(100%,56rem)] min-w-0 flex-col gap-1", role === "user" ? "self-end" : "self-start")}>
          <Bubble variant={role === "user" ? "outline" : role === "assistant" ? "outline" : "muted"} align={align} className="max-w-full">
            <BubbleContent>
              {isPending ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {content}
                  <span aria-hidden="true" className="ml-1 inline-block h-4 w-0.5 animate-pulse rounded bg-current align-middle" />
                  {!hasContent ? <span className="sr-only">{pendingLabel}</span> : null}
                </div>
              ) : (
                <ChatRichContent content={content} />
              )}
            </BubbleContent>
          </Bubble>
          {isPending ? null : <ChatMessageActions baseName={buildExportName(label)} content={content} createdAt={createdAt} />}
        </div>
      </MessageContent>
    </Message>
  )
}