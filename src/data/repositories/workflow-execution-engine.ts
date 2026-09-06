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

export type ExecutionContext = Record<string, unknown> & {
  input: unknown
  vars: Record<string, unknown>
  steps: Record<string, unknown>
}

function navigateObject(obj: unknown, parts: string[]): unknown {
  let curr: unknown = obj
  for (const part of parts) {
    if (curr === null || curr === undefined || typeof curr !== "object") return undefined
    curr = (curr as Record<string, unknown>)[part]
  }
  return curr
}

function applyPipeFilters(val: unknown, pipes: string[]): unknown {
  let curr = val
  for (const pipe of pipes) {
    const trimmed = pipe.trim()
    if (!trimmed) continue
    if (trimmed === "upper" || trimmed === "uppercase") {
      curr = String(curr ?? "").toUpperCase()
    } else if (trimmed === "lower" || trimmed === "lowercase") {
      curr = String(curr ?? "").toLowerCase()
    } else if (trimmed === "trim") {
      curr = String(curr ?? "").trim()
    } else if (trimmed === "json") {
      curr = JSON.stringify(curr)
    } else if (trimmed.startsWith("default(")) {
      const match = trimmed.match(/^default\(\s*(['"]?)(.*?)\1\s*\)$/)
      const fallback = match ? match[2] : ""
      if (curr === undefined || curr === null || curr === "") {
        curr = fallback
      }
    }
  }
  return curr
}

export function readPath(context: ExecutionContext, expression: string): unknown {
  if (!expression || typeof expression !== "string") return undefined
  let rawPath = expression.trim()
  rawPath = rawPath.replace(/^\{\{\s*|\s*\}\}$/g, "").replace(/^\$\{\s*|\s*\}$/g, "")
  if (!rawPath) return undefined

  const pipeParts = rawPath.split("|").map((p) => p.trim())
  const basePath = pipeParts[0]
  const pipes = pipeParts.slice(1)

  const parts = basePath.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean)
  if (parts.length === 0) return applyPipeFilters(undefined, pipes)

  let val: unknown
  const first = parts[0]
  if (first === "input" || first === "$input") {
    val = navigateObject(context.input, parts.slice(1))
  } else if (first === "vars" || first === "$vars") {
    val = navigateObject(context.vars, parts.slice(1))
  } else if (first === "steps" || first === "$steps") {
    val = navigateObject(context.steps, parts.slice(1))
  } else if (first === "context" || first === "$context") {
    val = navigateObject(context, parts.slice(1))
  } else {
    val = navigateObject(context, parts)
    if (val === undefined && context.vars) {
      val = navigateObject(context.vars, parts)
    }
    if (val === undefined && context.steps) {
      val = navigateObject(context.steps, parts)
    }
    if (val === undefined && context.input) {
      val = navigateObject(context.input, parts)
    }
  }

  return applyPipeFilters(val, pipes)
}

function formatValue(val: unknown): string {
  if (val === undefined || val === null) return ""
  if (typeof val === "string") return val
  if (typeof val === "number" || typeof val === "boolean") return String(val)
  return JSON.stringify(val)
}

export function interpolate(value: string | undefined | null, context: ExecutionContext): string {
  if (!value) return ""
  return value
    .replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expr) => formatValue(readPath(context, expr)))
    .replace(/\$\{([^}]+)\}/g, (_match, expr) => formatValue(readPath(context, expr)))
    .replace(/(^|[^a-zA-Z0-9_$])\$([a-zA-Z_][\w.]*)/g, (match, prefix, expr) => {
      const result = readPath(context, expr)
      return result !== undefined ? `${prefix}${formatValue(result)}` : match
    })
}

export function evaluateExpression(expression: string, context: ExecutionContext): boolean {
  const normalized = expression.trim()
  if (!normalized) return false
  if (normalized === "true") return true
  if (normalized === "false") return false

  const match = normalized.match(/^(.+?)\s*(===|!==|==|!=|>=|<=|>|<|contains|startsWith|endsWith)\s*(.+)$/)
  if (!match) {
    const val = readPath(context, normalized)
    return Boolean(val && val !== "false" && val !== "0")
  }

  const leftRaw = match[1].trim()
  const op = match[2].trim()
  const rightRaw = match[3].trim()

  const leftVal = leftRaw.startsWith("{{") || leftRaw.startsWith("${") || leftRaw.startsWith("$")
    ? readPath(context, leftRaw)
    : readPath(context, leftRaw) ?? interpolate(leftRaw, context)

  const rightVal = rightRaw.startsWith("{{") || rightRaw.startsWith("${") || rightRaw.startsWith("$")
    ? readPath(context, rightRaw)
    : interpolate(rightRaw, context).replace(/^['"]|['"]$/g, "")

  const left = leftVal
  const right = rightVal === "true" ? true : rightVal === "false" ? false : Number.isFinite(Number(rightVal)) && rightVal !== "" ? Number(rightVal) : rightVal

  switch (op) {
    case "===": return left === right
    case "!==": return left !== right
    case "==": return String(left ?? "") === String(right ?? "")
    case "!=": return String(left ?? "") !== String(right ?? "")
    case ">": return Number(left) > Number(right)
    case "<": return Number(left) < Number(right)
    case ">=": return Number(left) >= Number(right)
    case "<=": return Number(left) <= Number(right)
    case "contains": return String(left ?? "").includes(String(right ?? ""))
    case "startsWith": return String(left ?? "").startsWith(String(right ?? ""))
    case "endsWith": return String(left ?? "").endsWith(String(right ?? ""))
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
    case "start": return context.input
    case "end": return data.inputTemplate || data.template ? interpolate(data.inputTemplate || data.template, context) : { input: context.input, vars: context.vars }
    case "variable-assigner": {
      const val = data.variableValue ? interpolate(data.variableValue, context) : ""
      const varName = data.variableName || "variable"
      context.vars[varName] = val
      context[varName] = val
      return val
    }
    case "template": {
      const rendered = interpolate(data.template ?? data.prompt, context)
      if (data.templateOutputFormat === "json") {
        try { return JSON.parse(rendered) } catch { return rendered }
      }
      return rendered
    }
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
      const collection = readPath(context, data.loopExpression || "$input.items") ?? (Array.isArray(context.input) ? context.input : [])
      const items = Array.isArray(collection) ? collection.slice(0, data.maxIterations ?? 25) : []
      const alias = data.itemAlias || "item"
      const results: unknown[] = []
      for (let i = 0; i < items.length; i += 1) {
        context[alias] = items[i]
        context.vars[alias] = items[i]
        context.index = i
        results.push(items[i])
      }
      return { items, results, iterations: items.length, maxIterations: data.maxIterations ?? 25 }
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
      const systemPrompt = data.systemPrompt ? interpolate(data.systemPrompt, context) : undefined
      const history: ChatMessageRecord[] = []
      if (systemPrompt) {
        history.push({ id: crypto.randomUUID(), role: "system", content: systemPrompt, createdAt: Date.now() })
      }
      history.push({ id: crypto.randomUUID(), role: "user", content: prompt, createdAt: Date.now() })
      let output = ""
      for await (const event of streamChatAgentResponse(history, runtime, { selectedAgentId: data.agentId || undefined })) {
        if (event.type === "text-delta") output += event.text
        if (event.type === "error") throw new Error(event.error)
      }
      if (data.responseFormat === "json") {
        try { return JSON.parse(output) } catch { return output }
      }
      return output
    }
    case "http":
    case "webhook":
    case "toolset": {
      const interpolatedUrl = data.url ? interpolate(data.url, context) : undefined
      const headersJson = data.headersJson ? interpolate(data.headersJson, context) : "{}"
      const queryJson = data.queryJson ? interpolate(data.queryJson, context) : "{}"
      const bodyJson = data.bodyJson ? interpolate(data.bodyJson, context) : "{}"
      const inputJson = JSON.stringify({ ...context, body: bodyJson })
      if (data.integrationId) return (await executeIntegration((await getIntegrationDetail(data.integrationId)).config, inputJson)).body
      if (!interpolatedUrl) throw new Error("A URL or integration is required.")
      return (await executeIntegration({ kind: "http", baseUrl: interpolatedUrl, selectedEndpointId: "workflow", endpoints: [{ id: "workflow", name: "Workflow request", description: "", method: data.method || "POST", path: "/", bodyMode: "json", headersJson, queryJson, bodyJson, parameterSchemaJson: "{}", parameters: [] }], method: data.method || "POST", url: interpolatedUrl, description: "", headersJson, queryJson, bodyJson, authType: "none", authConfigJson: "{}", parameterSchemaJson: "{}" }, inputJson)).body
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
  const incoming = new Map<string, Edge<WorkflowEdgeData>[]>()
  for (const edge of definition.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge as Edge<WorkflowEdgeData>])
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge as Edge<WorkflowEdgeData>])
  }

  const start = definition.nodes.find((node) => node.data.kind === "start")
  if (!start) throw new Error("Workflow requires a start node.")

  const context: ExecutionContext = {
    input: input && typeof input === "object" ? input : { value: input },
    vars: {},
    steps: {},
  }
  context.$input = context.input
  context.$vars = context.vars
  context.$steps = context.steps
  Object.defineProperty(context, "$context", { value: context, enumerable: false, configurable: true, writable: true })

  const traces: WorkflowNodeTraceRecord[] = []
  const maxSteps = Math.min(definition.budget?.maxSteps ?? 100, 1000)
  const workflowStartedAt = Date.now()
  const maxDurationMs = Math.min(definition.budget?.maxDurationMs ?? 120000, 3_600_000)

  const nodeStatus = new Map<string, "pending" | "running" | "completed" | "skipped" | "failed">()
  const edgeActive = new Map<string, boolean>()
  for (const [id] of nodes) nodeStatus.set(id, "pending")

  const readyQueue: string[] = [start.id]

  while (readyQueue.length > 0 && traces.length < maxSteps) {
    if (Date.now() - workflowStartedAt > maxDurationMs) {
      throw new Error(`Workflow exceeded its ${maxDurationMs} ms execution budget.`)
    }

    const currentBatch = readyQueue.splice(0, readyQueue.length)
    await Promise.all(
      currentBatch.map(async (id) => {
        const node = nodes.get(id)
        if (!node) return
        nodeStatus.set(id, "running")
        const startedAt = Date.now()
        const traceId = `${id}-${startedAt}-${traces.length}`

        if (node.data.enabled === false) {
          nodeStatus.set(id, "skipped")
          traces.push({ traceId, nodeId: id, label: node.data.label, status: "skipped", input: JSON.stringify(context), output: "Node disabled.", startedAt, finishedAt: Date.now() })
          onTrace?.(traces.at(-1)!)
          return
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

          context.steps[node.id] = output
          context.steps[node.data.label] = output
          if (node.data.outputKey) {
            context[node.data.outputKey] = output
            context.vars[node.data.outputKey] = output
          }

          nodeStatus.set(id, "completed")
          const activeEdges = getNextEdges(node, output, outgoing, context)
          const allOutgoing = outgoing.get(node.id) ?? []
          for (const edge of allOutgoing) {
            edgeActive.set(edge.id, activeEdges.includes(edge))
          }

          const skipped = mode === "dry-run" && typeof output === "object" && output !== null && "skipped" in output
          traces.push({ traceId, nodeId: id, label: node.data.label, status: skipped ? "skipped" : "success", input: traceInput, output: typeof output === "string" ? output : JSON.stringify(output), startedAt, finishedAt: Date.now() })
          onTrace?.(traces.at(-1)!)
        } catch (error) {
          nodeStatus.set(id, "failed")
          traces.push({ traceId, nodeId: id, label: node.data.label, status: "error", input: JSON.stringify(context), output: error instanceof Error ? error.message : String(error), startedAt, finishedAt: Date.now() })
          onTrace?.(traces.at(-1)!)
          if (!node.data.continueOnError) return
        }
      })
    )

    let progress = false
    for (const [id] of nodes) {
      if (nodeStatus.get(id) !== "pending") continue
      const inEdges = incoming.get(id) ?? []
      if (inEdges.length === 0) continue

      const allInResolved = inEdges.every((edge) => {
        const srcStatus = nodeStatus.get(edge.source)
        return srcStatus === "completed" || srcStatus === "skipped" || srcStatus === "failed"
      })

      if (!allInResolved) continue

      const hasActiveEdge = inEdges.some((edge) => edgeActive.get(edge.id) !== false)
      if (hasActiveEdge) {
        readyQueue.push(id)
        progress = true
      } else {
        nodeStatus.set(id, "skipped")
        progress = true
      }
    }

    if (!progress && readyQueue.length === 0) break
  }

  if (traces.length >= maxSteps) throw new Error(`Workflow reached its ${maxSteps}-step safety limit.`)
  return { traces, output: context }
}
