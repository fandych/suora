export function createDefaultWorkflowDefinition() {
  return {
    nodes: [{
      id: "start",
      type: "workflowNode",
      position: { x: 60, y: 140 },
      data: {
        label: "Start",
        prompt: "Capture input variables.",
        kind: "start",
        task: "Normalize incoming input.",
        enabled: true,
        continueOnError: true,
        retryCount: 0,
        timeoutMs: 15000,
        outputKey: "request",
      },
    }],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    resourceBindings: {
      providerId: "provider-openai",
      skillId: "skill-plan",
      documentId: "document-product-manual",
      integrationId: "integration-webhook",
    },
    dryRunInputJson: "{\n  \"leadId\": \"LD-1001\"\n}",
    variables: [],
    budget: { maxSteps: 8, maxDurationMs: 120000 },
  }
}

const WORKFLOW_NODE_KINDS = new Set([
  "start", "end", "document-retrieval", "agent", "fork", "join", "if-else", "http", "script",
  "variable-assigner", "template", "ai-response", "loop", "parallel", "serial", "toolset", "webhook", "wiki-retrieval", "smtp", "condition",
])

export function validateWorkflowDefinitionJson(value: string) {
  let definition: {
    nodes?: Array<{ id?: unknown; data?: { kind?: unknown } }>
    edges?: Array<{ source?: unknown; target?: unknown }>
    budget?: { maxSteps?: unknown; maxDurationMs?: unknown }
  }
  try {
    definition = JSON.parse(value) as typeof definition
  } catch {
    throw new Error("Workflow definition must be valid JSON.")
  }
  const nodes = definition.nodes
  const edges = definition.edges
  if (!Array.isArray(nodes) || !Array.isArray(edges)) throw new Error("Workflow definition requires nodes and edges.")
  if (nodes.length > 200 || edges.length > 400) throw new Error("Workflow limit is 200 nodes and 400 edges.")
  const ids = new Set<string>()
  for (const node of nodes) {
    if (typeof node.id !== "string" || !node.id.trim() || ids.has(node.id) || !WORKFLOW_NODE_KINDS.has(String(node.data?.kind))) {
      throw new Error("Workflow contains an invalid, duplicate, or unsupported node.")
    }
    ids.add(node.id)
  }
  if (edges.some((edge) => typeof edge.source !== "string" || typeof edge.target !== "string" || !ids.has(edge.source) || !ids.has(edge.target))) {
    throw new Error("Workflow contains an edge with an unknown node.")
  }
  const maxSteps = Number(definition.budget?.maxSteps ?? 100)
  const maxDurationMs = Number(definition.budget?.maxDurationMs ?? 120000)
  if (!Number.isFinite(maxSteps) || maxSteps < 1 || maxSteps > 1000 || !Number.isFinite(maxDurationMs) || maxDurationMs < 1000 || maxDurationMs > 3_600_000) {
    throw new Error("Workflow execution budget is outside the supported limits.")
  }
}
