import { NativeSelectOption } from "@/components/ui/native-select"
import type { WorkflowNodeData } from "@/types/workflow"
import { WorkflowNodeSelect } from "@/pages/workflows/components/workflow-node-select"

export function NodeJoinForm({
  node,
  updateNode,
}: {
  node: WorkflowNodeData
  updateNode: (patch: Partial<WorkflowNodeData>) => void
}) {
  return (
    <WorkflowNodeSelect
      label="Join strategy"
      value={node.joinStrategy ?? "wait-all"}
      onChange={(event) => updateNode({ joinStrategy: event.target.value as WorkflowNodeData["joinStrategy"] })}
    >
      <NativeSelectOption value="wait-all">Wait all</NativeSelectOption>
      <NativeSelectOption value="wait-any">Wait any</NativeSelectOption>
    </WorkflowNodeSelect>
  )
}
