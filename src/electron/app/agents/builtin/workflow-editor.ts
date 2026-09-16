import type { AgentPayload } from "@/types/agent"

const now = Date.now()

export const workflowEditor: AgentPayload = {
  agent: {
    id: "agent-workflow-editor",
    title: "Workflow Editor",
    kind: "system",
    summary: "Create and manage private workspace workflows.",
    updatedAt: now,
    source: "system",
  },
  versions: [
    {
      id: "agent-workflow-editor-v1-0",
      major: 1,
      minor: 0,
      isRelease: true,
      createdAt: now,
      configJson: JSON.stringify({
        instructions: "You are the Workflow Editor. Manage only private workspace workflows.",
        providerId: "",
        modelId: "",
        maxSteps: 100,
        workflowIds: [],
        skillIds: [],
        toolsetIds: [],
        documentIds: [],
        privateToolIds: ["list", "get", "create", "update", "delete"].map((action) => `workflows:${action}`),
      }),
    },
  ],
}
