import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { DocumentSummary, IntegrationSummary, WorkflowInvocationRecord, WorkflowNodeData } from "@/data/domain/models"
import { WorkflowTraceExplorer } from "@/views/workflows/components/workflow-trace-explorer"

type WorkflowPropertiesPanelProps = {
  agents: Array<{ id: string; title: string }>
  documents: DocumentSummary[]
  integrations: IntegrationSummary[]
  modelOptions: Array<{ id: string; label: string }>
  onDeleteNode: () => void
  onDuplicateNode: () => void
  onRun: () => void
  onSave: () => void
  onSelectTraceNode: (nodeId: string) => void
  resourceBindings: { providerId: string; skillId: string; documentId: string; integrationId: string }
  selectedNode: { id: string; data: WorkflowNodeData } | null
  selectedNodeId: string | null
  setDryRunInput: (value: string) => void
  setResourceBindings: (value: { providerId: string; skillId: string; documentId: string; integrationId: string }) => void
  setSummary: (value: string) => void
  setTitle: (value: string) => void
  summary: string
  title: string
  traces: WorkflowInvocationRecord[]
  updateNode: (patch: Partial<WorkflowNodeData>) => void
  dryRunInput: string
}

export function WorkflowPropertiesPanel(props: WorkflowPropertiesPanelProps) {
  const {
    agents,
    documents,
    integrations,
    modelOptions,
    onDeleteNode,
    onDuplicateNode,
    onRun,
    onSave,
    onSelectTraceNode,
    resourceBindings,
    selectedNode,
    selectedNodeId,
    setDryRunInput,
    setResourceBindings,
    setSummary,
    setTitle,
    summary,
    title,
    traces,
    updateNode,
    dryRunInput,
  } = props

  const node = selectedNode?.data ?? null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Properties</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">Workflow metadata, node configuration, and trace explorer.</div>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-3 text-xs">
          <section className="space-y-2 rounded-xl border p-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workflow</div>
            <Input className="h-8 text-xs" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Workflow name" />
            <Textarea className="min-h-20 text-xs" value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} placeholder="Workflow summary" />
          </section>

          <section className="space-y-2 rounded-xl border p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Selected node</div>
              {selectedNode ? <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{selectedNode.id}</Badge> : null}
            </div>
            {node ? (
              <>
                <Input className="h-8 text-xs" value={node.label} onChange={(event) => updateNode({ label: event.target.value })} placeholder="Node label" />
                <NativeSelect size="sm" value={node.kind} onChange={(event) => updateNode({ kind: event.target.value as WorkflowNodeData["kind"] })}>
                  <NativeSelectOption value="start">Start</NativeSelectOption>
                  <NativeSelectOption value="end">End</NativeSelectOption>
                  <NativeSelectOption value="document-retrieval">Document retrieval</NativeSelectOption>
                  <NativeSelectOption value="agent">Agent</NativeSelectOption>
                  <NativeSelectOption value="fork">Fork</NativeSelectOption>
                  <NativeSelectOption value="join">Join</NativeSelectOption>
                  <NativeSelectOption value="if-else">If / Else</NativeSelectOption>
                  <NativeSelectOption value="http">HTTP</NativeSelectOption>
                  <NativeSelectOption value="script">Script</NativeSelectOption>
                </NativeSelect>
                <Input className="h-8 text-xs" value={node.task ?? ""} onChange={(event) => updateNode({ task: event.target.value })} placeholder="Task summary" />
                {node.kind === "agent" ? <>
                  <NativeSelect size="sm" value={node.agentId ?? ""} onChange={(event) => updateNode({ agentId: event.target.value })}><NativeSelectOption value="">Agent binding</NativeSelectOption>{agents.map((agent) => <NativeSelectOption key={agent.id} value={agent.id}>{agent.title}</NativeSelectOption>)}</NativeSelect>
                  <NativeSelect size="sm" value={node.modelId ?? ""} onChange={(event) => updateNode({ modelId: event.target.value })}><NativeSelectOption value="">Model override</NativeSelectOption>{modelOptions.map((model) => <NativeSelectOption key={model.id} value={model.id}>{model.label}</NativeSelectOption>)}</NativeSelect>
                  <Textarea className="min-h-28 text-xs" value={node.prompt} onChange={(event) => updateNode({ prompt: event.target.value })} rows={6} placeholder="Prompt or node instruction" />
                </> : null}
                {node.kind === "document-retrieval" ? <>
                  <NativeSelect size="sm" value={node.documentId ?? ""} onChange={(event) => { const document = documents.find((item) => item.id === event.target.value); updateNode({ documentId: event.target.value, documentName: document?.title ?? "" }) }}><NativeSelectOption value="">Document source</NativeSelectOption>{documents.map((document) => <NativeSelectOption key={document.id} value={document.id}>{document.title}</NativeSelectOption>)}</NativeSelect>
                  <Input className="h-8 text-xs" value={node.queryExpression ?? ""} onChange={(event) => updateNode({ queryExpression: event.target.value })} placeholder="$input.query" />
                  <Input className="h-8 text-xs" type="number" value={String(node.resultLimit ?? 5)} onChange={(event) => updateNode({ resultLimit: Number(event.target.value) || 5 })} placeholder="Result count" />
                </> : null}
                {node.kind === "http" ? <>
                  <NativeSelect size="sm" value={node.integrationId ?? ""} onChange={(event) => { const integration = integrations.find((item) => item.id === event.target.value); updateNode({ integrationId: event.target.value, integrationName: integration?.title ?? "" }) }}><NativeSelectOption value="">Bound integration</NativeSelectOption>{integrations.map((integration) => <NativeSelectOption key={integration.id} value={integration.id}>{integration.title}</NativeSelectOption>)}</NativeSelect>
                  <NativeSelect size="sm" value={node.method ?? "POST"} onChange={(event) => updateNode({ method: event.target.value })}><NativeSelectOption value="GET">GET</NativeSelectOption><NativeSelectOption value="POST">POST</NativeSelectOption><NativeSelectOption value="PUT">PUT</NativeSelectOption><NativeSelectOption value="PATCH">PATCH</NativeSelectOption><NativeSelectOption value="DELETE">DELETE</NativeSelectOption></NativeSelect>
                  <Input className="h-8 text-xs" value={node.url ?? ""} onChange={(event) => updateNode({ url: event.target.value })} placeholder="https://api.example.com" />
                  <Textarea className="min-h-16 font-mono text-xs" value={node.headersJson ?? "{}"} onChange={(event) => updateNode({ headersJson: event.target.value })} rows={3} placeholder="Headers JSON" />
                  <Textarea className="min-h-16 font-mono text-xs" value={node.bodyJson ?? "{}"} onChange={(event) => updateNode({ bodyJson: event.target.value })} rows={3} placeholder="Body JSON" />
                </> : null}
                {node.kind === "script" ? <>
                  <NativeSelect size="sm" value={node.runtime ?? "node"} onChange={(event) => updateNode({ runtime: event.target.value })}><NativeSelectOption value="node">Node</NativeSelectOption><NativeSelectOption value="python">Python</NativeSelectOption><NativeSelectOption value="powershell">PowerShell</NativeSelectOption></NativeSelect>
                  <Input className="h-8 text-xs" type="number" value={String(node.timeoutSeconds ?? 60)} onChange={(event) => updateNode({ timeoutSeconds: Number(event.target.value) || 60 })} placeholder="Timeout seconds" />
                  <Textarea className="min-h-32 font-mono text-xs" value={node.script ?? ""} onChange={(event) => updateNode({ script: event.target.value })} rows={8} placeholder="Script body" />
                </> : null}
                {node.kind === "fork" ? <Input className="h-8 text-xs" type="number" value={String(node.branchCount ?? 2)} onChange={(event) => updateNode({ branchCount: Number(event.target.value) || 2 })} placeholder="Branch count" /> : null}
                {node.kind === "join" ? <NativeSelect size="sm" value={node.joinStrategy ?? "wait-all"} onChange={(event) => updateNode({ joinStrategy: event.target.value as WorkflowNodeData["joinStrategy"] })}><NativeSelectOption value="wait-all">Wait all</NativeSelectOption><NativeSelectOption value="wait-any">Wait any</NativeSelectOption></NativeSelect> : null}
                {node.kind === "if-else" ? <>
                  <Input className="h-8 text-xs" value={node.runIf ?? ""} onChange={(event) => updateNode({ runIf: event.target.value })} placeholder="Primary condition expression" />
                  <Input className="h-8 text-xs" value={node.trueLabel ?? "True"} onChange={(event) => updateNode({ trueLabel: event.target.value, branches: [{ id: node.branches?.[0]?.id ?? "true", label: event.target.value, expression: node.branches?.[0]?.expression ?? node.runIf ?? "" }, { id: node.branches?.[1]?.id ?? "false", label: node.falseLabel ?? "False", expression: node.branches?.[1]?.expression ?? "" }] })} placeholder="True label" />
                  <Input className="h-8 text-xs" value={node.falseLabel ?? "False"} onChange={(event) => updateNode({ falseLabel: event.target.value, branches: [{ id: node.branches?.[0]?.id ?? "true", label: node.trueLabel ?? "True", expression: node.branches?.[0]?.expression ?? node.runIf ?? "" }, { id: node.branches?.[1]?.id ?? "false", label: event.target.value, expression: node.branches?.[1]?.expression ?? "" }] })} placeholder="False label" />
                </> : null}
                <Input className="h-8 text-xs" value={node.outputKey ?? ""} onChange={(event) => updateNode({ outputKey: event.target.value })} placeholder="Output key" />
                <div className="grid grid-cols-2 gap-2">
                  <Input className="h-8 text-xs" type="number" value={String(node.retryCount ?? 0)} onChange={(event) => updateNode({ retryCount: Number(event.target.value) || 0 })} placeholder="Retries" />
                  <Input className="h-8 text-xs" type="number" value={String(node.timeoutMs ?? 30000)} onChange={(event) => updateNode({ timeoutMs: Number(event.target.value) || 30000 })} placeholder="Timeout ms" />
                </div>
                <label className="flex items-center justify-between rounded-lg border px-2.5 py-2 text-[11px] text-muted-foreground"><span>Enabled</span><Switch checked={node.enabled ?? true} onCheckedChange={(checked) => updateNode({ enabled: checked })} /></label>
                <label className="flex items-center justify-between rounded-lg border px-2.5 py-2 text-[11px] text-muted-foreground"><span>Continue on error</span><Switch checked={node.continueOnError ?? false} onCheckedChange={(checked) => updateNode({ continueOnError: checked })} /></label>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onDuplicateNode}>Duplicate</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onDeleteNode}>Delete</Button>
                </div>
              </>
            ) : <div className="rounded-lg border border-dashed px-3 py-4 text-[11px] text-muted-foreground">Select a node from the graph to edit its behavior.</div>}
          </section>

          <section className="space-y-2 rounded-xl border p-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Try run</div>
            <Textarea className="min-h-24 font-mono text-[11px]" value={dryRunInput} onChange={(event) => setDryRunInput(event.target.value)} rows={5} placeholder="{ }" />
            <div className="grid gap-2">
              <Input className="h-8 text-xs" value={resourceBindings.providerId} onChange={(event) => setResourceBindings({ ...resourceBindings, providerId: event.target.value })} placeholder="Provider ID" />
              <Input className="h-8 text-xs" value={resourceBindings.skillId} onChange={(event) => setResourceBindings({ ...resourceBindings, skillId: event.target.value })} placeholder="Skill ID" />
              <Input className="h-8 text-xs" value={resourceBindings.documentId} onChange={(event) => setResourceBindings({ ...resourceBindings, documentId: event.target.value })} placeholder="Document ID" />
              <Input className="h-8 text-xs" value={resourceBindings.integrationId} onChange={(event) => setResourceBindings({ ...resourceBindings, integrationId: event.target.value })} placeholder="Integration ID" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onRun}>Run now</Button>
              <Button size="sm" className="h-8 text-xs" onClick={onSave}>Save state</Button>
            </div>
          </section>

          <WorkflowTraceExplorer invocations={traces} selectedNodeId={selectedNodeId} onSelectNode={onSelectTraceNode} />
        </div>
      </ScrollArea>
    </div>
  )
}