import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { createIssue } from "@/lib/workflow/validator/node/types"

export function validateFallbackNode(node: Node<WorkflowNodeData>): WorkflowValidationIssue[] {
  return node.data.kind === "fork" ||
    node.data.kind === "join" ||
    node.data.kind === "parallel" ||
    node.data.kind === "serial" ||
    node.data.kind === "toolset" ||
    node.data.kind === "webhook" ||
    node.data.kind === "wiki-retrieval"
    ? []
    : [createIssue(node, `Node type '${node.data.kind}' is not supported by the property validator.`)]
}
