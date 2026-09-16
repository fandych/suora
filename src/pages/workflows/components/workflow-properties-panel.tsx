import { useEffect, useState } from "react"
import type { Edge, Node } from "@xyflow/react"
import { SlidersHorizontalIcon, Trash2Icon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { DocumentSummary } from "@/types/document"
import type { IntegrationSummary } from "@/types/integration"
import type { WorkflowNodeData } from "@/types/workflow"
import type { ResourceSelectorOption } from "@/types/resource-selector"
import { WorkflowField } from "@/pages/workflows/components/workflow-field"
import { NodeForm } from "@/pages/workflows/components/form/node-form"
import { getWorkflowExpressionSuggestions } from "@/lib/workflow/expression-suggestions"

type WorkflowPropertiesPanelProps = {
  agents: ResourceSelectorOption[]
  documents: DocumentSummary[]
  integrations: IntegrationSummary[]
  modelOptions: ResourceSelectorOption[]
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
        <CardContent className="text-sm text-muted-foreground">
          Choose any node on the canvas to open its properties.
        </CardContent>
      </Card>
    )
  }

  const valueSuggestions = getWorkflowExpressionSuggestions(nodes, edges, selectedNode.id)

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
                <Button
                  size="icon-xs"
                  variant="destructive"
                  aria-label="Delete node"
                  title="Delete node"
                  onClick={onDeleteNode}
                >
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
                <Input
                  value={node.label}
                  onChange={(event) => updateNode({ label: event.target.value })}
                  placeholder={node.kind}
                />
              </WorkflowField>

              <WorkflowField label="description">
                <Textarea
                  rows={2}
                  value={node.description ?? ""}
                  onChange={(event) => updateNode({ description: event.target.value })}
                  placeholder="Describe this node."
                />
              </WorkflowField>

              <div className="grid gap-3 sm:grid-cols-2">
                <WorkflowField label="Retry" hint="Number of retry attempts after a failed execution.">
                  <Input
                    type="number"
                    min={0}
                    value={String(node.retryCount ?? 0)}
                    onChange={(event) => updateNode({ retryCount: Number(event.target.value) || 0 })}
                  />
                </WorkflowField>
                <WorkflowField label="Timeout" hint="Maximum execution time in milliseconds.">
                  <Input
                    type="number"
                    min={100}
                    value={String(node.timeoutMs ?? 30000)}
                    onChange={(event) => updateNode({ timeoutMs: Number(event.target.value) || 30000 })}
                  />
                </WorkflowField>
              </div>
              <div className="flex items-center justify-between gap-2">
                <WorkflowField label="Continue On Error" hint="Continue with the next node when this node fails.">
                  <span />
                </WorkflowField>
                <Switch
                  checked={node.continueOnError ?? false}
                  onCheckedChange={(checked) => updateNode({ continueOnError: checked })}
                />
              </div>
            </div>

            <NodeForm
              node={node}
              agents={agents}
              documents={documents}
              integrations={integrations}
              modelOptions={modelOptions}
              updateNode={updateNode}
              suggestions={valueSuggestions}
            />
          </fieldset>
        </div>
      </ScrollArea>
    </div>
  )
}
