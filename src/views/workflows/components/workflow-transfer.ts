import type { WorkflowDefinition, WorkflowNodeData } from "@/data/domain/models"
import { downloadJson } from "@/lib/browser-files"

export function exportWorkflowJson(payload: { title: string; summary: string; definition: WorkflowDefinition; versionLabel?: string }) {
  const fileName = `${payload.title || "workflow"}`.replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase() || "workflow"
  downloadJson(`${fileName}.json`, {
    title: payload.title,
    summary: payload.summary,
    versionLabel: payload.versionLabel,
    definition: payload.definition,
  })
}

export function parseWorkflowJson(value: string) {
  const parsed = JSON.parse(value) as {
    title?: string
    summary?: string
    definition?: WorkflowDefinition
  }

  if (!parsed.definition) {
    throw new Error("Workflow JSON must include a definition object.")
  }
  if (!Array.isArray(parsed.definition.nodes) || !Array.isArray(parsed.definition.edges)) {
    throw new Error("Workflow definition must include node and edge arrays.")
  }
  if (parsed.definition.nodes.length > 200 || parsed.definition.edges.length > 400) {
    throw new Error("Workflow imports support up to 200 nodes and 400 edges.")
  }

  const supportedKinds = new Set<WorkflowNodeData["kind"]>([
    "start", "end", "document-retrieval", "agent", "if-else", "http", "script",
    "variable-assigner", "template", "ai-response", "loop", "toolset", "webhook", "smtp",
    "condition", "fork", "join", "parallel", "serial", "wiki-retrieval",
  ])
  const nodeIds = new Set<string>()
  for (const node of parsed.definition.nodes) {
    if (!node?.id || !node?.data?.kind || !supportedKinds.has(node.data.kind) || nodeIds.has(node.id)) {
      throw new Error("Workflow import contains an invalid, unsupported, or duplicate node.")
    }
    nodeIds.add(node.id)
  }
  if (parsed.definition.edges.some((edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target))) {
    throw new Error("Workflow import contains an edge that references an unknown node.")
  }

  return {
    title: parsed.title ?? "Imported workflow",
    summary: parsed.summary ?? "",
    definition: parsed.definition,
  }
}