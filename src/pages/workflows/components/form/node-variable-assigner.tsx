import { Input } from "@/components/ui/input"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowExpressionSuggestion } from "@/lib/workflow/expression-suggestions"
import { WorkflowExpressionInput } from "@/pages/workflows/components/workflow-expression-input"
import { WorkflowField, WorkflowPanelSection } from "@/pages/workflows/components/workflow-field"

export function NodeVariableAssignerForm({
  node,
  updateNode,
  suggestions,
}: {
  node: WorkflowNodeData
  updateNode: (patch: Partial<WorkflowNodeData>) => void
  suggestions: WorkflowExpressionSuggestion[]
}) {
  return (
    <WorkflowPanelSection title="Set variable">
      <WorkflowField label="Variable name">
        <Input
          value={node.variableName ?? node.outputKey ?? ""}
          onChange={(event) => updateNode({ variableName: event.target.value, outputKey: event.target.value })}
        />
      </WorkflowField>
      <WorkflowField label="Value expression">
        <WorkflowExpressionInput
          value={node.variableValue ?? ""}
          onChange={(variableValue) => updateNode({ variableValue })}
          suggestions={suggestions}
        />
      </WorkflowField>
    </WorkflowPanelSection>
  )
}
