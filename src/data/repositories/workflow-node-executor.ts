import type { Node } from "@xyflow/react"
import type { ChatMessageRecord } from "@/data/domain/chat-models"
import type { IntegrationConfig } from "@/data/domain/integration-models"
import type { WorkflowNodeData } from "@/data/domain/workflow-models"
import { interpolate, readPath, type WorkflowVariableContext } from "@/data/repositories/workflow-variable-context"
import { evaluateExpression, toWorkflowHttpResult } from "@/data/repositories/workflow-expression"
import type { WorkflowRuntimePorts } from "@/data/domain/workflow-runtime-ports"

export type WorkflowExecutionMode = "dry-run" | "manual"
export type WorkflowExecutionContext = WorkflowVariableContext

export async function executeWorkflowNode(node: Node<WorkflowNodeData>, context: WorkflowExecutionContext, mode: WorkflowExecutionMode, ports: WorkflowRuntimePorts) {
  const data = node.data
  const effectfulKinds = new Set<WorkflowNodeData["kind"]>(["agent", "ai-response", "http", "webhook", "toolset", "script", "smtp"])
  if (mode === "dry-run" && effectfulKinds.has(data.kind)) {
    return { dryRun: true, skipped: true, message: `${data.kind} was not invoked during the safe dry run.` }
  }
  switch (data.kind) {
    case "start": return context.input
    case "end": return data.inputTemplate || data.template ? interpolate(data.inputTemplate || data.template, context) : { input: context.input, vars: context.vars }
    case "variable-assigner": {
      const value = data.variableValue ? interpolate(data.variableValue, context) : ""
      const variableName = data.variableName || "variable"
      context.vars[variableName] = value
      context[variableName] = value
      return value
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
      const detail = await ports.getDocumentDetail(data.documentId)
      const query = String(readPath(context, data.queryExpression || "$input.query") ?? data.queryExpression ?? "").toLowerCase()
      return detail.pages.filter((page) => `${page.title} ${page.content}`.toLowerCase().includes(query)).slice(0, data.resultLimit ?? 5).map((page) => ({ title: page.title, content: page.content.slice(0, 1200) }))
    }
    case "wiki-retrieval": {
      if (!data.documentId) return { items: [], query: data.queryExpression || "", source: "workspace" }
      const detail = await ports.getDocumentDetail(data.documentId)
      const query = String(readPath(context, data.queryExpression || "$input.query") ?? "").toLowerCase()
      return { items: detail.pages.filter((page) => `${page.title} ${page.content}`.toLowerCase().includes(query)).slice(0, data.resultLimit ?? 5).map((page) => ({ title: page.title, content: page.content.slice(0, 1200) })), query, source: detail.document.title }
    }
    case "loop": {
      const collection = readPath(context, data.loopExpression || "$input.items") ?? (Array.isArray(context.input) ? context.input : [])
      const items = Array.isArray(collection) ? collection.slice(0, data.maxIterations ?? 25) : []
      const alias = data.itemAlias || "item"
      const results: unknown[] = []
      for (let index = 0; index < items.length; index += 1) {
        context[alias] = items[index]
        context.vars[alias] = items[index]
        context.index = index
        results.push(items[index])
      }
      return { items, results, iterations: items.length, maxIterations: data.maxIterations ?? 25 }
    }
    case "parallel": return { mode: "parallel", concurrency: data.concurrency ?? 2, mergeStrategy: data.mergeStrategy ?? "all-settled" }
    case "serial": return { mode: "serial", notes: data.notes ?? "" }
    case "fork": return { mode: "fork", branches: data.branchCount ?? 2 }
    case "join": return { mode: "join", strategy: data.joinStrategy ?? "wait-all" }
    case "agent":
    case "ai-response": {
      const runtime = await ports.getChatRuntimeSettings()
      const prompt = interpolate(data.prompt || data.task || "", context)
      const systemPrompt = data.systemPrompt ? interpolate(data.systemPrompt, context) : undefined
      const history: ChatMessageRecord[] = []
      if (systemPrompt) history.push({ id: crypto.randomUUID(), role: "system", content: systemPrompt, createdAt: Date.now() })
      history.push({ id: crypto.randomUUID(), role: "user", content: prompt, createdAt: Date.now() })
      let output = ""
      for await (const event of ports.streamChatAgentResponse(history, runtime, { selectedAgentId: data.agentId || undefined })) {
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
      const url = data.url ? interpolate(data.url, context) : undefined
      const headersJson = data.headersJson ? interpolate(data.headersJson, context) : "{}"
      const queryJson = data.queryJson ? interpolate(data.queryJson, context) : "{}"
      const bodyJson = data.bodyJson ? interpolate(data.bodyJson, context) : "{}"
      const inputJson = ports.serializeContext({ ...context, body: bodyJson })
      if (data.integrationId) return toWorkflowHttpResult(await ports.executeIntegration((await ports.getIntegrationDetail(data.integrationId)).config, inputJson))
      if (!url) throw new Error("A URL or integration is required.")
      const config: IntegrationConfig = { kind: "http", baseUrl: url, selectedEndpointId: "workflow", endpoints: [{ id: "workflow", name: "Workflow request", description: "", method: data.method || "POST", path: "/", bodyMode: "json", headersJson, queryJson, bodyJson, parameterSchemaJson: "{}", responseSchemaJson: "{}", responseDescription: "", parameters: [] }], method: data.method || "POST", url, description: "", headersJson, queryJson, bodyJson, authType: "none", authConfigJson: "{}", parameterSchemaJson: "{}" }
      return toWorkflowHttpResult(await ports.executeIntegration(config, inputJson))
    }
    case "script": {
      const config: IntegrationConfig = { kind: "scripts", description: "Workflow script", runtime: "node", timeoutMs: Math.min(data.timeoutMs ?? 30000, 60000), inputSchemaJson: "{}", outputSchemaJson: "{}", selectedScriptId: "workflow-script", scripts: [{ id: "workflow-script", name: data.label, handler: "main", code: data.script || "" }] }
      return (await ports.executeIntegration(config, ports.serializeContext(context))).body
    }
    case "smtp": {
      const result = await ports.sendMail({ to: interpolate(data.emailTo || "", context), subject: interpolate(data.emailSubject || "Workflow notification", context), content: interpolate(data.emailBody || "", context) })
      if (!result.success) throw new Error(result.error || "Email could not be sent.")
      return { sent: true }
    }
    default: return { kind: data.kind, context }
  }
}
