import { tool } from "ai"
import { z } from "zod"

import { getAgentDetail } from "@/data/repositories/agent-repository"
import type { AgentDetail } from "@/data/domain/models"
import type { ChatRuntimeSettings } from "@/data/repositories/chat-settings-repository"
import { getDocumentDetail, listDocuments } from "@/data/repositories/document-repository"
import { executeIntegration } from "@/data/repositories/integration-execution-repository"
import { getIntegrationDetail } from "@/data/repositories/integration-repository"
import { getSkillDetail, listSkills } from "@/data/repositories/skill-repository"
import { getWorkflowDetail, listWorkflows } from "@/data/repositories/workflow-repository"
import { suoraIpc } from "@/lib/ipc"
import { createDefaultHttpIntegrationConfig } from "@/lib/integration-http"

type RetryableToolActivity = {
  toolName: string
  input?: Record<string, unknown>
}

type RetryContext = {
  scopedDocuments?: Array<Awaited<ReturnType<typeof getDocumentDetail>> | null>
  scopedSkills?: Array<Awaited<ReturnType<typeof getSkillDetail>> | null>
  scopedWorkflows?: Array<Awaited<ReturnType<typeof getWorkflowDetail>> | null>
  scopedIntegrations?: Array<Awaited<ReturnType<typeof getIntegrationDetail>> | null>
}

function stringifyToolResult(value: unknown) {
  if (typeof value === "string") {
    return value
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function createHttpToolConfig(input: { method: string; url: string; headersJson: string; queryJson: string; bodyJson: string; description: string }) {
  return {
    ...createDefaultHttpIntegrationConfig(),
    method: input.method,
    url: input.url,
    description: input.description,
    headersJson: input.headersJson,
    queryJson: input.queryJson,
    bodyJson: input.bodyJson,
  }
}

export async function createBuiltInTools() {
  return {
    listWorkspaceFiles: tool({
      description: "List files and folders from the local workspace.",
      inputSchema: z.object({ relativePath: z.string().optional() }),
      execute: async ({ relativePath }) => suoraIpc.tools.listFiles(relativePath),
    }),
    readWorkspaceFile: tool({
      description: "Read a text file from the local workspace.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => suoraIpc.tools.readFile(path),
    }),
    writeWorkspaceFile: tool({
      description: "Write text content to a file inside the local workspace.",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: async ({ path, content }) => suoraIpc.tools.writeFile({ path, content }),
    }),
    runWorkspaceCommand: tool({
      description: "Run a shell command inside the local workspace and capture stdout/stderr.",
      inputSchema: z.object({ command: z.string(), cwd: z.string().optional(), timeoutMs: z.number().optional() }),
      execute: async ({ command, cwd, timeoutMs }) => suoraIpc.tools.runCommand({ command, cwd, timeoutMs }),
    }),
    openExternalUrl: tool({
      description: "Open a URL in the system browser.",
      inputSchema: z.object({ url: z.string().url() }),
      execute: async ({ url }) => suoraIpc.tools.openExternal(url),
    }),
    browser_navigate: tool({
      description: "Open or hide an in-app browser window so the user can log in or complete a manual web flow.",
      inputSchema: z.object({ url: z.string().url().optional(), visible: z.boolean().default(true) }),
      execute: async ({ url, visible }) => suoraIpc.tools.browserNavigate({ url, visible }),
    }),
    httpRequest: tool({
      description: "Make an HTTP request through the desktop runtime.",
      inputSchema: z.object({ method: z.string().default("GET"), url: z.string().url(), headersJson: z.string().default("{}"), queryJson: z.string().default("{}"), bodyJson: z.string().default("{}") }),
      execute: async ({ method, url, headersJson, queryJson, bodyJson }) => executeIntegration(createHttpToolConfig({ method, url, headersJson, queryJson, bodyJson, description: "chat http tool" }), bodyJson),
    }),
  }
}

export async function retryBuiltInToolActivity(activity: RetryableToolActivity) {
  return retryToolActivity(activity)
}

export async function retryToolActivity(activity: RetryableToolActivity, context?: RetryContext) {
  switch (activity.toolName) {
    case "listWorkspaceFiles":
      return stringifyToolResult(await suoraIpc.tools.listFiles(typeof activity.input?.relativePath === "string" ? activity.input.relativePath : undefined))
    case "readWorkspaceFile":
      if (typeof activity.input?.path !== "string") {
        throw new Error("Tool input is missing the file path.")
      }
      return stringifyToolResult(await suoraIpc.tools.readFile(activity.input.path))
    case "writeWorkspaceFile":
      if (typeof activity.input?.path !== "string" || typeof activity.input?.content !== "string") {
        throw new Error("Tool input is missing the file path or content.")
      }
      return stringifyToolResult(await suoraIpc.tools.writeFile({ path: activity.input.path, content: activity.input.content }))
    case "runWorkspaceCommand":
      if (typeof activity.input?.command !== "string") {
        throw new Error("Tool input is missing the command.")
      }
      return stringifyToolResult(await suoraIpc.tools.runCommand({ command: activity.input.command, cwd: typeof activity.input.cwd === "string" ? activity.input.cwd : undefined, timeoutMs: typeof activity.input.timeoutMs === "number" ? activity.input.timeoutMs : undefined }))
    case "openExternalUrl":
      if (typeof activity.input?.url !== "string") {
        throw new Error("Tool input is missing the URL.")
      }
      return stringifyToolResult(await suoraIpc.tools.openExternal(activity.input.url))
    case "browser_navigate":
      return stringifyToolResult(await suoraIpc.tools.browserNavigate({ url: typeof activity.input?.url === "string" ? activity.input.url : undefined, visible: typeof activity.input?.visible === "boolean" ? activity.input.visible : true }))
    case "httpRequest":
      if (typeof activity.input?.url !== "string") {
        throw new Error("Tool input is missing the URL.")
      }
      return stringifyToolResult(await executeIntegration(createHttpToolConfig({ method: typeof activity.input.method === "string" ? activity.input.method : "GET", url: activity.input.url, headersJson: typeof activity.input.headersJson === "string" ? activity.input.headersJson : "{}", queryJson: typeof activity.input.queryJson === "string" ? activity.input.queryJson : "{}", bodyJson: typeof activity.input.bodyJson === "string" ? activity.input.bodyJson : "{}", description: "chat http tool retry" }), typeof activity.input.bodyJson === "string" ? activity.input.bodyJson : "{}"))
    case "searchDocuments": {
      const query = typeof activity.input?.query === "string" ? activity.input.query : ""
      if (!query) {
        throw new Error("Tool input is missing the document query.")
      }

      const documents = await listScopedDocuments(Boolean(context?.scopedDocuments?.length), context?.scopedDocuments ?? [])
      const match = documents.find((item) => item.title.toLowerCase().includes(query.toLowerCase()))
      if (!match) {
        return stringifyToolResult({ found: false, reason: "No matching document" })
      }

      const detail = await getDocumentDetail(match.id)
      return stringifyToolResult({ found: true, title: detail.document.title, summary: detail.document.summary, pages: detail.pages.map((page) => ({ title: page.title, excerpt: page.content.slice(0, 240) })) })
    }
    case "searchSkills": {
      const query = typeof activity.input?.query === "string" ? activity.input.query : ""
      if (!query) {
        throw new Error("Tool input is missing the skill query.")
      }

      const skills = await listScopedSkills(Boolean(context?.scopedSkills?.length), context?.scopedSkills ?? [])
      const match = skills.find((item) => item.title.toLowerCase().includes(query.toLowerCase()))
      if (!match) {
        return stringifyToolResult({ found: false, reason: "No matching skill" })
      }

      const detail = await getSkillDetail(match.id)
      return stringifyToolResult({ found: true, title: detail.skill.title, summary: detail.skill.summary, version: detail.selectedVersion.label, files: detail.files.map((file) => file.path) })
    }
    case "searchWorkflows": {
      const query = typeof activity.input?.query === "string" ? activity.input.query : ""
      if (!query) {
        throw new Error("Tool input is missing the workflow query.")
      }

      const workflows = await listScopedWorkflows(Boolean(context?.scopedWorkflows?.length), context?.scopedWorkflows ?? [])
      const match = workflows.find((item) => item.title.toLowerCase().includes(query.toLowerCase()))
      if (!match) {
        return stringifyToolResult({ found: false, reason: "No matching workflow" })
      }

      const detail = await getWorkflowDetail(match.id)
      return stringifyToolResult({ found: true, title: detail.workflow.title, summary: detail.workflow.summary, version: detail.selectedVersion.label, nodes: detail.definition.nodes.map((node) => node.data.label) })
    }
    case "runIntegration": {
      const integrationId = typeof activity.input?.integrationId === "string" ? activity.input.integrationId : ""
      if (!integrationId) {
        throw new Error("Tool input is missing the integration ID.")
      }

      const boundIntegration = context?.scopedIntegrations?.find((item) => item?.integration.id === integrationId)
      if (context?.scopedIntegrations?.length && !boundIntegration) {
        throw new Error("The selected agent cannot access this integration.")
      }

      const detail = boundIntegration ?? await getIntegrationDetail(integrationId)
      const result = await executeIntegration(detail.config, typeof activity.input?.inputJson === "string" ? activity.input.inputJson : "{}")
      return stringifyToolResult({ integration: detail.integration.title, ok: result.ok, status: result.status, body: result.body })
    }
    default:
      throw new Error(`Retry is not available for ${activity.toolName}.`)
  }
}

export async function resolveAgentContext(selectedAgentId: string | undefined) {
  if (!selectedAgentId) {
    return null
  }

  const detail = await getAgentDetail(selectedAgentId)
  if (!detail) {
    return null
  }

  return {
    detail,
    skills: await Promise.all((detail.config.skillIds ?? []).map(async (id) => getSkillDetail(id).catch(() => null))),
    documents: await Promise.all((detail.config.documentIds ?? []).map(async (id) => getDocumentDetail(id).catch(() => null))),
    workflows: await Promise.all((detail.config.workflowIds ?? []).map(async (id) => getWorkflowDetail(id).catch(() => null))),
    integrations: await Promise.all((detail.config.toolsetIds ?? []).map(async (id) => getIntegrationDetail(id).catch(() => null))),
  }
}

export function mergeAgentInstructions(settings: ChatRuntimeSettings, agent: AgentDetail | null) {
  const browserGuidance = "When you use browser_navigate, treat it as an intermediate step only. After opening or hiding the browser, continue the tool loop and produce a final assistant response that tells the user what was opened, what to do next, or what information still needs to be checked. Do not end the task with only the browser action itself."

  if (!agent) {
    return [settings.model.systemPrompt, browserGuidance].filter(Boolean).join("\n\n")
  }

  return [
    settings.model.systemPrompt,
    browserGuidance,
    `Selected agent: ${agent.agent.title}`,
    agent.agent.summary ? `Agent description: ${agent.agent.summary}` : "",
    agent.config.instructions,
  ].filter(Boolean).join("\n\n")
}

export async function listScopedDocuments(hasScope: boolean, scopedDocuments: Array<Awaited<ReturnType<typeof getDocumentDetail>> | null>) {
  return hasScope ? scopedDocuments.filter((item): item is Awaited<ReturnType<typeof getDocumentDetail>> => Boolean(item)).map((item) => item.document) : await listDocuments()
}

export async function listScopedSkills(hasScope: boolean, scopedSkills: Array<Awaited<ReturnType<typeof getSkillDetail>> | null>) {
  return hasScope ? scopedSkills.filter((item): item is Awaited<ReturnType<typeof getSkillDetail>> => Boolean(item)).map((item) => item.skill) : await listSkills()
}

export async function listScopedWorkflows(hasScope: boolean, scopedWorkflows: Array<Awaited<ReturnType<typeof getWorkflowDetail>> | null>) {
  return hasScope ? scopedWorkflows.filter((item): item is Awaited<ReturnType<typeof getWorkflowDetail>> => Boolean(item)).map((item) => item.workflow) : await listWorkflows()
}