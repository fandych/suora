import type { AgentDetail, AgentSummary } from "@/data/domain/models"

const now = Date.now()

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
]

export const systemAgentMap = new Map(systemAgentDetails.map((detail) => [detail.agent.id, detail]))

export const systemAgentSummaries: AgentSummary[] = systemAgentDetails.map((detail) => detail.agent)