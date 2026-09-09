import { tool } from "ai"
import { z } from "zod"

import { createAgent, deleteAgent, getAgentDetail, listAgents, saveAgentDraft } from "@/data/repositories/agent-repository"
import { createDocumentWithMetadata, deleteDocument, getDocumentDetail, listDocuments, saveDocumentDraft } from "@/data/repositories/document-repository"
import { createSkill, deleteSkill, getSkillDetail, listSkills, saveSkillDraft } from "@/data/repositories/skill-repository"
import { createWorkflow, deleteWorkflow, getWorkflowDetail, listWorkflows, saveWorkflowDraft } from "@/data/repositories/workflow-repository"
import type { AgentConfigRecord, DocumentGraphEdge, DocumentPageRecord, DocumentSettings, SkillFileRecord, WorkflowDefinition } from "@/data/domain/models"

export const PRIVATE_RESOURCE_TOOL_IDS = [
  "documents:list", "documents:get", "documents:create", "documents:update", "documents:delete",
  "workflows:list", "workflows:get", "workflows:create", "workflows:update", "workflows:delete",
  "agents:list", "agents:get", "agents:create", "agents:update", "agents:delete",
  "skills:list", "skills:get", "skills:create", "skills:update", "skills:delete",
] as const

type PrivateResourceToolId = typeof PRIVATE_RESOURCE_TOOL_IDS[number]

function parseJson<T>(value: string | undefined, fallback: T, label: string): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    throw new Error(`${label} must be valid JSON.`)
  }
}

function selectTools<T extends Record<string, unknown>>(available: T, enabledIds: readonly string[]) {
  return Object.fromEntries(Object.entries(available).filter(([id]) => enabledIds.includes(id))) as Partial<T>
}

export function createPrivateResourceTools(enabledIds: readonly string[]) {
  const available = {
    "documents:list": tool({
      description: "List private workspace documents.",
      inputSchema: z.object({}),
      execute: () => listDocuments(),
    }),
    "documents:get": tool({
      description: "Get a private workspace document including pages and settings.",
      inputSchema: z.object({ documentId: z.string() }),
      execute: ({ documentId }) => getDocumentDetail(documentId),
    }),
    "documents:create": tool({
      description: "Create a private workspace document.",
      inputSchema: z.object({ title: z.string().min(1), summary: z.string().default("") }),
      execute: ({ title, summary }) => createDocumentWithMetadata({ title, summary }),
    }),
    "documents:update": tool({
      description: "Update a private document. JSON fields replace the corresponding existing values.",
      inputSchema: z.object({ documentId: z.string(), title: z.string().optional(), summary: z.string().optional(), pagesJson: z.string().optional(), graphEdgesJson: z.string().optional(), settingsJson: z.string().optional() }),
      execute: async ({ documentId, title, summary, pagesJson, graphEdgesJson, settingsJson }) => {
        const current = await getDocumentDetail(documentId)
        const nextTitle = title ?? current.document.title
        return saveDocumentDraft(documentId, {
          title: nextTitle,
          summary: summary ?? current.document.summary,
          enabled: current.document.enabled,
          pages: parseJson<DocumentPageRecord[]>(pagesJson, current.pages, "pagesJson"),
          graphEdges: parseJson<DocumentGraphEdge[]>(graphEdgesJson, current.graphEdges, "graphEdgesJson"),
          settings: parseJson<DocumentSettings>(settingsJson, current.settings, "settingsJson"),
          selectedVersionId: current.selectedVersion.id,
        })
      },
    }),
    "documents:delete": tool({
      description: "Delete a private workspace document by ID.",
      inputSchema: z.object({ documentId: z.string() }),
      execute: ({ documentId }) => deleteDocument(documentId),
    }),
    "workflows:list": tool({ description: "List private workspace workflows.", inputSchema: z.object({}), execute: () => listWorkflows() }),
    "workflows:get": tool({ description: "Get a private workspace workflow definition.", inputSchema: z.object({ workflowId: z.string() }), execute: ({ workflowId }) => getWorkflowDetail(workflowId) }),
    "workflows:create": tool({
      description: "Create a private workspace workflow.",
      inputSchema: z.object({ title: z.string().min(1), summary: z.string().default(""), definitionJson: z.string().optional() }),
      execute: async ({ title, summary, definitionJson }) => {
        const created = await createWorkflow()
        return saveWorkflowDraft(created.workflow.id, { title, summary, definition: parseJson<WorkflowDefinition>(definitionJson, created.definition, "definitionJson"), selectedVersionId: created.selectedVersion.id })
      },
    }),
    "workflows:update": tool({
      description: "Update a private workflow; definitionJson must be a complete workflow definition.",
      inputSchema: z.object({ workflowId: z.string(), title: z.string().optional(), summary: z.string().optional(), definitionJson: z.string().optional() }),
      execute: async ({ workflowId, title, summary, definitionJson }) => {
        const current = await getWorkflowDetail(workflowId)
        return saveWorkflowDraft(workflowId, { title: title ?? current.workflow.title, summary: summary ?? current.workflow.summary, definition: parseJson<WorkflowDefinition>(definitionJson, current.definition, "definitionJson"), selectedVersionId: current.selectedVersion.id })
      },
    }),
    "workflows:delete": tool({ description: "Delete a private workspace workflow by ID.", inputSchema: z.object({ workflowId: z.string() }), execute: ({ workflowId }) => deleteWorkflow(workflowId) }),
    "agents:list": tool({ description: "List private workspace agents.", inputSchema: z.object({}), execute: () => listAgents() }),
    "agents:get": tool({ description: "Get a private workspace agent configuration.", inputSchema: z.object({ agentId: z.string() }), execute: ({ agentId }) => getAgentDetail(agentId) }),
    "agents:create": tool({
      description: "Create a private workspace agent.",
      inputSchema: z.object({ title: z.string().min(1), summary: z.string().default(""), instructions: z.string().default("You are a helpful agent."), configJson: z.string().optional() }),
      execute: async ({ title, summary, instructions, configJson }) => {
        const created = await createAgent()
        const config = { ...created.config, ...parseJson<Partial<AgentConfigRecord>>(configJson, {}, "configJson"), instructions }
        return saveAgentDraft({ ...created, agent: { ...created.agent, title, summary, kind: "custom" }, config })
      },
    }),
    "agents:update": tool({
      description: "Update a private custom agent; configJson is merged into its configuration.",
      inputSchema: z.object({ agentId: z.string(), title: z.string().optional(), summary: z.string().optional(), instructions: z.string().optional(), configJson: z.string().optional() }),
      execute: async ({ agentId, title, summary, instructions, configJson }) => {
        const current = await getAgentDetail(agentId)
        if (!current) throw new Error(`Agent ${agentId} was not found.`)
        if (current.agent.kind === "system") throw new Error("System agents cannot be modified.")
        const config = { ...current.config, ...parseJson<Partial<AgentConfigRecord>>(configJson, {}, "configJson"), ...(instructions === undefined ? {} : { instructions }) }
        return saveAgentDraft({ ...current, agent: { ...current.agent, title: title ?? current.agent.title, summary: summary ?? current.agent.summary }, config })
      },
    }),
    "agents:delete": tool({
      description: "Delete a private custom workspace agent by ID.",
      inputSchema: z.object({ agentId: z.string() }),
      execute: async ({ agentId }) => {
        const current = await getAgentDetail(agentId)
        if (!current) throw new Error(`Agent ${agentId} was not found.`)
        if (current.agent.kind === "system") throw new Error("System agents cannot be deleted.")
        return deleteAgent(agentId)
      },
    }),
    "skills:list": tool({ description: "List private workspace skills.", inputSchema: z.object({}), execute: () => listSkills() }),
    "skills:get": tool({ description: "Get a private workspace skill and its files.", inputSchema: z.object({ skillId: z.string() }), execute: ({ skillId }) => getSkillDetail(skillId) }),
    "skills:create": tool({
      description: "Create a private workspace skill.",
      inputSchema: z.object({ title: z.string().min(1), summary: z.string().default(""), filesJson: z.string().optional() }),
      execute: async ({ title, summary, filesJson }) => {
        const created = await createSkill()
        return saveSkillDraft(created.skill.id, { title, summary, source: "custom", files: parseJson<SkillFileRecord[]>(filesJson, created.files, "filesJson"), selectedVersionId: created.selectedVersion.id })
      },
    }),
    "skills:update": tool({
      description: "Update a private workspace skill; filesJson replaces its complete file list.",
      inputSchema: z.object({ skillId: z.string(), title: z.string().optional(), summary: z.string().optional(), filesJson: z.string().optional() }),
      execute: async ({ skillId, title, summary, filesJson }) => {
        const current = await getSkillDetail(skillId)
        return saveSkillDraft(skillId, { title: title ?? current.skill.title, summary: summary ?? current.skill.summary, source: current.skill.source, files: parseJson<SkillFileRecord[]>(filesJson, current.files, "filesJson"), selectedVersionId: current.selectedVersion.id })
      },
    }),
    "skills:delete": tool({ description: "Delete a private workspace skill by ID.", inputSchema: z.object({ skillId: z.string() }), execute: ({ skillId }) => deleteSkill(skillId) }),
  }

  return selectTools(available, enabledIds) as Record<PrivateResourceToolId, never>
}
