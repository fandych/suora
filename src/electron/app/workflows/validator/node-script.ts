import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { createIssue, requireValue } from "@/lib/workflow/validator/node/types"

const ALLOWED_WORKFLOW_SCRIPT_RUNTIMES = new Set(["node", "javascript"])
const MAX_WORKFLOW_SCRIPT_BYTES = 256 * 1024

export function validateScriptNode(node: Node<WorkflowNodeData>): WorkflowValidationIssue[] {
  const issues = [...requireValue(node, node.data.script, "Script node needs a script body.")]
  if (typeof node.data.script === "string" && Buffer.byteLength(node.data.script, "utf8") > MAX_WORKFLOW_SCRIPT_BYTES) {
    issues.push(createIssue(node, "Script body exceeds the 256 KB safety limit."))
  }
  if (
    !Number.isFinite(node.data.timeoutSeconds) ||
    (node.data.timeoutSeconds ?? 0) < 1 ||
    (node.data.timeoutSeconds ?? 0) > 60
  )
    issues.push(createIssue(node, "Script timeout must be between 1 and 60 seconds."))
  if (!node.data.runtime?.trim()) {
    issues.push(createIssue(node, "Script node needs a runtime."))
  } else if (!ALLOWED_WORKFLOW_SCRIPT_RUNTIMES.has(node.data.runtime.trim().toLowerCase())) {
    issues.push(createIssue(node, "Script runtime must be node or javascript."))
  }
  return issues
}
