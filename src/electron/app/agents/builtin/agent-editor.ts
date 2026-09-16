import type { AgentPayload } from "@/types/agent"

const now = Date.now()

export const agentEditor: AgentPayload = {
  agent: {
    id: "agent-agent-editor",
    title: "Agent Editor",
    kind: "system",
    summary: "Create and manage private custom workspace agents.",
    updatedAt: now,
    source: "system",
  },
  versions: [
    {
      id: "agent-agent-editor-v1-0",
      major: 1,
      minor: 0,
      isRelease: true,
      createdAt: now,
      configJson: JSON.stringify({
        instructions: "You are the Agent Editor. Manage only private workspace agents.",
        providerId: "",
        modelId: "",
        maxSteps: 100,
        workflowIds: [],
        skillIds: [],
        toolsetIds: [],
        documentIds: [],
        privateToolIds: ["list", "get", "create", "update", "delete"].map((action) => `agents:${action}`),
      }),
    },
  ],
}
