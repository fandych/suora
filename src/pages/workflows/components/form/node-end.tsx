import type { WorkflowNodeData } from "@/types/workflow"
import { Input } from "@/components/ui/input"
import type { WorkflowExpressionSuggestion } from "@/lib/workflow/expression-suggestions"
import { WorkflowExpressionInput } from "@/pages/workflows/components/workflow-expression-input"
import { WorkflowField, WorkflowPanelSection } from "@/pages/workflows/components/workflow-field"
import { WorkflowStartInputEditor } from "@/pages/workflows/components/workflow-start-input-editor"

export function NodeEndForm({
  node,
  updateNode,
  suggestions,
}: {
  node: WorkflowNodeData
  updateNode: (patch: Partial<WorkflowNodeData>) => void
  suggestions: WorkflowExpressionSuggestion[]
}) {
  return (
    <>
      <WorkflowStartInputEditor
        title="Output schema"
        variableSupport
        value={node.outputSchemaJson}
        onChange={(outputSchemaJson) => updateNode({ outputSchemaJson })}
        suggestions={suggestions}
      />
      <WorkflowPanelSection title="Result">
        <WorkflowField label="Result template">
          <WorkflowExpressionInput
            multiline
            rows={4}
            value={node.inputTemplate ?? ""}
            onChange={(inputTemplate) => updateNode({ inputTemplate })}
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
    </>
  )
}
