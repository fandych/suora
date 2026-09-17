import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"

export const executeSerialNode: WorkflowNodeExecutor = async (node, context) => ({
  notes: node.data.notes ?? "",
  current: context.current ?? null,
  steps: Object.keys(context.steps),
})