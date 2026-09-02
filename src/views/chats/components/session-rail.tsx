import { MessageCircleIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ChatSummary } from "@/data/domain/models"

function formatRelativeTime(timestamp: number) {
  const deltaMs = timestamp - Date.now()
  const deltaMinutes = Math.round(deltaMs / (60 * 1000))
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  if (Math.abs(deltaMinutes) < 60) {
    return formatter.format(deltaMinutes, "minute")
  }

  const deltaHours = Math.round(deltaMinutes / 60)
  if (Math.abs(deltaHours) < 24) {
    return formatter.format(deltaHours, "hour")
  }

  const deltaDays = Math.round(deltaHours / 24)
  if (Math.abs(deltaDays) < 7) {
    return formatter.format(deltaDays, "day")
  }

  return new Date(timestamp).toLocaleDateString()
}

export function SessionRail({
  sessions,
  activeChatId,
  isLoading,
  onNewChat,
  onSelectChat,
}: {
  sessions: ChatSummary[]
  activeChatId: string | null
  isLoading: boolean
  onNewChat: () => void
  onSelectChat: (chatId: string) => void
}) {
  return (
    <aside className="hidden w-80 shrink-0 flex-col border-r bg-muted/20 md:flex">
      <div className="border-b px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Sessions
            </div>
            <div className="mt-1 text-sm text-foreground">Recent chat context</div>
          </div>
          <Button size="sm" onClick={onNewChat}>
            <PlusIcon />
            New chat
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          {isLoading ? (
            <div className="rounded-2xl border bg-background px-3 py-4 text-sm text-muted-foreground">
              Loading sessions...
            </div>
          ) : null}

          {!isLoading && sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-background px-4 py-6 text-center text-sm text-muted-foreground">
              Start a new chat to build your first reusable conversation thread.
            </div>
          ) : null}

          {sessions.map((session) => {
            const isActive = session.id === activeChatId

            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelectChat(session.id)}
                className={[
                  "flex w-full flex-col items-start gap-2 rounded-2xl border px-3 py-3 text-left transition-colors",
                  isActive
                    ? "border-primary/45 bg-background shadow-sm"
                    : "border-transparent bg-background/70 hover:border-border hover:bg-background",
                ].join(" ")}
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {session.title}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {session.summary || "No summary yet."}
                    </div>
                  </div>
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <MessageCircleIcon className="size-4" />
                  </div>
                </div>

                <div className="flex w-full items-center justify-between gap-3 text-[11px] text-muted-foreground">
                  <span>{formatRelativeTime(session.updatedAt)}</span>
                  <span className="truncate">{session.chatbotId}</span>
                </div>
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </aside>
  )
}