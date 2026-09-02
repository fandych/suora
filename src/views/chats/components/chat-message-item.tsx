import { CopyIcon, DownloadIcon, SquareIcon, Volume2Icon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { Message, MessageAvatar, MessageContent, MessageHeader } from "@/components/ui/message"
import { saveDocxFile, savePdfFile, saveTextFile } from "@/lib/browser-files"
import { showToast } from "@/lib/app-toast"
import { cn } from "@/lib/utils"
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
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const AssistantLogo = getProviderLogo(providerType)
  const align = role === "user" ? "end" : "start"
  const hasContent = content.trim().length > 0

  useEffect(() => {
    return () => {
      if (utteranceRef.current) {
        window.speechSynthesis?.cancel()
        utteranceRef.current = null
      }
    }
  }, [])

  const exportMessage = async (format: "markdown" | "pdf" | "docx") => {
    const fileBase = buildExportName(label)
    if (format === "markdown") {
      const result = await saveTextFile(`${fileBase}.md`, content, "text/markdown;charset=utf-8")
      if (!result.canceled) {
        showToast({ title: "Message exported", description: result.path ?? `${fileBase}.md saved.`, type: "success" })
      }
      return
    }
    if (format === "pdf") {
      const result = await savePdfFile(`${fileBase}.pdf`, content)
      if (!result.canceled) {
        showToast({ title: "Message exported", description: result.path ?? `${fileBase}.pdf saved.`, type: "success" })
      }
      return
    }
    const result = await saveDocxFile(`${fileBase}.docx`, content)
    if (!result.canceled) {
      showToast({ title: "Message exported", description: result.path ?? `${fileBase}.docx saved.`, type: "success" })
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
  }

  const handleSpeak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      utteranceRef.current = null
      setIsSpeaking(false)
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(content)
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => {
      utteranceRef.current = null
      setIsSpeaking(false)
    }
    utterance.onerror = () => {
      utteranceRef.current = null
      setIsSpeaking(false)
    }
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

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
          <Bubble variant={role === "user" ? "default" : role === "assistant" ? "outline" : "muted"} align={align} className="max-w-full">
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
          <div className="flex min-w-0 items-center justify-end gap-1 px-1 text-[11px] text-muted-foreground">
            {createdAt ? <div className="mr-auto truncate">{new Date(createdAt).toLocaleString()}</div> : <div className="mr-auto" />}
            {isPending ? null : (
              <>
                <Button size="icon-sm" variant="ghost" type="button" onClick={handleSpeak} disabled={!hasContent}>
                  {isSpeaking ? <SquareIcon /> : <Volume2Icon />}
                </Button>
                <Button size="icon-sm" variant="ghost" type="button" onClick={() => void handleCopy()} disabled={!hasContent}>
                  <CopyIcon />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" type="button" disabled={!hasContent} />}>
                    <DownloadIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36 min-w-36">
                    <DropdownMenuItem onClick={() => void exportMessage("markdown")}>Markdown</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void exportMessage("pdf")}>PDF</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void exportMessage("docx")}>DOCX</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </MessageContent>
    </Message>
  )
}