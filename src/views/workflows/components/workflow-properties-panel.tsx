import { useEffect, useState } from "react"
import { SlidersHorizontalIcon } from "lucide-react"

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

type WorkflowPropertiesPanelProps = {
  agents: Array<{ id: string; title: string }>
  documents: DocumentSummary[]
  integrations: IntegrationSummary[]
  modelOptions: Array<{ id: string; label: string }>
  onDeleteNode: () => void
  onDuplicateNode: () => void
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
  onDeleteNode,
  onDuplicateNode,
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 rounded-xl border bg-background/95 p-2 shadow-xl">
      <div className="flex items-center gap-2 border-b px-1 pb-2 text-xs font-semibold">
        <SlidersHorizontalIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
        Properties for {node.kind}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 px-1 pb-5">
          <fieldset disabled={readOnly} className="space-y-3">
            <WorkflowPanelSection title="Identity">
              <WorkflowField label="Node ID">
                <Input
                  value={draftNodeId}
                  onChange={(event) => setDraftNodeId(event.target.value)}
                  onBlur={() => setNodeIdError(onRenameNodeId(draftNodeId))}
                  aria-invalid={Boolean(nodeIdError)}
                  className="h-8 font-mono text-xs"
                />
                {nodeIdError ? <p className="text-xs text-destructive">{nodeIdError}</p> : null}
              </WorkflowField>

              <WorkflowField label="Title">
                <Input value={node.label} onChange={(event) => updateNode({ label: event.target.value })} placeholder={node.kind} />
              </WorkflowField>

              <WorkflowField label="Description">
                <Textarea value={node.description ?? ""} onChange={(event) => updateNode({ description: event.target.value })} placeholder="Describe what this node is responsible for." />
              </WorkflowField>

              <WorkflowField label="Task summary" hint="Operator-facing summary of this step.">
                <Input value={node.task ?? ""} onChange={(event) => updateNode({ task: event.target.value })} placeholder="Task summary" />
              </WorkflowField>
            </WorkflowPanelSection>

            {node.kind === "agent" ? <WorkflowAgentEditorSection node={node} agents={agents} modelOptions={modelOptions} updateNode={updateNode} /> : null}

            {node.kind === "document-retrieval" ? <WorkflowDocumentEditorSection node={node} documents={documents} updateNode={updateNode} /> : null}

            {node.kind === "http" ? <WorkflowHttpEditorSection node={node} integrations={integrations} updateNode={updateNode} /> : null}

            {node.kind === "script" ? <WorkflowScriptEditorSection node={node} updateNode={updateNode} /> : null}

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
                />
              </WorkflowPanelSection>
            ) : null}

            <WorkflowPanelSection title="Execution">
              <WorkflowField label="Output variable">
                <Input value={node.outputKey ?? ""} onChange={(event) => updateNode({ outputKey: event.target.value })} placeholder="result" />
              </WorkflowField>

              <div className="grid gap-3 sm:grid-cols-2">
                <WorkflowField label="Retries">
                  <Input type="number" min={0} value={String(node.retryCount ?? 0)} onChange={(event) => updateNode({ retryCount: Number(event.target.value) || 0 })} />
                </WorkflowField>
                <WorkflowField label="Timeout (ms)">
                  <Input type="number" min={100} value={String(node.timeoutMs ?? 30000)} onChange={(event) => updateNode({ timeoutMs: Number(event.target.value) || 30000 })} />
                </WorkflowField>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm">
                Enabled
                <Switch checked={node.enabled ?? true} onCheckedChange={(checked) => updateNode({ enabled: checked })} />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm">
                Continue on error
                <Switch checked={node.continueOnError ?? false} onCheckedChange={(checked) => updateNode({ continueOnError: checked })} />
              </label>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={onDuplicateNode}>Duplicate</Button>
                <Button size="sm" variant="outline" onClick={onDeleteNode}>Delete</Button>
              </div>
            </WorkflowPanelSection>
          </fieldset>
        </div>
      </ScrollArea>
    </div>
  )
}