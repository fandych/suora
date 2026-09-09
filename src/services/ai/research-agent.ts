import { ToolLoopAgent, stepCountIs, tool } from "ai"
import { z } from "zod"

import type { ChatRuntimeSettings } from "@/data/repositories/chat-settings-repository"
import { getDocumentDetail } from "@/data/repositories/document-repository"
import { getSkillDetail } from "@/data/repositories/skill-repository"
import { getWorkflowDetail } from "@/data/repositories/workflow-repository"
import { createChatLanguageModel } from "@/services/ai/model-provider-factory"
import { listScopedDocuments, listScopedSkills, listScopedWorkflows } from "@/services/ai/tools/resource-search-tools"

export type ResearchResourceScope = {
  documents: Array<Awaited<ReturnType<typeof getDocumentDetail>> | null>
  skills: Array<Awaited<ReturnType<typeof getSkillDetail>> | null>
  workflows: Array<Awaited<ReturnType<typeof getWorkflowDetail>> | null>
}

export async function createResearchAgent(settings: ChatRuntimeSettings, maxSteps: number, scope: ResearchResourceScope) {
  const model = createChatLanguageModel(settings)
  const hasDocumentScope = scope.documents.length > 0
  const hasSkillScope = scope.skills.length > 0
  const hasWorkflowScope = scope.workflows.length > 0

  return new ToolLoopAgent({
    model,
    instructions: "You are a focused research subagent. Summarize only the relevant facts from the provided workspace tools.",
    stopWhen: stepCountIs(maxSteps),
    tools: {
      listDocuments: tool({ description: "List available documents in the workspace.", inputSchema: z.object({}), execute: async () => (await listScopedDocuments(hasDocumentScope, scope.documents)).map((item) => ({ id: item.id, title: item.title, summary: item.summary })) }),
      listWorkflows: tool({ description: "List available workflows in the workspace.", inputSchema: z.object({}), execute: async () => (await listScopedWorkflows(hasWorkflowScope, scope.workflows)).map((item) => ({ id: item.id, title: item.title, summary: item.summary })) }),
      listSkills: tool({ description: "List available skills in the workspace.", inputSchema: z.object({}), execute: async () => (await listScopedSkills(hasSkillScope, scope.skills)).map((item) => ({ id: item.id, title: item.title, summary: item.summary })) }),
    },
  })
}
