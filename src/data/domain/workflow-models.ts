import type { Edge, Node, Viewport } from "@xyflow/react"
import type { VersionOption } from "@/data/domain/version-models"

export type WorkflowNodeData = {
  label: string; prompt: string
  kind: "start" | "end" | "document-retrieval" | "agent" | "fork" | "join" | "if-else" | "http" | "script" | "variable-assigner" | "template" | "ai-response" | "loop" | "parallel" | "serial" | "toolset" | "webhook" | "wiki-retrieval" | "smtp" | "condition"
  agentId?: string; task?: string; description?: string; enabled?: boolean; continueOnError?: boolean
  retryCount?: number; timeoutMs?: number; modelId?: string; runIf?: string; inputTemplate?: string; outputKey?: string
  maxInputChars?: number; maxOutputChars?: number; documentId?: string; documentName?: string; queryExpression?: string; resultLimit?: number
  integrationId?: string; integrationName?: string; method?: string; url?: string; headersJson?: string; queryJson?: string; bodyJson?: string
  runtime?: string; script?: string; timeoutSeconds?: number; branchCount?: number; joinStrategy?: "wait-all" | "wait-any"
  trueLabel?: string; falseLabel?: string; branches?: Array<{ id: string; label: string; expression: string }>
  variableName?: string; variableValue?: string; template?: string; templateOutputFormat?: "text" | "json"; loopExpression?: string
  maxIterations?: number; emailTo?: string; emailSubject?: string; emailBody?: string; systemPrompt?: string; temperature?: number; maxTokens?: number
  responseFormat?: "text" | "json"; inputSchemaJson?: string; outputSchemaJson?: string; itemAlias?: string; concurrency?: number
  mergeStrategy?: "all-settled" | "fail-fast"; notes?: string; executionStatus?: WorkflowNodeTraceRecord["status"]
}

export type WorkflowInputParameter = { id: string; name: string; description: string; type: "string" | "number" | "boolean" | "object" | "array"; defaultValue: string; required: boolean }
export type WorkflowEdgeData = { condition?: string; successOnly?: boolean }
export type WorkflowVariable = { id: string; name: string; defaultValue: string; required: boolean }
export type WorkflowBudget = { maxSteps: number; maxDurationMs: number }
export type WorkflowNotificationSettings = { enabled: boolean; to: string; subjectTemplate: string; includeSummary: boolean; includeTrace: boolean; triggerOn: "manual" | "dry-run" | "both" }
export type WorkflowDefinition = { nodes: Node<WorkflowNodeData>[]; edges: Edge<WorkflowEdgeData>[]; viewport: Viewport; resourceBindings?: { providerId: string; skillId: string; documentId: string; integrationId: string }; dryRunInputJson?: string; variables?: WorkflowVariable[]; budget?: WorkflowBudget; notifications?: WorkflowNotificationSettings }
export type WorkflowSummary = { id: string; title: string; summary: string; updatedAt: number }
export type WorkflowInvocationRecord = { id: string; versionId: string; status: string; trigger: string; input: string; output: string; traces: WorkflowNodeTraceRecord[]; createdAt: number }
export type WorkflowNodeTraceRecord = { traceId?: string; nodeId: string; label: string; status: "queued" | "running" | "success" | "error" | "skipped"; input?: string; output: string; startedAt: number; finishedAt: number; contextBefore?: WorkflowTraceSnapshot; contextAfter?: WorkflowTraceSnapshot }
export type WorkflowTraceSnapshot = { schemaVersion: 1; input: unknown; current: unknown; vars: Record<string, unknown>; steps: Record<string, unknown>; truncated: boolean; redactedPaths: string[] }
export type WorkflowDetail = { workflow: WorkflowSummary; versions: VersionOption[]; latestVersion: VersionOption; selectedVersion: VersionOption; definition: WorkflowDefinition; invocations: WorkflowInvocationRecord[] }
