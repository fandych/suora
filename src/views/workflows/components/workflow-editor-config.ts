import type { WorkflowNodeData } from "@/data/domain/models"
import { DEFAULT_WORKFLOW_NOTIFICATION_SETTINGS } from "@/data/repositories/workflow-notifications"

export const workflowPresetNodes: Array<{
  kind: WorkflowNodeData["kind"]
  label: string
  summary: string
}> = [
  { kind: "start", label: "Start", summary: "Entry trigger and input mapping." },
  { kind: "end", label: "End", summary: "Return or finalize workflow output." },
  { kind: "document-retrieval", label: "Document Retrieval", summary: "Search indexed documents before reasoning." },
  { kind: "agent", label: "Agent", summary: "Prompted execution step." },
  { kind: "if-else", label: "If / Else", summary: "Route execution based on expressions." },
  { kind: "http", label: "HTTP", summary: "Call an HTTP endpoint or toolset." },
  { kind: "script", label: "Script", summary: "Run inline code with runtime controls." },
  { kind: "variable-assigner", label: "Set variable", summary: "Store a derived value for downstream nodes." },
  { kind: "template", label: "Template", summary: "Render text with workflow variables." },
  { kind: "ai-response", label: "AI response", summary: "Generate a direct model response." },
  { kind: "toolset", label: "Toolset", summary: "Run a bound integration tool." },
  { kind: "webhook", label: "Webhook", summary: "Send an outbound webhook request." },
  { kind: "smtp", label: "Send email", summary: "Send a notification via configured SMTP." },
]

export const defaultWorkflowBindings = {
  providerId: "provider-openai",
  skillId: "skill-plan",
  documentId: "document-product-manual",
  integrationId: "integration-webhook",
}

export const defaultWorkflowNotifications = DEFAULT_WORKFLOW_NOTIFICATION_SETTINGS

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
    variableName: "value",
    variableValue: "",
    template: "{{input}}",
    templateOutputFormat: "text" as const,
    loopExpression: "$input.items",
    maxIterations: 25,
    emailTo: "",
    emailSubject: "Workflow notification",
    emailBody: "{{result}}",
    systemPrompt: "",
    temperature: 0.7,
    maxTokens: 1024,
    responseFormat: "text" as const,
    inputSchemaJson: "{}",
    outputSchemaJson: "{}",
    itemAlias: "item",
    concurrency: 2,
    mergeStrategy: "all-settled" as const,
    notes: "",
  } satisfies WorkflowNodeData

  switch (kind) {
    case "start":
      return { ...base, label: "Start", task: "Normalize the inbound request payload.", outputKey: "request", inputSchemaJson: "{\n  \"type\": \"object\"\n}" }
    case "end":
      return { ...base, label: "End", task: "Finalize and return the workflow result.", inputTemplate: "{{result}}", outputKey: "response", outputSchemaJson: "{\n  \"type\": \"object\"\n}" }
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
    case "variable-assigner":
      return { ...base, label: "Set variable", task: "Store a value for downstream nodes.", outputKey: "value" }
    case "template":
      return { ...base, label: "Template", task: "Render a text template from workflow context.", outputKey: "rendered" }
    case "ai-response":
      return { ...base, label: "AI response", task: "Generate a model response from the current context.", outputKey: "response" }
    case "loop":
      return { ...base, label: "Loop", task: "Iterate through an input collection.", outputKey: "loop" }
    case "parallel":
      return { ...base, label: "Parallel", task: "Run downstream branches concurrently.", outputKey: "parallel" }
    case "serial":
      return { ...base, label: "Serial", task: "Sequence downstream work.", outputKey: "serial" }
    case "toolset":
      return { ...base, label: "Toolset", task: "Execute a configured integration.", outputKey: "tool_result" }
    case "webhook":
      return { ...base, label: "Webhook", task: "Deliver the current context to an HTTP endpoint.", outputKey: "webhook_result" }
    case "wiki-retrieval":
      return { ...base, label: "Wiki retrieval", task: "Search workspace knowledge.", outputKey: "wiki_results" }
    case "smtp":
      return { ...base, label: "Send email", task: "Send an email notification.", outputKey: "email_result" }
    case "condition":
      return { ...base, label: "Condition", task: "Continue only when the expression matches.", outputKey: "condition" }
    default:
      return base
  }
}