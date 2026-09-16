import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowExpressionSuggestion } from "@/lib/workflow/expression-suggestions"
import { WorkflowExpressionInput } from "@/pages/workflows/components/workflow-expression-input"
import { WorkflowField, WorkflowPanelSection } from "@/pages/workflows/components/workflow-field"

export function NodeConditionForm({
  node,
  updateNode,
  suggestions,
}: {
  node: WorkflowNodeData
  updateNode: (patch: Partial<WorkflowNodeData>) => void
  suggestions: WorkflowExpressionSuggestion[]
}) {
  return (
    <WorkflowPanelSection title="Condition">
      <WorkflowField label="Expression">
        <WorkflowExpressionInput
          value={node.runIf ?? ""}
          onChange={(runIf) => updateNode({ runIf })}
          suggestions={suggestions}
          placeholder="${input.approved} === true"
        />
      </WorkflowField>
    </WorkflowPanelSection>
  )
}
