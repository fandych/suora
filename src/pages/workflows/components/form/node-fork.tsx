import { Input } from "@/components/ui/input"
import type { WorkflowNodeData } from "@/types/workflow"
import { WorkflowField } from "@/pages/workflows/components/workflow-field"

export function NodeForkForm({
  node,
  updateNode,
}: {
  node: WorkflowNodeData
  updateNode: (patch: Partial<WorkflowNodeData>) => void
}) {
  return (
    <WorkflowField label="Number of branches">
      <Input
        type="number"
        min={2}
        max={20}
        value={String(node.branchCount ?? 2)}
        onChange={(event) => updateNode({ branchCount: Math.max(2, Math.min(20, Number(event.target.value) || 2)) })}
      />
    </WorkflowField>
  )
}
