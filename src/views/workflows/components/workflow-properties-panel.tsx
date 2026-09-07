import { useEffect, useState } from "react"
import type { Edge, Node } from "@xyflow/react"
import { SlidersHorizontalIcon, Trash2Icon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelectOption } from "@/components/ui/native-select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import type { DocumentSummary, IntegrationSummary, WorkflowNodeData } from "@/data/domain/models"
import { WorkflowField, WorkflowPanelSection } from "@/views/workflows/components/workflow-field"
import { WorkflowAgentEditorSection, WorkflowDocumentEditorSection, WorkflowHttpEditorSection, WorkflowScriptEditorSection } from "@/views/workflows/components/workflow-node-editor-sections"
import { WorkflowNodeSelect } from "@/views/workflows/components/workflow-node-select"
import { WorkflowParameterEditor } from "@/views/workflows/components/workflow-parameter-editor"
import { Textarea } from "@/components/ui/textarea"
import { WorkflowStartInputEditor } from "@/views/workflows/components/workflow-start-input-editor"
import { getWorkflowExpressionSuggestions } from "@/views/workflows/components/workflow-expression-suggestions"
import { WorkflowExpressionInput } from "@/views/workflows/components/workflow-expression-input"

type WorkflowPropertiesPanelProps = {
  agents: Array<{ id: string; title: string }>
  documents: DocumentSummary[]
  integrations: IntegrationSummary[]
  modelOptions: Array<{ id: string; label: string }>
  nodes: Node<WorkflowNodeData>[]
  edges: Edge[]
  onDeleteNode: () => void
  onRenameNodeId: (value: string) => string | null
  readOnly: boolean
  selectedNode: { id: string; data: WorkflowNodeData } | null
  updateNode: (patch: Partial<WorkflowNodeData>) => void
}

export function WorkflowPropertiesPanel({
  agents,
  documents,
  integrations,
  modelOptions,
  nodes,
  edges,
  onDeleteNode,
  onRenameNodeId,
  readOnly,
  selectedNode,
  updateNode,
}: WorkflowPropertiesPanelProps) {
  const node = selectedNode?.data ?? null
  const [draftNodeId, setDraftNodeId] = useState(selectedNode?.id ?? "")
  const [nodeIdError, setNodeIdError] = useState<string | null>(null)

  useEffect(() => {
    setDraftNodeId(selectedNode?.id ?? "")
    setNodeIdError(null)
  }, [selectedNode?.id])

  if (!selectedNode || !node) {
    return (
      <Card className="shadow-none ring-0">
        <CardHeader>
          <CardTitle>Node configuration</CardTitle>
          <CardDescription>Select a node from the graph to edit its behavior.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Choose any node on the canvas to open its properties.</CardContent>
      </Card>
    )
  }

  const branches = node.branches ?? [
    { id: "true", label: node.trueLabel ?? "True", expression: node.runIf ?? "" },
    { id: "false", label: node.falseLabel ?? "False", expression: "" },
  ]
  const valueSuggestions = getWorkflowExpressionSuggestions(nodes, edges, selectedNode.id)
  const outputSuggestions = getWorkflowExpressionSuggestions(nodes, edges, selectedNode.id, { includeCurrent: true })

  return (
    <div className="flex h-full min-h-0 min-w-0 max-w-full flex-col gap-2 overflow-hidden rounded-xl border bg-background/95 p-2 shadow-xl">
      <div className="flex items-center gap-2 border-b px-1 pb-2 text-xs font-semibold">
        <SlidersHorizontalIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
        Properties for {node.kind}
      </div>

      <ScrollArea className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="space-y-3 px-1 pb-5 pr-3">
          <fieldset disabled={readOnly} className="space-y-2">
            <div className="flex flex-col gap-2 border-b pb-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold text-muted-foreground">Basic</div>
                <Button size="icon-xs" variant="destructive" aria-label="Delete node" title="Delete node" onClick={onDeleteNode}>
                  <Trash2Icon />
                </Button>
              </div>
              <WorkflowField label="Node Id">
                <Input
                  value={draftNodeId}
                  onChange={(event) => setDraftNodeId(event.target.value)}
                  onBlur={() => setNodeIdError(onRenameNodeId(draftNodeId))}
                  aria-invalid={Boolean(nodeIdError)}
                  className="h-8 font-mono text-xs"
                />
                {nodeIdError ? <p className="text-xs text-destructive">{nodeIdError}</p> : null}
              </WorkflowField>

              <WorkflowField label="name">
                <Input value={node.label} onChange={(event) => updateNode({ label: event.target.value })} placeholder={node.kind} />
              </WorkflowField>

              <WorkflowField label="description">
                <Textarea rows={2} value={node.description ?? ""} onChange={(event) => updateNode({ description: event.target.value })} placeholder="Describe this node." />
              </WorkflowField>

              <div className="grid gap-3 sm:grid-cols-2">
                <WorkflowField label="Retry" hint="Number of retry attempts after a failed execution."><Input type="number" min={0} value={String(node.retryCount ?? 0)} onChange={(event) => updateNode({ retryCount: Number(event.target.value) || 0 })} /></WorkflowField>
                <WorkflowField label="Timeout" hint="Maximum execution time in milliseconds."><Input type="number" min={100} value={String(node.timeoutMs ?? 30000)} onChange={(event) => updateNode({ timeoutMs: Number(event.target.value) || 30000 })} /></WorkflowField>
              </div>
              <div className="flex items-center justify-between gap-2">
                <WorkflowField label="Continue On Error" hint="Continue with the next node when this node fails."><span /></WorkflowField>
                <Switch checked={node.continueOnError ?? false} onCheckedChange={(checked) => updateNode({ continueOnError: checked })} />
              </div>
            </div>

            {node.kind === "agent" ? <WorkflowAgentEditorSection node={node} agents={agents} modelOptions={modelOptions} updateNode={updateNode} suggestions={valueSuggestions} /> : null}

            {node.kind === "start" ? (
              <WorkflowStartInputEditor title="Input" value={node.inputSchemaJson} onChange={(value) => updateNode({ inputSchemaJson: value })} />
            ) : null}

            <WorkflowStartInputEditor title="Output" variableSupport value={node.outputSchemaJson} onChange={(value) => updateNode({ outputSchemaJson: value })} suggestions={outputSuggestions} />
            {node.kind === "end" ? <WorkflowField label="Result template" hint="Type ${ to select workflow input, upstream steps, or variables."><WorkflowExpressionInput multiline rows={3} className="font-mono text-xs" value={node.inputTemplate ?? ""} onChange={(inputTemplate) => updateNode({ inputTemplate })} suggestions={valueSuggestions} /></WorkflowField> : null}

            {node.kind === "ai-response" ? (
              <WorkflowPanelSection title="AI response settings">
                <WorkflowNodeSelect label="Chat model" value={node.modelId ?? ""} onChange={(event) => updateNode({ modelId: event.target.value })}>
                  <NativeSelectOption value="">Use default model</NativeSelectOption>
                  {modelOptions.map((model) => <NativeSelectOption key={model.id} value={model.id}>{model.label}</NativeSelectOption>)}
                </WorkflowNodeSelect>
                <WorkflowField label="System instructions"><WorkflowExpressionInput multiline rows={3} value={node.systemPrompt ?? ""} onChange={(systemPrompt) => updateNode({ systemPrompt })} suggestions={valueSuggestions} placeholder="Optional response rules" /></WorkflowField>
                <div className="grid gap-3 sm:grid-cols-2"><WorkflowField label="Temperature"><Input type="number" min={0} max={2} step={0.1} value={String(node.temperature ?? 0.7)} onChange={(event) => updateNode({ temperature: Math.max(0, Math.min(2, Number(event.target.value) || 0)) })} /></WorkflowField><WorkflowField label="Maximum tokens"><Input type="number" min={1} max={32768} value={String(node.maxTokens ?? 1024)} onChange={(event) => updateNode({ maxTokens: Math.max(1, Number(event.target.value) || 1) })} /></WorkflowField></div>
                <WorkflowNodeSelect label="Response format" value={node.responseFormat ?? "text"} onChange={(event) => updateNode({ responseFormat: event.target.value as "text" | "json" })}><NativeSelectOption value="text">Text</NativeSelectOption><NativeSelectOption value="json">JSON</NativeSelectOption></WorkflowNodeSelect>
                <WorkflowField label="Prompt"><WorkflowExpressionInput multiline rows={6} className="min-h-28" value={node.prompt ?? ""} onChange={(prompt) => updateNode({ prompt })} suggestions={valueSuggestions} placeholder="Prompt template" /></WorkflowField>
              </WorkflowPanelSection>
            ) : null}

            {node.kind === "document-retrieval" ? <WorkflowDocumentEditorSection node={node} documents={documents} updateNode={updateNode} suggestions={valueSuggestions} /> : null}

            {["http", "toolset", "webhook"].includes(node.kind) ? <WorkflowHttpEditorSection node={node} integrations={integrations} updateNode={updateNode} suggestions={valueSuggestions} /> : null}

            {node.kind === "script" ? <WorkflowScriptEditorSection node={node} updateNode={updateNode} /> : null}

            {node.kind === "variable-assigner" ? (
              <WorkflowPanelSection title="Variable assignment">
                <WorkflowField label="Variable name"><Input value={node.variableName ?? node.outputKey ?? ""} onChange={(event) => updateNode({ variableName: event.target.value, outputKey: event.target.value })} placeholder="customerTier" /></WorkflowField>
                <WorkflowField label="Value expression"><WorkflowExpressionInput value={node.variableValue ?? ""} onChange={(variableValue) => updateNode({ variableValue })} suggestions={valueSuggestions} placeholder="${input.customer.tier}" /></WorkflowField>
              </WorkflowPanelSection>
            ) : null}

            {node.kind === "template" ? (
              <WorkflowPanelSection title="Template">
                <WorkflowNodeSelect label="Output format" value={node.templateOutputFormat ?? "text"} onChange={(event) => updateNode({ templateOutputFormat: event.target.value as "text" | "json" })}>
                  <NativeSelectOption value="text">Text</NativeSelectOption>
                  <NativeSelectOption value="json">JSON</NativeSelectOption>
                </WorkflowNodeSelect>
                <WorkflowField label="Template body" hint="Type ${ to select a value."><WorkflowExpressionInput multiline rows={6} className="min-h-28 font-mono text-xs" value={node.template ?? ""} onChange={(template) => updateNode({ template })} suggestions={valueSuggestions} /></WorkflowField>
              </WorkflowPanelSection>
            ) : null}

            {node.kind === "smtp" ? (
              <WorkflowPanelSection title="Email delivery">
                <WorkflowField label="Recipient"><WorkflowExpressionInput value={node.emailTo ?? ""} onChange={(emailTo) => updateNode({ emailTo })} suggestions={valueSuggestions} placeholder="team@example.com" /></WorkflowField>
                <WorkflowField label="Subject"><WorkflowExpressionInput value={node.emailSubject ?? ""} onChange={(emailSubject) => updateNode({ emailSubject })} suggestions={valueSuggestions} /></WorkflowField>
                <WorkflowField label="Message"><WorkflowExpressionInput multiline rows={5} className="min-h-24" value={node.emailBody ?? ""} onChange={(emailBody) => updateNode({ emailBody })} suggestions={valueSuggestions} /></WorkflowField>
              </WorkflowPanelSection>
            ) : null}

            {["condition", "loop"].includes(node.kind) ? (
              <WorkflowPanelSection title={node.kind === "loop" ? "Loop controls" : "Condition"}>
                <WorkflowField label={node.kind === "loop" ? "Collection expression" : "Expression"}><WorkflowExpressionInput value={node.kind === "loop" ? node.loopExpression ?? "" : node.runIf ?? ""} onChange={(expression) => updateNode(node.kind === "loop" ? { loopExpression: expression } : { runIf: expression })} suggestions={valueSuggestions} placeholder={node.kind === "loop" ? "${input.items}" : "${input.approved} === true"} /></WorkflowField>
                {node.kind === "loop" ? <><WorkflowField label="Item variable"><Input value={node.itemAlias ?? "item"} onChange={(event) => updateNode({ itemAlias: event.target.value })} placeholder="item" /></WorkflowField><WorkflowField label="Maximum iterations"><Input type="number" min={1} max={100} value={String(node.maxIterations ?? 25)} onChange={(event) => updateNode({ maxIterations: Math.max(1, Math.min(100, Number(event.target.value) || 25)) })} /></WorkflowField></> : null}
              </WorkflowPanelSection>
            ) : null}

            {node.kind === "parallel" ? <WorkflowPanelSection title="Parallel execution"><WorkflowField label="Concurrency"><Input type="number" min={2} max={20} value={String(node.concurrency ?? 2)} onChange={(event) => updateNode({ concurrency: Math.max(2, Math.min(20, Number(event.target.value) || 2)) })} /></WorkflowField><WorkflowNodeSelect label="Merge strategy" value={node.mergeStrategy ?? "all-settled"} onChange={(event) => updateNode({ mergeStrategy: event.target.value as "all-settled" | "fail-fast" })}><NativeSelectOption value="all-settled">All settled</NativeSelectOption><NativeSelectOption value="fail-fast">Fail fast</NativeSelectOption></WorkflowNodeSelect></WorkflowPanelSection> : null}

            {node.kind === "serial" ? <WorkflowPanelSection title="Serial execution"><WorkflowField label="Operator notes"><Textarea value={node.notes ?? ""} onChange={(event) => updateNode({ notes: event.target.value })} placeholder="Optional runbook notes" /></WorkflowField></WorkflowPanelSection> : null}

            {node.kind === "fork" ? (
              <WorkflowField label="Number of branches">
                <Input type="number" min={2} max={20} value={String(node.branchCount ?? 2)} onChange={(event) => updateNode({ branchCount: Math.max(2, Number(event.target.value) || 2) })} />
              </WorkflowField>
            ) : null}

            {node.kind === "join" ? (
              <WorkflowNodeSelect label="Join strategy" value={node.joinStrategy ?? "wait-all"} onChange={(event) => updateNode({ joinStrategy: event.target.value as WorkflowNodeData["joinStrategy"] })}>
                  <NativeSelectOption value="wait-all">Wait all</NativeSelectOption>
                  <NativeSelectOption value="wait-any">Wait any</NativeSelectOption>
              </WorkflowNodeSelect>
            ) : null}

            {node.kind === "if-else" ? (
              <WorkflowPanelSection title="Branch rules">
                <WorkflowParameterEditor
                  items={branches.map((branch, index) => ({
                    id: branch.id,
                    name: branch.label,
                    value: index === branches.length - 1 ? "Always selected when no condition matches" : branch.expression,
                    namePlaceholder: index === 0 ? "If" : index === branches.length - 1 ? "Else" : `Else if ${index}`,
                    valuePlaceholder: "$input.amount > 1000",
                    valueDisabled: index === branches.length - 1,
                  }))}
                  nameLabel="Branch name"
                  valueLabel="Condition expression"
                  onNameChange={(itemId, value) => updateNode({
                    branches: branches.map((item) => item.id === itemId ? { ...item, label: value } : item),
                    trueLabel: branches[0]?.id === itemId ? value : node.trueLabel,
                    falseLabel: branches.at(-1)?.id === itemId ? value : node.falseLabel,
                  })}
                  onValueChange={(itemId, value) => updateNode({
                    runIf: branches[0]?.id === itemId ? value : node.runIf,
                    branches: branches.map((item) => item.id === itemId ? { ...item, expression: value } : item),
                  })}
                  onAdd={() => updateNode({
                    branches: [...branches.slice(0, -1), { id: `branch-${branches.length}`, label: `Else if ${branches.length - 1}`, expression: "" }, branches.at(-1)!],
                  })}
                  addLabel="Add elseif branch"
                  suggestions={valueSuggestions}
                />
              </WorkflowPanelSection>
            ) : null}

          </fieldset>
        </div>
      </ScrollArea>
    </div>
  )
}