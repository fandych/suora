import type { Edge, Node } from "@xyflow/react"

import type { ChatMessageRecord, WorkflowDefinition, WorkflowEdgeData, WorkflowNodeData, WorkflowNodeTraceRecord } from "@/data/domain/models"
import { getChatRuntimeSettings } from "@/data/repositories/chat-settings-repository"
import { getDocumentDetail } from "@/data/repositories/document-repository"
import { executeIntegration } from "@/data/repositories/integration-execution-repository"
import { getIntegrationDetail } from "@/data/repositories/integration-repository"
import { suoraIpc } from "@/lib/ipc"
import { streamChatAgentResponse } from "@/services/ai-service"

type WorkflowExecutionResult = {
  traces: WorkflowNodeTraceRecord[]
  output: Record<string, unknown>
}

export type WorkflowExecutionMode = "dry-run" | "manual"

type ExecutionContext = Record<string, unknown>

function readPath(context: ExecutionContext, expression: string) {
  const path = expression.trim().replace(/^\$?(?:input|context)\.?/, "").split(".").filter(Boolean)
  return path.reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, context)
}

function interpolate(value: string, context: ExecutionContext) {
  return value.replace(/\{\{\s*([^}]+)\s*\}\}|\$([\w.]+)/g, (_match, templatePath, dollarPath) => {
    const result = readPath(context, templatePath || dollarPath)
    return result === undefined ? "" : typeof result === "string" ? result : JSON.stringify(result)
  })
}

function evaluateExpression(expression: string, context: ExecutionContext) {
  const normalized = expression.trim()
  if (!normalized) return false
  const match = normalized.match(/^\s*\$?([\w.]+)\s*(===|!==|==|!=|>=|<=|>|<|contains)\s*(.+?)\s*$/)
  if (!match) return Boolean(readPath(context, normalized))
  const left = readPath(context, match[1])
  const rightRaw = interpolate(match[3], context).replace(/^['"]|['"]$/g, "")
  const right = rightRaw === "true" ? true : rightRaw === "false" ? false : Number.isFinite(Number(rightRaw)) && rightRaw !== "" ? Number(rightRaw) : rightRaw
  switch (match[2]) {
    case "===": return left === right
    case "!==": return left !== right
    case "==": return String(left) === String(right)
    case "!=": return String(left) !== String(right)
    case ">": return Number(left) > Number(right)
    case "<": return Number(left) < Number(right)
    case ">=": return Number(left) >= Number(right)
    case "<=": return Number(left) <= Number(right)
    case "contains": return String(left ?? "").includes(String(right))
    default: return false
  }
}

async function executeNode(node: Node<WorkflowNodeData>, context: ExecutionContext, mode: WorkflowExecutionMode) {
  const data = node.data
  const effectfulKinds = new Set<WorkflowNodeData["kind"]>(["agent", "ai-response", "http", "webhook", "toolset", "script", "smtp"])
  if (mode === "dry-run" && effectfulKinds.has(data.kind)) {
    return { dryRun: true, skipped: true, message: `${data.kind} was not invoked during the safe dry run.` }
  }
  switch (data.kind) {
    case "start": return context.input ?? context
    case "end": return data.inputTemplate ? interpolate(data.inputTemplate, context) : context
    case "variable-assigner": return data.variableValue ? interpolate(data.variableValue, context) : ""
    case "template": return interpolate(data.template ?? data.prompt, context)
    case "condition": return evaluateExpression(data.runIf || data.branches?.[0]?.expression || "", context)
    case "if-else": return true
    case "document-retrieval": {
      if (!data.documentId) throw new Error("A source document is required.")
      const detail = await getDocumentDetail(data.documentId)
      const query = String(readPath(context, data.queryExpression || "$input.query") ?? data.queryExpression ?? "").toLowerCase()
      return detail.pages.filter((page) => `${page.title} ${page.content}`.toLowerCase().includes(query)).slice(0, data.resultLimit ?? 5).map((page) => ({ title: page.title, content: page.content.slice(0, 1200) }))
    }
    case "wiki-retrieval": {
      if (!data.documentId) return { items: [], query: data.queryExpression || "", source: "workspace" }
      const detail = await getDocumentDetail(data.documentId)
      const query = String(readPath(context, data.queryExpression || "$input.query") ?? "").toLowerCase()
      return { items: detail.pages.filter((page) => `${page.title} ${page.content}`.toLowerCase().includes(query)).slice(0, data.resultLimit ?? 5).map((page) => ({ title: page.title, content: page.content.slice(0, 1200) })), query, source: detail.document.title }
    }
    case "loop": {
      const collection = readPath(context, data.loopExpression || "$input.items")
      const items = Array.isArray(collection) ? collection.slice(0, data.maxIterations ?? 25) : []
      if (data.itemAlias) context[data.itemAlias] = items[0]
      return { items, iterations: items.length, maxIterations: data.maxIterations ?? 25 }
    }
    case "parallel":
      return { mode: "parallel", concurrency: data.concurrency ?? 2, mergeStrategy: data.mergeStrategy ?? "all-settled" }
    case "serial":
      return { mode: "serial", notes: data.notes ?? "" }
    case "fork":
      return { mode: "fork", branches: data.branchCount ?? 2 }
    case "join":
      return { mode: "join", strategy: data.joinStrategy ?? "wait-all" }
    case "agent":
    case "ai-response": {
      const runtime = await getChatRuntimeSettings()
      const prompt = interpolate(data.prompt || data.task || "", context)
      const history: ChatMessageRecord[] = [{ id: crypto.randomUUID(), role: "user", content: prompt, createdAt: Date.now() }]
      let output = ""
      for await (const event of streamChatAgentResponse(history, runtime, { selectedAgentId: data.agentId || undefined })) {
        if (event.type === "text-delta") output += event.text
        if (event.type === "error") throw new Error(event.error)
      }
      return output
    }
    case "http":
    case "webhook":
    case "toolset": {
      const inputJson = JSON.stringify(context)
      if (data.integrationId) return (await executeIntegration((await getIntegrationDetail(data.integrationId)).config, inputJson)).body
      if (!data.url) throw new Error("A URL or integration is required.")
      return (await executeIntegration({ kind: "http", baseUrl: data.url, selectedEndpointId: "workflow", endpoints: [{ id: "workflow", name: "Workflow request", description: "", method: data.method || "POST", path: "/", bodyMode: "json", headersJson: data.headersJson || "{}", queryJson: data.queryJson || "{}", bodyJson: data.bodyJson || "{}", parameterSchemaJson: "{}", parameters: [] }], method: data.method || "POST", url: data.url, description: "", headersJson: data.headersJson || "{}", queryJson: data.queryJson || "{}", bodyJson: data.bodyJson || "{}", authType: "none", authConfigJson: "{}", parameterSchemaJson: "{}" }, inputJson)).body
    }
    case "script": return (await executeIntegration({ kind: "scripts", description: "Workflow script", runtime: "node", timeoutMs: Math.min(data.timeoutMs ?? 30000, 60000), inputSchemaJson: "{}", outputSchemaJson: "{}", selectedScriptId: "workflow-script", scripts: [{ id: "workflow-script", name: data.label, handler: "main", code: data.script || "" }] }, JSON.stringify(context))).body
    case "smtp": {
      const result = await suoraIpc.mail.send({ to: interpolate(data.emailTo || "", context), subject: interpolate(data.emailSubject || "Workflow notification", context), content: interpolate(data.emailBody || "", context) })
      if (!result.success) throw new Error(result.error || "Email could not be sent.")
      return { sent: true }
    }
    default: return { kind: data.kind, context }
  }
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string) {
  return Promise.race<T>([
    operation,
    new Promise<T>((_resolve, reject) => window.setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs} ms.`)), timeoutMs)),
  ])
}

function getNextEdges(node: Node<WorkflowNodeData>, output: unknown, outgoing: Map<string, Edge<WorkflowEdgeData>[]>, context: ExecutionContext) {
  const edges = outgoing.get(node.id) ?? []
  if (node.data.kind === "if-else") {
    const branches = node.data.branches ?? []
    const selectedBranch = branches.find((branch, index) => index < branches.length - 1 && evaluateExpression(branch.expression, context)) ?? branches.at(-1)
    return edges.filter((edge) => edge.sourceHandle === selectedBranch?.id)
  }
  if (node.data.kind === "condition") {
    const passed = Boolean(output)
    return edges.filter((edge) => {
      if (edge.data?.condition?.trim()) return evaluateExpression(edge.data.condition, context)
      return passed
    })
  }
  return edges
}

export async function executeWorkflowDefinition(definition: WorkflowDefinition, input: unknown, mode: WorkflowExecutionMode = "manual", onTrace?: (trace: WorkflowNodeTraceRecord) => void): Promise<WorkflowExecutionResult> {
  const nodes = new Map(definition.nodes.map((node) => [node.id, node]))
  const outgoing = new Map<string, Edge<WorkflowEdgeData>[]>()
  for (const edge of definition.edges) outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge as Edge<WorkflowEdgeData>])
  const start = definition.nodes.find((node) => node.data.kind === "start")
  if (!start) throw new Error("Workflow requires a start node.")
  const context: ExecutionContext = { input: input && typeof input === "object" ? input : { value: input } }
  const traces: WorkflowNodeTraceRecord[] = []
  const queue = [start.id]
  const visited = new Map<string, number>()
  const maxSteps = Math.min(definition.budget?.maxSteps ?? 100, 1000)
  const workflowStartedAt = Date.now()
  const maxDurationMs = Math.min(definition.budget?.maxDurationMs ?? 120000, 3_600_000)

  while (queue.length > 0 && traces.length < maxSteps) {
    if (Date.now() - workflowStartedAt > maxDurationMs) {
      throw new Error(`Workflow exceeded its ${maxDurationMs} ms execution budget.`)
    }
    const id = queue.shift()!
    const node = nodes.get(id)
    if (!node || (visited.get(id) ?? 0) >= 3) continue
    visited.set(id, (visited.get(id) ?? 0) + 1)
    const startedAt = Date.now()
    const traceId = `${id}-${startedAt}-${traces.length}`
    if (node.data.enabled === false) {
      traces.push({ traceId, nodeId: id, label: node.data.label, status: "skipped", input: JSON.stringify(context), output: "Node disabled.", startedAt, finishedAt: Date.now() })
      onTrace?.(traces.at(-1)!)
      continue
    }
    try {
      const traceInput = JSON.stringify(context)
      onTrace?.({ traceId, nodeId: id, label: node.data.label, status: "running", input: traceInput, output: "Executing…", startedAt, finishedAt: startedAt })
      const attempts = Math.max(0, Math.min(node.data.retryCount ?? 0, 5)) + 1
      let output: unknown
      let lastError: unknown
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          output = await withTimeout(executeNode(node, context, mode), Math.max(100, Math.min(node.data.timeoutMs ?? 30000, maxDurationMs)), node.data.label)
          lastError = undefined
          break
        } catch (error) {
          lastError = error
        }
      }
      if (lastError) throw lastError
      if (node.data.outputKey) context[node.data.outputKey] = output
      const skipped = mode === "dry-run" && typeof output === "object" && output !== null && "skipped" in output
      traces.push({ traceId, nodeId: id, label: node.data.label, status: skipped ? "skipped" : "success", input: traceInput, output: typeof output === "string" ? output : JSON.stringify(output), startedAt, finishedAt: Date.now() })
      onTrace?.(traces.at(-1)!)
      const nextEdges = getNextEdges(node, output, outgoing, context)
      queue.push(...nextEdges.map((edge) => edge.target))
    } catch (error) {
      traces.push({ traceId, nodeId: id, label: node.data.label, status: "error", input: JSON.stringify(context), output: error instanceof Error ? error.message : String(error), startedAt, finishedAt: Date.now() })
      onTrace?.(traces.at(-1)!)
      if (node.data.continueOnError) queue.push(...(outgoing.get(id) ?? []).map((edge) => edge.target))
    }
  }
  if (traces.length >= maxSteps) throw new Error(`Workflow reached its ${maxSteps}-step safety limit.`)
  return { traces, output: context }
}
