import type { WorkflowNodeData } from "@/data/domain/models"

export const workflowPresetNodes: Array<{
  kind: WorkflowNodeData["kind"]
  label: string
  summary: string
}> = [
  { kind: "start", label: "Start", summary: "Entry trigger and input mapping." },
  { kind: "end", label: "End", summary: "Return or finalize workflow output." },
  { kind: "document-retrieval", label: "Document Retrieval", summary: "Search indexed documents before reasoning." },
  { kind: "agent", label: "Agent", summary: "Prompted execution step." },
  { kind: "fork", label: "Fork", summary: "Split execution into multiple branches." },
  { kind: "join", label: "Join", summary: "Merge multiple branches back together." },
  { kind: "if-else", label: "If / Else", summary: "Route execution based on expressions." },
  { kind: "http", label: "HTTP", summary: "Call an HTTP endpoint or toolset." },
  { kind: "script", label: "Script", summary: "Run inline code with runtime controls." },
]

export const defaultWorkflowBindings = {
  providerId: "provider-openai",
  skillId: "skill-plan",
  documentId: "document-product-manual",
  integrationId: "integration-webhook",
}

export function createWorkflowNodeData(kind: WorkflowNodeData["kind"], index: number): WorkflowNodeData {
  const base = {
    label: `${kind[0].toUpperCase()}${kind.slice(1)} ${index}`,
    prompt: `Configure ${kind} node behavior.`,
    kind,
    task: `Execute the ${kind} step.`,
    agentId: "",
    enabled: true,
    continueOnError: kind === "start" || kind === "end",
    retryCount: 0,
    timeoutMs: 30000,
    modelId: "",
    runIf: "",
    inputTemplate: "",
    outputKey: "",
    maxInputChars: 8000,
    maxOutputChars: 8000,
    documentId: "",
    documentName: "",
    queryExpression: "$input.query",
    resultLimit: 5,
    integrationId: "",
    integrationName: "",
    method: "POST",
    url: "",
    headersJson: "{}",
    queryJson: "{}",
    bodyJson: "{}",
    runtime: "node",
    script: "export async function main(input) {\n  return { ok: true, input }\n}\n",
    timeoutSeconds: 60,
    branchCount: 2,
    joinStrategy: "wait-all" as const,
    trueLabel: "True",
    falseLabel: "False",
    branches: [
      { id: `branch-${index}-true`, label: "True", expression: "$input.ok === true" },
      { id: `branch-${index}-false`, label: "False", expression: "" },
    ],
  } satisfies WorkflowNodeData

  switch (kind) {
    case "start":
      return { ...base, label: "Start", task: "Normalize the inbound request payload.", outputKey: "request" }
    case "end":
      return { ...base, label: "End", task: "Finalize and return the workflow result.", inputTemplate: "{{result}}", outputKey: "response" }
    case "document-retrieval":
      return { ...base, task: "Search indexed documents for supporting context.", outputKey: "document_results" }
    case "agent":
      return { ...base, task: "Run the selected agent with the current workflow context.", continueOnError: false, retryCount: 1, outputKey: "agent_result" }
    case "fork":
      return { ...base, task: "Split execution into parallel branches.", outputKey: "fork_result" }
    case "join":
      return { ...base, task: "Merge outputs from previous branches.", outputKey: "join_result" }
    case "if-else":
      return { ...base, task: "Evaluate conditions and route to the right branch.", outputKey: "condition_result" }
    case "http":
      return { ...base, task: "Call an HTTP endpoint or bound integration.", outputKey: "http_result" }
    case "script":
      return { ...base, task: "Run inline code with the selected runtime.", outputKey: "script_result" }
    default:
      return base
  }
}