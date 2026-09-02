import katex from "katex"
import { CopyIcon, DownloadIcon, Volume2Icon } from "lucide-react"
import { useEffect, useId, useMemo, useRef } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader } from "@/components/ui/message"
import { downloadText, exportTextAsDocx, exportTextAsPdf } from "@/lib/browser-files"
import { cn } from "@/lib/utils"
import { markdownToTiptapHtml } from "@/views/components/document-markdown"
import { getProviderLogo } from "@/views/components/provider-logo"

type ChatMessageItemProps = {
  content: string
  createdAt?: number
  kind?: "message" | "tool"
  label: string
  providerType?: string
  role: "user" | "assistant" | "system"
}

async function renderMermaid(target: HTMLElement, id: string, code: string) {
  const mermaid = (await import("mermaid")).default
  mermaid.initialize({ startOnLoad: false, theme: "default" })
  try {
    const { svg } = await mermaid.render(id, code)
    target.innerHTML = svg
  } catch (error) {
    target.textContent = String(error)
  }
}

function buildExportName(label: string) {
  return (label || "message").replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase() || "message"
}

export function ChatMessageItem({ content, createdAt, kind = "message", label, providerType = "openai", role }: ChatMessageItemProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const messageId = useId().replace(/:/g, "_")
  const AssistantLogo = getProviderLogo(providerType)
  const align = role === "user" ? "end" : "start"

  const html = useMemo(() => markdownToTiptapHtml(content || ""), [content])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const cleanupCallbacks: Array<() => void> = []

    container.querySelectorAll("a").forEach((anchor) => {
      anchor.setAttribute("target", "_blank")
      anchor.setAttribute("rel", "noreferrer noopener")
    })

    container.querySelectorAll("[data-math-inline]").forEach((node) => {
      const contentValue = node.getAttribute("data-math-inline") ?? ""
      try {
        node.innerHTML = katex.renderToString(contentValue, { displayMode: false, throwOnError: false })
        node.classList.add("document-math-inline")
      } catch {
        node.textContent = contentValue
      }
    })

    container.querySelectorAll("[data-math-block]").forEach((node) => {
      const contentValue = node.getAttribute("data-math-block") ?? ""
      try {
        node.innerHTML = katex.renderToString(contentValue, { displayMode: true, throwOnError: false })
        node.classList.add("document-math-block")
      } catch {
        node.textContent = contentValue
      }
    })

    container.querySelectorAll("[data-mermaid]").forEach((node, index) => {
      node.classList.add("document-mermaid-block")
      void renderMermaid(node as HTMLElement, `${messageId}-mermaid-${index}`, node.getAttribute("data-mermaid") ?? "")
    })

    container.querySelectorAll("pre").forEach((pre, index) => {
      if ((pre as HTMLElement).dataset.enhanced === "true") {
        return
      }

      ;(pre as HTMLElement).dataset.enhanced = "true"
      const codeText = pre.textContent ?? ""
      const wrapper = document.createElement("div")
      wrapper.className = "chat-code-block"

      const toolbar = document.createElement("div")
      toolbar.className = "chat-code-toolbar"

      const copyButton = document.createElement("button")
      copyButton.type = "button"
      copyButton.className = "chat-code-copy"
      copyButton.textContent = "Copy code"
      copyButton.addEventListener("click", () => {
        void navigator.clipboard.writeText(codeText)
      })
      cleanupCallbacks.push(() => copyButton.replaceWith(copyButton.cloneNode(true)))

      toolbar.appendChild(copyButton)
      pre.parentNode?.insertBefore(wrapper, pre)
      wrapper.appendChild(toolbar)
      wrapper.appendChild(pre)

      const codeElement = pre.querySelector("code")
      if (codeElement) {
        const languageMatch = Array.from(codeElement.classList).find((item) => item.startsWith("language-"))
        if (languageMatch) {
          const labelNode = document.createElement("span")
          labelNode.className = "chat-code-language"
          labelNode.textContent = languageMatch.replace("language-", "")
          toolbar.insertBefore(labelNode, copyButton)
        }
      }

      wrapper.dataset.index = String(index)
    })

    return () => {
      cleanupCallbacks.forEach((callback) => callback())
    }
  }, [html, messageId])

  const exportMessage = async (format: "markdown" | "pdf" | "docx") => {
    const fileBase = buildExportName(label)
    if (format === "markdown") {
      downloadText(`${fileBase}.md`, content, "text/markdown;charset=utf-8")
      return
    }
    if (format === "pdf") {
      await exportTextAsPdf(`${fileBase}.pdf`, content)
      return
    }
    await exportTextAsDocx(`${fileBase}.docx`, content)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
  }

  const handleSpeak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return
    }

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(content))
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
        <Bubble variant={role === "user" ? "default" : role === "assistant" ? "outline" : "muted"} align={align} className="max-w-[min(100%,56rem)]">
          <BubbleContent>
            <div ref={containerRef} className="document-prose chat-prose min-w-0 max-w-none text-sm" dangerouslySetInnerHTML={{ __html: html }} />
          </BubbleContent>
        </Bubble>
        <MessageFooter className="flex flex-wrap items-center gap-2 text-[11px]">
          <div>{createdAt ? new Date(createdAt).toLocaleString() : null}</div>
          <div className="ml-auto flex items-center gap-1">
            <Button size="icon-sm" variant="ghost" onClick={handleSpeak}>
              <Volume2Icon />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => void handleCopy()}>
              <CopyIcon />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" />}>
                <DownloadIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36 min-w-36">
                <DropdownMenuItem onClick={() => void exportMessage("markdown")}>Markdown</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportMessage("pdf")}>PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportMessage("docx")}>DOCX</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </MessageFooter>
      </MessageContent>
    </Message>
  )
}