import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AgentSummary } from "@/data/domain/models"

type AgentCardProps = {
  agent: AgentSummary
  onOpen: (agentId: string) => void
}

export function AgentCard({ agent, onOpen }: AgentCardProps) {
  const kindLabel = agent.source === "system" ? "System" : agent.kind

  return (
    <Card
      className="min-w-0 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/20 hover:shadow-sm"
      onClick={() => onOpen(agent.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(agent.id)
        }
      }}
      role="button"
      tabIndex={0}
    >
      <CardHeader className="pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted/20 text-sm font-semibold text-foreground">AG</div>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{agent.title}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{kindLabel}</Badge>
              {agent.isDisabled ? <Badge variant="secondary">Disabled</Badge> : null}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Name</div>
          <div className="mt-1 truncate font-medium text-foreground">{agent.title}</div>
        </div>
        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Kind</div>
          <div className="mt-1 truncate text-foreground">{kindLabel}</div>
        </div>
        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Summary</div>
          <div className="mt-1 text-sm leading-6 text-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">
            {agent.summary || "No description yet."}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
