import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"

export const executeJoinNode: WorkflowNodeExecutor = async (node, context) => ({
  strategy: node.data.joinStrategy ?? "wait-all",
  current: context.current ?? null,
  steps: Object.keys(context.steps),
})