import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"

export const executeStartNode: WorkflowNodeExecutor = async (_node, context) => context.input
