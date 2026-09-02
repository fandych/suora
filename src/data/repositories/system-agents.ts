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
      workflowIds: [],
      skillIds: [],
      toolsetIds: [],
      documentIds: [],
    },
  },
  {
    agent: {
      id: "agent-skill-editor",
      title: "Skill Editor",
      kind: "system",
      summary: "Draft, revise, and structure skill bundles and SKILL.md content.",
      updatedAt: now - 24 * 60 * 60 * 1000,
    },
    versions: [
      { id: "agent-skill-editor-v1-0", major: 1, minor: 0, isRelease: true, createdAt: now - 24 * 60 * 60 * 1000, label: "v1.0" },
    ],
    latestVersion: { id: "agent-skill-editor-v1-0", major: 1, minor: 0, isRelease: true, createdAt: now - 24 * 60 * 60 * 1000, label: "v1.0" },
    selectedVersion: { id: "agent-skill-editor-v1-0", major: 1, minor: 0, isRelease: true, createdAt: now - 24 * 60 * 60 * 1000, label: "v1.0" },
    config: {
      instructions: "You are Skill Editor. Improve skills, structure SKILL.md clearly, keep examples concise, and prefer actionable edits.",
      providerId: "provider-openai",
      modelId: "gpt-5",
      workflowIds: [],
      skillIds: ["skill-agent-customization", "skill-plan"],
      toolsetIds: ["integration-cleanup-script"],
      documentIds: [],
    },
  },
  {
    agent: {
      id: "agent-document-editor",
      title: "Document Editor",
      kind: "system",
      summary: "Draft, rewrite, and organize workspace documents and references.",
      updatedAt: now - 2 * 24 * 60 * 60 * 1000,
    },
    versions: [
      { id: "agent-document-editor-v1-0", major: 1, minor: 0, isRelease: true, createdAt: now - 2 * 24 * 60 * 60 * 1000, label: "v1.0" },
    ],
    latestVersion: { id: "agent-document-editor-v1-0", major: 1, minor: 0, isRelease: true, createdAt: now - 2 * 24 * 60 * 60 * 1000, label: "v1.0" },
    selectedVersion: { id: "agent-document-editor-v1-0", major: 1, minor: 0, isRelease: true, createdAt: now - 2 * 24 * 60 * 60 * 1000, label: "v1.0" },
    config: {
      instructions: "You are Document Editor. Rewrite documents clearly, preserve structure, summarize linked references, and produce polished markdown output.",
      providerId: "provider-openai",
      modelId: "gpt-5",
      workflowIds: [],
      skillIds: ["skill-brand-tone"],
      toolsetIds: ["integration-webhook"],
      documentIds: ["document-product-manual", "document-deploy-guide"],
    },
  },
]

export const systemAgentMap = new Map(systemAgentDetails.map((detail) => [detail.agent.id, detail]))

export const systemAgentSummaries: AgentSummary[] = systemAgentDetails.map((detail) => detail.agent)