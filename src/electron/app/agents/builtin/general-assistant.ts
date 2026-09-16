import type { AgentPayload } from "@/types/agent"

const now = Date.now()

export const generateAgent: AgentPayload = {
  agent: {
    id: "agent-general-assistant",
    title: "通用助手",
    kind: "system",
    summary: "General-purpose assistant for everyday workspace questions and operations.",
    updatedAt: now,
    source: "system",
  },
  versions: [
    {
      id: "agent-general-assistant-v1-0",
      major: 1,
      minor: 0,
      isRelease: true,
      createdAt: now,
      configJson: JSON.stringify({
        instructions:
          "You are 通用助手. Help across chats, documents, integrations, and workflows. Prefer grounded tool use when workspace data is available.",
        providerId: "",
        modelId: "",
        maxSteps: 500,
        workflowIds: [],
        skillIds: [],
        toolsetIds: [],
        documentIds: [],
      }),
    },
  ],
}