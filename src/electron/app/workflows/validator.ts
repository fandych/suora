import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { getWorkflowStructureIssues } from "@/lib/workflow/validator"
import type { NodePropertyValidationContext } from "@/lib/workflow/validator/node/types"
import { validateAgentNodeProperties } from "@/lib/workflow/validator/node/agent"
import { validateConditionNodeProperties } from "@/lib/workflow/validator/node/condition"
import { validateIfElseNodeProperties } from "@/lib/workflow/validator/node/if-else"
import { validateLoopNodeProperties } from "@/lib/workflow/validator/node/loop"
import { validateStartNode } from "@/electron/app/workflows/validator/node-start"
import { validateEndNode } from "@/electron/app/workflows/validator/node-end"
import { validateDocumentRetrievalNode } from "@/electron/app/workflows/validator/node-document-retrieval"
import { validateHttpNode } from "@/electron/app/workflows/validator/node-http"
import { validateScriptNode } from "@/electron/app/workflows/validator/node-script"
import { validateVariableAssignerNode } from "@/electron/app/workflows/validator/node-variable-assigner"
import { validateTemplateNode } from "@/electron/app/workflows/validator/node-template"
import { validateAiResponseNode } from "@/electron/app/workflows/validator/node-ai-response"
import { validateIntegrationNode } from "@/electron/app/workflows/validator/node-integration"
import { validateEmailNode } from "@/electron/app/workflows/validator/node-email"
import { validateFallbackNode } from "@/electron/app/workflows/validator/node-fallback"

export type WorkflowValidationContext = NodePropertyValidationContext & {
  nodes: Node<WorkflowNodeData>[]
  edges: unknown[]
}

export function validateWorkflowNodes(input: WorkflowValidationContext): WorkflowValidationIssue[] {
  const nodeIssues = input.nodes.flatMap((node) => {
    switch (node.data.kind) {
      case "start":
        return validateStartNode(node)
      case "end":
        return validateEndNode(node)
      case "condition":
        return validateConditionNodeProperties(node)
      case "if-else":
        return validateIfElseNodeProperties(node)
      case "document-retrieval":
        return validateDocumentRetrievalNode(node, input)
      case "agent":
        return validateAgentNodeProperties(node, input)
      case "variable-assigner":
        return validateVariableAssignerNode(node)
      case "template":
        return validateTemplateNode(node)
      case "ai-response":
        return validateAiResponseNode(node, input)
      case "http":
      case "toolset":
      case "webhook":
        return validateHttpNode(node, input)
      case "script":
        return validateScriptNode(node)
      case "smtp":
        return validateEmailNode(node)
      case "loop":
        return validateLoopNodeProperties(node)
      case "fork":
      case "join":
      case "parallel":
      case "serial":
      case "wiki-retrieval":
        return validateFallbackNode(node)
      default:
        return validateIntegrationNode(node, input)
    }
  })
  return [...getWorkflowStructureIssues(input.nodes, input.edges as never[]), ...nodeIssues]
}
