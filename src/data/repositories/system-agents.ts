import type { AgentDetail, AgentSummary } from "@/data/domain/models"

const now = Date.now()

function createEditorAgent(input: { id: string; title: string; summary: string; resource: string }) : AgentDetail {
  return {
    agent: { id: input.id, title: input.title, kind: "system", summary: input.summary, updatedAt: now, source: "system" },
    versions: [{ id: `${input.id}-v1-0`, major: 1, minor: 0, isRelease: true, createdAt: now, label: "v1.0" }],
    latestVersion: { id: `${input.id}-v1-0`, major: 1, minor: 0, isRelease: true, createdAt: now, label: "v1.0" },
    selectedVersion: { id: `${input.id}-v1-0`, major: 1, minor: 0, isRelease: true, createdAt: now, label: "v1.0" },
    config: {
      instructions: `You are the ${input.title}. Manage only private workspace ${input.resource}. Use the provided ${input.resource} CRUD tools to inspect and make changes. Confirm the target and intended result before deleting a resource.`,
      providerId: "",
      modelId: "",
      maxSteps: 100,
      workflowIds: [],
      skillIds: [],
      toolsetIds: [],
      documentIds: [],
      privateToolIds: ["list", "get", "create", "update", "delete"].map((action) => `${input.resource}:${action}`),
    },
  }
}

export const systemAgentDetails: AgentDetail[] = [
  {
    agent: {
      id: "agent-general-assistant",
      title: "通用助手",
      kind: "system",
      summary: "General-purpose assistant for everyday workspace questions and operations.",
      updatedAt: now,
      source: "system",
    },
    versions: [
      { id: "agent-general-assistant-v1-0", major: 1, minor: 0, isRelease: true, createdAt: now, label: "v1.0" },
    ],
    latestVersion: { id: "agent-general-assistant-v1-0", major: 1, minor: 0, isRelease: true, createdAt: now, label: "v1.0" },
    selectedVersion: { id: "agent-general-assistant-v1-0", major: 1, minor: 0, isRelease: true, createdAt: now, label: "v1.0" },
    config: {
      instructions: "You are 通用助手. Help across chats, documents, integrations, and workflows. Prefer grounded tool use when workspace data is available.",
      providerId: "",
      modelId: "",
      maxSteps: 500,
      workflowIds: [],
      skillIds: [],
      toolsetIds: [],
      documentIds: [],
    },
  },
  createEditorAgent({ id: "agent-document-editor", title: "Document Editor", summary: "Create and manage private workspace documents.", resource: "documents" }),
  createEditorAgent({ id: "agent-workflow-editor", title: "Workflow Editor", summary: "Create and manage private workspace workflows.", resource: "workflows" }),
  createEditorAgent({ id: "agent-agent-editor", title: "Agent Editor", summary: "Create and manage private custom workspace agents.", resource: "agents" }),
  createEditorAgent({ id: "agent-skill-editor", title: "Skill Editor", summary: "Create and manage private workspace skills.", resource: "skills" }),
]

export const systemAgentMap = new Map(systemAgentDetails.map((detail) => [detail.agent.id, detail]))

export const systemAgentSummaries: AgentSummary[] = systemAgentDetails.map((detail) => detail.agent)