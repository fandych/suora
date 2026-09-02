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
    httpRequest: tool({
      description: "Make an HTTP request through the desktop runtime.",
      inputSchema: z.object({ method: z.string().default("GET"), url: z.string().url(), headersJson: z.string().default("{}"), queryJson: z.string().default("{}"), bodyJson: z.string().default("{}") }),
      execute: async ({ method, url, headersJson, queryJson, bodyJson }) => executeIntegration({ kind: "http", method, url, headersJson, queryJson, bodyJson, description: "chat http tool", authType: "none", authConfigJson: "{}", parameterSchemaJson: "{}" }, bodyJson),
    }),
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
  if (!agent) {
    return settings.model.systemPrompt
  }

  return [
    settings.model.systemPrompt,
    `Selected agent: ${agent.agent.title}`,
    agent.agent.summary ? `Agent description: ${agent.agent.summary}` : "",
    agent.config.instructions,
  ].filter(Boolean).join("\n\n")
}

export async function listScopedDocuments(hasScope: boolean, scopedDocuments: Array<Awaited<ReturnType<typeof getDocumentDetail>> | null>) {
  return hasScope ? scopedDocuments.map((item) => item!.document) : await listDocuments()
}

export async function listScopedSkills(hasScope: boolean, scopedSkills: Array<Awaited<ReturnType<typeof getSkillDetail>> | null>) {
  return hasScope ? scopedSkills.map((item) => item!.skill) : await listSkills()
}

export async function listScopedWorkflows(hasScope: boolean, scopedWorkflows: Array<Awaited<ReturnType<typeof getWorkflowDetail>> | null>) {
  return hasScope ? scopedWorkflows.map((item) => item!.workflow) : await listWorkflows()
}