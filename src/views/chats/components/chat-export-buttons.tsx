import { DownloadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type ChatExportButtonsProps = {
  disabled?: boolean
  onExport: (format: "markdown" | "pdf" | "docx") => Promise<void>
}

export function ChatExportButtons({ disabled = false, onExport }: ChatExportButtonsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" variant="outline" type="button" disabled={disabled} />}>
        <DownloadIcon data-icon="inline-start" />
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36 min-w-36">
        <DropdownMenuItem data-chat-export="markdown" onClick={() => void onExport("markdown")}>Markdown</DropdownMenuItem>
        <DropdownMenuItem data-chat-export="pdf" onClick={() => void onExport("pdf")}>PDF</DropdownMenuItem>
        <DropdownMenuItem data-chat-export="docx" onClick={() => void onExport("docx")}>DOCX</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}