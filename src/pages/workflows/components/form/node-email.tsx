import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowExpressionSuggestion } from "@/lib/workflow/expression-suggestions"
import { WorkflowExpressionInput } from "@/pages/workflows/components/workflow-expression-input"
import { WorkflowField, WorkflowPanelSection } from "@/pages/workflows/components/workflow-field"

export function NodeEmailForm({
  node,
  updateNode,
  suggestions,
}: {
  node: WorkflowNodeData
  updateNode: (patch: Partial<WorkflowNodeData>) => void
  suggestions: WorkflowExpressionSuggestion[]
}) {
  return (
    <WorkflowPanelSection title="Send email">
      <WorkflowField label="Recipient">
        <WorkflowExpressionInput
          value={node.emailTo ?? ""}
          onChange={(emailTo) => updateNode({ emailTo })}
          suggestions={suggestions}
        />
      </WorkflowField>
      <WorkflowField label="Subject">
        <WorkflowExpressionInput
          value={node.emailSubject ?? ""}
          onChange={(emailSubject) => updateNode({ emailSubject })}
          suggestions={suggestions}
        />
      </WorkflowField>
      <WorkflowField label="Message">
        <WorkflowExpressionInput
          multiline
          rows={5}
          value={node.emailBody ?? ""}
          onChange={(emailBody) => updateNode({ emailBody })}
          suggestions={suggestions}
        />
      </WorkflowField>
    </WorkflowPanelSection>
  )
}
