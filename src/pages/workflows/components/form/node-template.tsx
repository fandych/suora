import { NativeSelectOption } from "@/components/ui/native-select"
import type { ChangeEvent } from "react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowExpressionSuggestion } from "@/lib/workflow/expression-suggestions"
import { WorkflowExpressionInput } from "@/pages/workflows/components/workflow-expression-input"
import { WorkflowField, WorkflowPanelSection } from "@/pages/workflows/components/workflow-field"
import { WorkflowNodeSelect } from "@/pages/workflows/components/workflow-node-select"

export function NodeTemplateForm({
  node,
  updateNode,
  suggestions,
}: {
  node: WorkflowNodeData
  updateNode: (patch: Partial<WorkflowNodeData>) => void
  suggestions: WorkflowExpressionSuggestion[]
}) {
  return (
    <WorkflowPanelSection title="Template">
      <WorkflowNodeSelect
        label="Output format"
        value={node.templateOutputFormat ?? "text"}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          updateNode({ templateOutputFormat: event.target.value as "text" | "json" })
        }
      >
        <NativeSelectOption value="text">Text</NativeSelectOption>
        <NativeSelectOption value="json">JSON</NativeSelectOption>
      </WorkflowNodeSelect>
      <WorkflowField label="Template body">
        <WorkflowExpressionInput
          multiline
          rows={6}
          className="font-mono text-xs"
          value={node.template ?? ""}
          onChange={(template) => updateNode({ template })}
          suggestions={suggestions}
        />
      </WorkflowField>
    </WorkflowPanelSection>
  )
}
