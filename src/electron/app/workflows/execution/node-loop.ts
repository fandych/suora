import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"

export const executeLoopNode: WorkflowNodeExecutor = async (node, context) => {
  const collection = context.input
  const items = Array.isArray(collection) ? collection.slice(0, node.data.maxIterations ?? 25) : []
  return { items, results: items, iterations: items.length, maxIterations: node.data.maxIterations ?? 25 }
}
