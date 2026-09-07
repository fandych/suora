import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { WorkflowTraceSnapshot } from "@/data/domain/models"
import { WorkflowTraceJsonPreview } from "@/views/workflows/components/workflow-trace-json-preview"

type WorkflowTraceSnapshotViewerProps = {
  before?: WorkflowTraceSnapshot
  after?: WorkflowTraceSnapshot
}

export function WorkflowTraceSnapshotViewer({ before, after }: WorkflowTraceSnapshotViewerProps) {
  const [phase, setPhase] = useState<"before" | "after">(after ? "after" : "before")
  const [root, setRoot] = useState<"current" | "vars" | "steps" | "input">("current")
  const snapshot = phase === "after" ? after : before
  const value = useMemo(() => snapshot?.[root], [root, snapshot])

  if (!snapshot) return <p className="text-xs text-muted-foreground">Snapshot unavailable for this older run.</p>

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1"><Button type="button" size="xs" variant={phase === "before" ? "secondary" : "ghost"} onClick={() => setPhase("before")} disabled={!before}>Before</Button><Button type="button" size="xs" variant={phase === "after" ? "secondary" : "ghost"} onClick={() => setPhase("after")} disabled={!after}>After</Button></div>
        <NativeSelect value={root} onChange={(event) => setRoot(event.target.value as typeof root)} className="h-7 w-32 text-xs"><NativeSelectOption value="current">$current</NativeSelectOption><NativeSelectOption value="vars">$vars</NativeSelectOption><NativeSelectOption value="steps">$steps</NativeSelectOption><NativeSelectOption value="input">$input</NativeSelectOption></NativeSelect>
      </div>
      {snapshot.redactedPaths.length > 0 || snapshot.truncated ? <p className="text-[10px] text-muted-foreground">{snapshot.redactedPaths.length ? `${snapshot.redactedPaths.length} values redacted` : ""}{snapshot.redactedPaths.length && snapshot.truncated ? " · " : ""}{snapshot.truncated ? "Snapshot truncated" : ""}</p> : null}
      <WorkflowTraceJsonPreview value={JSON.stringify(value, null, 2)} />
    </div>
  )
}
