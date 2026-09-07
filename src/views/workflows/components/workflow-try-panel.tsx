import { useState } from "react"
import { ChevronRightIcon, CircleAlertIcon, CircleCheckIcon, CircleMinusIcon, Clock3Icon, DownloadIcon, LoaderCircleIcon, PlayIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Textarea } from "@/components/ui/textarea"
import type { WorkflowInvocationRecord } from "@/data/domain/models"
import { downloadJson } from "@/lib/browser-files"
import { WorkflowTraceJsonPreview } from "@/views/workflows/components/workflow-trace-json-preview"
import { WorkflowTraceCopyButton, WorkflowTraceValueSection } from "@/views/workflows/components/workflow-trace-sections"
import { WorkflowPanelResizeHandle } from "@/views/workflows/components/workflow-panel-resize-handle"
import { WorkflowTraceSnapshotViewer } from "@/views/workflows/components/workflow-trace-snapshot-viewer"

function TraceStatusIcon({ status }: { status: string }) {
  if (status === "running") {
    return <LoaderCircleIcon className="size-5 animate-spin text-sky-600" />
  }
  if (status === "success") {
    return <CircleCheckIcon className="size-5 text-emerald-600" />
  }
  if (status === "error") {
    return <CircleAlertIcon className="size-5 text-red-600" />
  }
  if (status === "queued") {
    return <Clock3Icon className="size-5 text-slate-500" />
  }
  if (status === "skipped") {
    return <CircleMinusIcon className="size-5 text-slate-500" />
  }
  return <CircleMinusIcon className="size-5 text-slate-500" />
}

function getTraceStatusLabel(status: string) {
  if (status === "success") return "Succeeded"
  if (status === "running") return "Running"
  if (status === "error") return "Failed"
  if (status === "queued") return "Waiting"
  if (status === "skipped") return "Skipped"
  return status
}

function getInvocationMetadata(invocation: WorkflowInvocationRecord) {
  try {
    return JSON.parse(invocation.output) as { durationMs?: number; requestId?: string; executionTarget?: string; errorMessage?: string | null }
  } catch {
    return {}
  }
}

export function WorkflowTryPanel({ invocation, input, isRunning, error, onInputChange, onRun, onClose, width, onWidthChange }: {
  invocation: WorkflowInvocationRecord | null
  input: string
  isRunning: boolean
  error: string | null
  onInputChange: (value: string) => void
  onRun: () => void
  onClose: () => void
  width: number
  onWidthChange: (width: number) => void
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  async function copyPreview(key: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey((current) => current === key ? null : current), 1200)
  }

  return (
    <div className="relative flex h-full max-w-[calc(100vw-1.5rem)] min-h-0 flex-col overflow-hidden rounded-xl border bg-background/95 p-2 shadow-xl" style={{ width }}>
      <WorkflowPanelResizeHandle label="Resize try panel" onResize={(deltaX) => onWidthChange(Math.min(520, Math.max(260, width - deltaX)))} />
      <div className="flex items-center justify-between gap-2 border-b px-1 pb-2 text-xs font-semibold">
        <div className="flex items-center gap-2">
          <PlayIcon className="size-3.5 text-muted-foreground" />
          Try run
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-xs" disabled={!invocation} onClick={() => invocation && downloadJson(`workflow-try-${invocation.id}.json`, invocation)} aria-label="Export try result" title="Export try result">
            <DownloadIcon />
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close try panel">
            <XIcon />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-1 pb-5">
        <Textarea value={input} onChange={(event) => onInputChange(event.target.value)} className="min-h-24 font-mono text-xs" placeholder='{"orderId":"demo-001"}' spellCheck={false} />
        <Button type="button" className="w-full" onClick={onRun} disabled={isRunning}>
          <PlayIcon />
          {isRunning ? "Running" : "Run"}
        </Button>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-[11px] text-muted-foreground">Safe dry runs do not call AI, HTTP, scripts, integrations, or email. Use Run release for real side effects.</p>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {invocation ? (
          <div className="space-y-3 border-t pt-3">
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2">
              <span className="text-xs text-muted-foreground">Execution status</span>
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <TraceStatusIcon status={invocation.status} />
                <span>{getTraceStatusLabel(invocation.status)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <div className="rounded-lg border px-2.5 py-2"><span className="block">Trigger</span><span className="font-medium text-foreground">{invocation.trigger}</span></div>
              {(() => { const metadata = getInvocationMetadata(invocation); return <div className="rounded-lg border px-2.5 py-2"><span className="block">Duration</span><span className="font-medium text-foreground">{metadata.durationMs ?? Math.max(0, ...invocation.traces.map((trace) => trace.finishedAt - trace.startedAt))} ms</span></div> })()}
            </div>
            {(() => { const metadata = getInvocationMetadata(invocation); return metadata.requestId ? <p className="truncate text-[10px] text-muted-foreground">Request {metadata.requestId} · {metadata.executionTarget ?? "desktop"}</p> : null })()}

            {invocation.traces.map((trace) => (
              <Collapsible key={trace.traceId ?? `${trace.nodeId}-${trace.startedAt}`} className="overflow-hidden rounded-xl border">
                <CollapsibleTrigger className="group/trace flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/60">
                  <TraceStatusIcon status={trace.status} />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{trace.label}</span>
                  <span className="text-[10px] font-medium text-muted-foreground">{getTraceStatusLabel(trace.status)}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{Math.max(0, trace.finishedAt - trace.startedAt)} ms</span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open/trace:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid gap-2 border-t p-3">
                    <WorkflowTraceValueSection
                      id="input"
                      label="Input"
                      value={trace.input || "No input"}
                      copied={copiedKey === `${trace.traceId ?? trace.nodeId}-input`}
                      onCopy={() => void copyPreview(`${trace.traceId ?? trace.nodeId}-input`, trace.input || "")}
                    />
                    <WorkflowTraceValueSection
                      id="output"
                      label="Output"
                      value={trace.output || "No output"}
                      copied={copiedKey === `${trace.traceId ?? trace.nodeId}-output`}
                      onCopy={() => void copyPreview(`${trace.traceId ?? trace.nodeId}-output`, trace.output)}
                    />
                    <WorkflowTraceSnapshotViewer before={trace.contextBefore} after={trace.contextAfter} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}

            <Collapsible className="rounded-xl border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="flex items-center gap-1">
                <CollapsibleTrigger className="group/final flex min-w-0 flex-1 items-center gap-2 p-3 text-left text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <ChevronRightIcon className="size-4 transition-transform group-data-panel-open/final:rotate-90" />
                  Final output
                </CollapsibleTrigger>
                <WorkflowTraceCopyButton copied={copiedKey === "final-output"} onClick={() => void copyPreview("final-output", invocation.output)} label="Copy final output" />
              </div>
              <CollapsibleContent className="border-t border-emerald-200 px-3 pb-3 pt-2 dark:border-emerald-900">
                <WorkflowTraceJsonPreview value={invocation.output || "No output"} className="text-emerald-900 dark:text-emerald-100" />
              </CollapsibleContent>
            </Collapsible>
          </div>
        ) : <div className="rounded-xl border border-dashed px-3 py-4 text-xs text-muted-foreground">No try run yet. Run the current draft to inspect node-level inputs and outputs.</div>}
      </div>
    </div>
  )
}