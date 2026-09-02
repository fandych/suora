import type { Edge, Node } from "@xyflow/react"

import type { WorkflowNodeData } from "@/data/domain/models"

export const DEFAULT_WORKFLOW_DRY_RUN_INPUT = "{\n  \"leadId\": \"LD-1001\"\n}"

export type WorkflowDesignIssue = {
  nodeId: string
  label: string
  message: string
  severity: "warning" | "error"
}

export function buildWorkflowFingerprint(input: {
  title: string
  summary: string
  nodes: Node<WorkflowNodeData>[]
  edges: Edge[]
  resourceBindings: {
    providerId: string
    skillId: string
    documentId: string
    integrationId: string
  }
  dryRunInput: string
}) {
  return JSON.stringify(input)
}

export function getWorkflowDesignIssues(nodes: Node<WorkflowNodeData>[]) {
  return nodes.flatMap((node) => {
    const issues: WorkflowDesignIssue[] = []

    if (!node.data.label.trim()) {
      issues.push({ nodeId: node.id, label: node.id, message: "Node label is empty.", severity: "error" })
    }
    if (node.data.enabled !== false && node.data.kind === "agent" && !node.data.prompt.trim()) {
      issues.push({ nodeId: node.id, label: node.data.label, message: "Agent node is missing a prompt.", severity: "error" })
    }
    if (node.data.enabled !== false && node.data.kind === "http" && !node.data.integrationId?.trim() && !node.data.url?.trim()) {
      issues.push({ nodeId: node.id, label: node.data.label, message: "HTTP node needs a bound integration or URL.", severity: "error" })
    }
    if (node.data.enabled !== false && node.data.kind === "document-retrieval" && !node.data.documentId?.trim()) {
      issues.push({ nodeId: node.id, label: node.data.label, message: "Document retrieval node has no source document.", severity: "warning" })
    }
    if (node.data.enabled !== false && node.data.kind === "script" && !node.data.script?.trim()) {
      issues.push({ nodeId: node.id, label: node.data.label, message: "Script node has no script body.", severity: "error" })
    }

    return issues
  })
}