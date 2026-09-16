import type { WorkflowNodeData } from "@/types/workflow"
import { WorkflowStartInputEditor } from "@/pages/workflows/components/workflow-start-input-editor"

export function NodeStartForm({
  node,
  updateNode,
}: {
  node: WorkflowNodeData
  updateNode: (patch: Partial<WorkflowNodeData>) => void
}) {
  return (
    <WorkflowStartInputEditor
      title="Input schema"
      value={node.inputSchemaJson}
      onChange={(inputSchemaJson) => updateNode({ inputSchemaJson })}
    />
  )
}
