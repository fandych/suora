import { cn } from "@/lib/utils"

type ChatExportButtonsProps = {
  disabled?: boolean
  onExport: (format: "markdown" | "pdf" | "docx") => Promise<void>
}

const buttonClassName = "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"

export function ChatExportButtons({ disabled = false, onExport }: ChatExportButtonsProps) {
  return (
    <div className="flex items-center gap-px overflow-hidden rounded-lg border border-input bg-background">
      <button type="button" data-chat-export="markdown" className={cn(buttonClassName, "rounded-none border-0")} disabled={disabled} onClick={() => void onExport("markdown")}>MD</button>
      <button type="button" data-chat-export="pdf" className={cn(buttonClassName, "rounded-none border-0 border-l")} disabled={disabled} onClick={() => void onExport("pdf")}>PDF</button>
      <button type="button" data-chat-export="docx" className={cn(buttonClassName, "rounded-none border-0 border-l")} disabled={disabled} onClick={() => void onExport("docx")}>DOCX</button>
    </div>
  )
}