import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"

export const executeForkNode: WorkflowNodeExecutor = async (node) => ({
  branchCount: Math.max(2, Math.min(20, node.data.branchCount ?? 2)),
  branchHandles: Array.from({ length: Math.max(2, Math.min(20, node.data.branchCount ?? 2)) }, (_value, index) =>
    index === 0 ? "source-bottom" : `branch-${index + 1}`,
  ),
})