import { Textarea } from "@/components/ui/textarea"
import type { WorkflowNodeData } from "@/types/workflow"
import { WorkflowField, WorkflowPanelSection } from "@/pages/workflows/components/workflow-field"

export function NodeSerialForm({
  node,
  updateNode,
}: {
  node: WorkflowNodeData
  updateNode: (patch: Partial<WorkflowNodeData>) => void
}) {
  return (
    <WorkflowPanelSection title="Serial execution">
      <WorkflowField label="Operator notes">
        <Textarea value={node.notes ?? ""} onChange={(event) => updateNode({ notes: event.target.value })} />
      </WorkflowField>
    </WorkflowPanelSection>
  )
}
