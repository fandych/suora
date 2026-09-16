import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"

export const executeUnsupportedNode: WorkflowNodeExecutor = async (node, _context, mode) => {
  if (mode === "dry-run") return { dryRun: true, skipped: true, kind: node.data.kind }
  throw new Error(`Workflow node type '${node.data.kind ?? "unknown"}' is not available in Electron runtime yet.`)
}
