import type { WorkflowNodeData } from "@/types/workflow"
import { Input } from "@/components/ui/input"
import { WorkflowField, WorkflowPanelSection } from "@/pages/workflows/components/workflow-field"
import { WorkflowExpressionInput } from "@/pages/workflows/components/workflow-expression-input"
import type { WorkflowExpressionSuggestion } from "@/lib/workflow/expression-suggestions"

export function NodeDefaultForm({
  node,
  updateNode,
  suggestions,
}: {
  node: WorkflowNodeData
  updateNode: (patch: Partial<WorkflowNodeData>) => void
  suggestions: WorkflowExpressionSuggestion[]
}) {
  return (
    <WorkflowPanelSection title="Node settings">
      <WorkflowField label="Task">
        <WorkflowExpressionInput
          multiline
          rows={4}
          value={node.task ?? ""}
          onChange={(task) => updateNode({ task })}
          suggestions={suggestions}
        />
      </WorkflowField>
      <WorkflowField label="Output key">
        <Input
          className="h-8 w-full rounded-md border bg-background px-2 text-xs"
          value={node.outputKey ?? ""}
          onChange={(event) => updateNode({ outputKey: event.target.value })}
        />
      </WorkflowField>
    </WorkflowPanelSection>
  )
}
