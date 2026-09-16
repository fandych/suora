import { Input } from "@/components/ui/input"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowExpressionSuggestion } from "@/lib/workflow/expression-suggestions"
import { WorkflowExpressionInput } from "@/pages/workflows/components/workflow-expression-input"
import { WorkflowField, WorkflowPanelSection } from "@/pages/workflows/components/workflow-field"

export function NodeLoopForm({
  node,
  updateNode,
  suggestions,
}: {
  node: WorkflowNodeData
  updateNode: (patch: Partial<WorkflowNodeData>) => void
  suggestions: WorkflowExpressionSuggestion[]
}) {
  return (
    <WorkflowPanelSection title="Loop controls">
      <WorkflowField label="Collection expression">
        <WorkflowExpressionInput
          value={node.loopExpression ?? ""}
          onChange={(loopExpression) => updateNode({ loopExpression })}
          suggestions={suggestions}
          placeholder="${input.items}"
        />
      </WorkflowField>
      <WorkflowField label="Item variable">
        <Input value={node.itemAlias ?? "item"} onChange={(event) => updateNode({ itemAlias: event.target.value })} />
      </WorkflowField>
      <WorkflowField label="Maximum iterations">
        <Input
          type="number"
          min={1}
          max={100}
          value={String(node.maxIterations ?? 25)}
          onChange={(event) =>
            updateNode({ maxIterations: Math.max(1, Math.min(100, Number(event.target.value) || 25)) })
          }
        />
      </WorkflowField>
    </WorkflowPanelSection>
  )
}
