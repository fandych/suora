import { Input } from "@/components/ui/input"
import { NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import type { DocumentSummary, IntegrationSummary, WorkflowNodeData } from "@/data/domain/models"
import { WorkflowField, WorkflowPanelSection } from "@/views/workflows/components/workflow-field"
import { WorkflowKeyValueEditor } from "@/views/workflows/components/workflow-parameter-editor"
import { getWorkflowJsonIssue } from "@/views/workflows/components/workflow-editor-state"
import { WorkflowNodeSelect } from "@/views/workflows/components/workflow-node-select"

export function WorkflowAgentEditorSection({
  node,
  agents,
  modelOptions,
  updateNode,
}: {
  node: WorkflowNodeData
  agents: Array<{ id: string; title: string }>
  modelOptions: Array<{ id: string; label: string }>
  updateNode: (patch: Partial<WorkflowNodeData>) => void
}) {
  return (
    <WorkflowPanelSection title="Agent settings">
      <WorkflowNodeSelect label="Agent binding" value={node.agentId ?? ""} onChange={(event) => updateNode({ agentId: event.target.value })}>
        <NativeSelectOption value="">Select an agent</NativeSelectOption>
        {agents.map((agent) => <NativeSelectOption key={agent.id} value={agent.id}>{agent.title}</NativeSelectOption>)}
      </WorkflowNodeSelect>
      <WorkflowNodeSelect label="Chat model" hint="Optional override for this node." value={node.modelId ?? ""} onChange={(event) => updateNode({ modelId: event.target.value })}>
        <NativeSelectOption value="">Select a model</NativeSelectOption>
        {modelOptions.map((model) => <NativeSelectOption key={model.id} value={model.id}>{model.label}</NativeSelectOption>)}
      </WorkflowNodeSelect>
      <WorkflowField label="Prompt" hint="Use workflow variables from earlier nodes when needed.">
        <Textarea className="min-h-28" value={node.prompt} onChange={(event) => updateNode({ prompt: event.target.value })} placeholder="Prompt template" />
      </WorkflowField>
    </WorkflowPanelSection>
  )
}

export function WorkflowDocumentEditorSection({
  node,
  documents,
  updateNode,
}: {
  node: WorkflowNodeData
  documents: DocumentSummary[]
  updateNode: (patch: Partial<WorkflowNodeData>) => void
}) {
  return (
    <WorkflowPanelSection title="Knowledge retrieval">
      <WorkflowNodeSelect label="Document knowledge base" value={node.documentId ?? ""} onChange={(event) => { const document = documents.find((item) => item.id === event.target.value); updateNode({ documentId: event.target.value, documentName: document?.title ?? "" }) }}>
        <NativeSelectOption value="">Select a document</NativeSelectOption>
        {documents.map((document) => <NativeSelectOption key={document.id} value={document.id}>{document.title}</NativeSelectOption>)}
      </WorkflowNodeSelect>
      <WorkflowField label="Search question">
        <Input value={node.queryExpression ?? ""} onChange={(event) => updateNode({ queryExpression: event.target.value })} placeholder="$input.query" />
      </WorkflowField>
      <WorkflowField label="Result count">
        <Input type="number" min={1} max={20} value={String(node.resultLimit ?? 5)} onChange={(event) => updateNode({ resultLimit: Math.max(1, Math.min(20, Number(event.target.value) || 5)) })} />
      </WorkflowField>
    </WorkflowPanelSection>
  )
}

export function WorkflowHttpEditorSection({
  node,
  integrations,
  updateNode,
}: {
  node: WorkflowNodeData
  integrations: IntegrationSummary[]
  updateNode: (patch: Partial<WorkflowNodeData>) => void
}) {
  const headersIssue = getWorkflowJsonIssue(node.headersJson ?? "{}", "Headers")
  const queryIssue = getWorkflowJsonIssue(node.queryJson ?? "{}", "Query parameters")
  const bodyIssue = getWorkflowJsonIssue(node.bodyJson ?? "{}", "Body")
  return (
    <WorkflowPanelSection title={node.kind === "webhook" ? "Webhook settings" : node.kind === "toolset" ? "Toolset settings" : "HTTP settings"}>
      <WorkflowNodeSelect label="Bound integration" value={node.integrationId ?? ""} onChange={(event) => { const integration = integrations.find((item) => item.id === event.target.value); updateNode({ integrationId: event.target.value, integrationName: integration?.title ?? "" }) }}>
        <NativeSelectOption value="">Select an integration</NativeSelectOption>
        {integrations.map((integration) => <NativeSelectOption key={integration.id} value={integration.id}>{integration.title}</NativeSelectOption>)}
      </WorkflowNodeSelect>
      <WorkflowNodeSelect label="Method" value={node.method ?? "POST"} onChange={(event) => updateNode({ method: event.target.value })}>
        <NativeSelectOption value="GET">GET</NativeSelectOption>
        <NativeSelectOption value="POST">POST</NativeSelectOption>
        <NativeSelectOption value="PUT">PUT</NativeSelectOption>
        <NativeSelectOption value="PATCH">PATCH</NativeSelectOption>
        <NativeSelectOption value="DELETE">DELETE</NativeSelectOption>
      </WorkflowNodeSelect>
      <WorkflowField label="URL">
        <Input value={node.url ?? ""} onChange={(event) => updateNode({ url: event.target.value })} placeholder="https://api.example.com" />
      </WorkflowField>
      <WorkflowKeyValueEditor label="Query parameters" value={node.queryJson ?? "{}"} onChange={(queryJson) => updateNode({ queryJson })} />
      {queryIssue ? <p className="text-[11px] text-destructive">{queryIssue}</p> : null}
      <WorkflowKeyValueEditor label="Headers" value={node.headersJson ?? "{}"} onChange={(headersJson) => updateNode({ headersJson })} />
      {headersIssue ? <p className="text-[11px] text-destructive">{headersIssue}</p> : null}
      <WorkflowField label="Body JSON"><Textarea aria-invalid={Boolean(bodyIssue)} className="min-h-16 font-mono text-xs" value={node.bodyJson ?? "{}"} onChange={(event) => updateNode({ bodyJson: event.target.value })} /></WorkflowField>
      {bodyIssue ? <p className="text-[11px] text-destructive">{bodyIssue}</p> : null}
    </WorkflowPanelSection>
  )
}

export function WorkflowScriptEditorSection({
  node,
  updateNode,
}: {
  node: WorkflowNodeData
  updateNode: (patch: Partial<WorkflowNodeData>) => void
}) {
  return (
    <WorkflowPanelSection title="Script settings">
      <WorkflowNodeSelect label="Runtime" value={node.runtime ?? "node"} onChange={(event) => updateNode({ runtime: event.target.value })}>
        <NativeSelectOption value="node">Node</NativeSelectOption>
        <NativeSelectOption value="python">Python</NativeSelectOption>
        <NativeSelectOption value="powershell">PowerShell</NativeSelectOption>
      </WorkflowNodeSelect>
      <WorkflowField label="Timeout (seconds)">
        <Input type="number" min={1} max={600} value={String(node.timeoutSeconds ?? 60)} onChange={(event) => updateNode({ timeoutSeconds: Math.max(1, Math.min(600, Number(event.target.value) || 60)) })} />
      </WorkflowField>
      <WorkflowField label="Script" hint="The script runs with the workflow input available to the runtime.">
        <Textarea className="min-h-40 font-mono text-xs" value={node.script ?? ""} onChange={(event) => updateNode({ script: event.target.value })} />
      </WorkflowField>
    </WorkflowPanelSection>
  )
}