import type { AgentPayload } from "@/types/agent"

const now = Date.now()

export const documentEditor: AgentPayload = {
  agent: {
    id: "agent-document-editor",
    title: "Document Editor",
    kind: "system",
    summary: "Create and manage private workspace documents.",
    updatedAt: now,
    source: "system",
  },
  versions: [
    {
      id: "agent-document-editor-v1-0",
      major: 1,
      minor: 0,
      isRelease: true,
      createdAt: now,
      configJson: JSON.stringify({
        instructions: "You are the Document Editor. Manage only private workspace documents.",
        providerId: "",
        modelId: "",
        maxSteps: 100,
        workflowIds: [],
        skillIds: [],
        toolsetIds: [],
        documentIds: [],
        privateToolIds: ["list", "get", "create", "update", "delete"].map((action) => `documents:${action}`),
      }),
    },
  ],
}
