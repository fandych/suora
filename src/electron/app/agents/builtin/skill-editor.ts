import type { AgentPayload } from "@/types/agent"

const now = Date.now()

export const skillEditor: AgentPayload = {
  agent: {
    id: "agent-skill-editor",
    title: "Skill Editor",
    kind: "system",
    summary: "Create and manage private workspace skills.",
    updatedAt: now,
    source: "system",
  },
  versions: [
    {
      id: "agent-skill-editor-v1-0",
      major: 1,
      minor: 0,
      isRelease: true,
      createdAt: now,
      label: "1.0 (Release)",
      configJson: JSON.stringify({
        instructions: "You are the Skill Editor. Manage only private workspace skills.",
        providerId: "",
        modelId: "",
        maxSteps: 100,
        workflowIds: [],
        skillIds: [],
        toolsetIds: [],
        documentIds: [],
        privateToolIds: ["list", "get", "create", "update", "delete"].map((action) => `skills:${action}`),
      }),
    },
  ],
}
