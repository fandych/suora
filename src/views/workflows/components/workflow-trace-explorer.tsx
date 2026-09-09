import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import type { WorkflowInvocationRecord } from "@/data/domain/models"
import { downloadText } from "@/lib/browser/file-exports"

type WorkflowTraceExplorerProps = {
  invocations: WorkflowInvocationRecord[]
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
}

export function WorkflowTraceExplorer({ invocations, selectedNodeId, onSelectNode }: WorkflowTraceExplorerProps) {
  const latest = invocations[0] ?? null

  return (
    <section className="space-y-2 rounded-xl border p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Dry run trace explorer</div>
        {latest ? <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => downloadText(`workflow-trace-${latest.id}.json`, JSON.stringify(latest, null, 2), "application/json;charset=utf-8")}>Export trace</Button> : null}
      </div>
      {latest ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border px-2.5 py-2 text-[11px]">
              <div className="text-muted-foreground">Run status</div>
              <div className="mt-1 font-medium text-foreground">{latest.status}</div>
            </div>
            <div className="rounded-lg border px-2.5 py-2 text-[11px]">
              <div className="text-muted-foreground">Triggered</div>
              <div className="mt-1 font-medium text-foreground">{latest.trigger}</div>
            </div>
          </div>
          <Textarea className="min-h-20 font-mono text-[11px]" value={latest.input} readOnly />
          <ScrollArea className="h-52 rounded-lg border">
            <div className="space-y-1.5 p-2">
              {latest.traces.map((trace) => (
                <button
                  key={`${latest.id}-${trace.nodeId}`}
                  type="button"
                  onClick={() => onSelectNode(trace.nodeId)}
                  className={`block w-full rounded-lg border px-2.5 py-2 text-left text-[11px] ${selectedNodeId === trace.nodeId ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{trace.label}</span>
                    <Badge variant={trace.status === "success" ? "default" : trace.status === "error" ? "destructive" : "outline"}>{trace.status}</Badge>
                  </div>
                  <div className="mt-1 leading-4 text-muted-foreground">{trace.output}</div>
                </button>
              ))}
            </div>
          </ScrollArea>
          <Textarea className="min-h-24 font-mono text-[11px]" value={latest.output} readOnly />
        </>
      ) : <div className="rounded-lg border border-dashed px-3 py-4 text-[11px] text-muted-foreground">No workflow runs yet.</div>}
    </section>
  )
}