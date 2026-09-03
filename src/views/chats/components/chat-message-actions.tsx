import { CopyIcon, DownloadIcon, SquareIcon, Volume2Icon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { saveDocxFile, savePdfFile, saveTextFile } from "@/lib/browser-files"
import { copyTextToClipboard } from "@/lib/clipboard"
import { showToast } from "@/lib/app-toast"

type ChatMessageActionsProps = {
  baseName: string
  className?: string
  content: string
  createdAt?: number
}

export function ChatMessageActions({ baseName, className, content, createdAt }: ChatMessageActionsProps) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
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
    if (format === "markdown") {
      const result = await saveTextFile(`${baseName}.md`, content, "text/markdown;charset=utf-8")
      if (!result.canceled) {
        showToast({ title: "Message exported", description: result.path ?? `${baseName}.md saved.`, type: "success" })
      }
      return
    }
    if (format === "pdf") {
      const result = await savePdfFile(`${baseName}.pdf`, content)
      if (!result.canceled) {
        showToast({ title: "Message exported", description: result.path ?? `${baseName}.pdf saved.`, type: "success" })
      }
      return
    }

    const result = await saveDocxFile(`${baseName}.docx`, content)
    if (!result.canceled) {
      showToast({ title: "Message exported", description: result.path ?? `${baseName}.docx saved.`, type: "success" })
    }
  }

  const handleCopy = async () => {
    try {
      await copyTextToClipboard(content)
      showToast({ title: "Message copied", description: "The message content was copied to clipboard.", type: "success", timeout: 2000 })
    } catch (error) {
      showToast({ title: "Copy failed", description: error instanceof Error ? error.message : String(error), type: "error", timeout: 3000 })
    }
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
    <div className={`flex min-w-0 items-center justify-end gap-1 px-1 text-[11px] text-muted-foreground ${className ?? ""}`}>
      {createdAt ? <div className="mr-auto truncate">{new Date(createdAt).toLocaleString()}</div> : <div className="mr-auto" />}
      <Button size="icon-sm" variant="ghost" type="button" onClick={handleSpeak} disabled={!hasContent}>{isSpeaking ? <SquareIcon /> : <Volume2Icon />}</Button>
      <Button size="icon-sm" variant="ghost" type="button" onClick={() => void handleCopy()} disabled={!hasContent}><CopyIcon /></Button>
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
    </div>
  )
}