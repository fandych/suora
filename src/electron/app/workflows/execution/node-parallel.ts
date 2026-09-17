import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"

export const executeParallelNode: WorkflowNodeExecutor = async (node, context) => ({
  concurrency: Math.max(2, Math.min(20, node.data.concurrency ?? 2)),
  mergeStrategy: node.data.mergeStrategy ?? "all-settled",
  current: context.current ?? null,
})