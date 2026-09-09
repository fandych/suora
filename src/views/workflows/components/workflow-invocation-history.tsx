import { DownloadIcon, HistoryIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { WorkflowInvocationRecord } from "@/data/domain/models"
import { downloadJson } from "@/lib/browser/file-exports"

function readInvocationOutput(invocation: WorkflowInvocationRecord) {
  try {
    return JSON.parse(invocation.output) as { mode?: string; executionTarget?: string; requestId?: string; durationMs?: number; errorMessage?: string | null }
  } catch {
    return {}
  }
}

export function WorkflowInvocationHistory({ invocations, selectedId, onSelect }: {
  invocations: WorkflowInvocationRecord[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const getElapsedDuration = (invocation: WorkflowInvocationRecord) => {
    if (invocation.traces.length === 0) return 0
    const startedAt = Math.min(...invocation.traces.map((trace) => trace.startedAt))
    const finishedAt = Math.max(...invocation.traces.map((trace) => trace.finishedAt))
    return Math.max(0, finishedAt - startedAt)
  }

  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-xl border bg-background/95 p-2 shadow-xl">
      <div className="flex items-center justify-between gap-2 border-b px-1 pb-2 text-xs font-semibold">
        <span className="flex items-center gap-2"><HistoryIcon /> Invocation history</span>
        <Button size="icon-xs" variant="ghost" disabled={invocations.length === 0} aria-label="Export invocation history" onClick={() => downloadJson("workflow-invocations.json", invocations)}><DownloadIcon /></Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 p-1">
          {invocations.map((invocation) => (
            <button key={invocation.id} type="button" onClick={() => onSelect(invocation.id)} className={`rounded-lg border p-2.5 text-left text-xs ${selectedId === invocation.id ? "border-primary bg-primary/5" : "hover:bg-muted/60"}`}>
              {(() => {
                const metadata = readInvocationOutput(invocation)
                return <>
                  <div className="flex items-center justify-between gap-2"><span className="capitalize">{invocation.trigger}</span><div className="flex items-center gap-1"><Badge variant={invocation.status === "success" ? "default" : "destructive"}>{invocation.status}</Badge>{metadata.mode === "dry_run" ? <Badge variant="secondary">Dry run</Badge> : null}</div></div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{new Date(invocation.createdAt).toLocaleString()} · v{invocation.versionId.slice(0, 8)} · {metadata.executionTarget ?? "desktop"} · {metadata.durationMs ?? getElapsedDuration(invocation)} ms</p>
                  {metadata.requestId ? <p className="mt-0.5 truncate text-[10px] text-muted-foreground">Request {metadata.requestId}</p> : null}
                </>
              })()}
            </button>
          ))}
          {invocations.length === 0 ? <p className="px-2 py-6 text-center text-xs text-muted-foreground">No executions recorded.</p> : null}
        </div>
      </ScrollArea>
    </div>
  )
}