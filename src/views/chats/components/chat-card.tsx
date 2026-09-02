import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ChatSummary } from "@/data/domain/models"

type ChatCardProps = {
  chat: ChatSummary
  onOpen: (chatId: string) => void
}

export function ChatCard({ chat, onOpen }: ChatCardProps) {
  return (
    <Card
      className="min-w-0 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/20 hover:shadow-sm"
      onClick={() => onOpen(chat.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(chat.id)
        }
      }}
      role="button"
      tabIndex={0}
    >
      <CardHeader className="pb-3">
        <CardTitle className="truncate text-base">{chat.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm leading-6 text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">
          {chat.summary || "No summary yet."}
        </div>
      </CardContent>
    </Card>
  )
}
