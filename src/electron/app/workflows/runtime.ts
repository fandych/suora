import { z } from "zod"
import { normalizeWorkflowDefinition } from "@/electron/app/workflows/normalizer"
import type { WorkflowDefinition, WorkflowRunStartCommand } from "@/types/workflow"
import { validateWorkflowNodes } from "@/electron/app/workflows/validator"
import { agentService } from "@/electron/app/agents/service"
import { documentService } from "@/electron/app/documents/service"
import { integrationApplicationService } from "@/electron/app/integrations/service"
import { modelService } from "@/electron/app/models/service"

const workflowRunSchema = z.object({
  requestId: z.string().min(1).max(128),
  workflowId: z.string().min(1),
  versionId: z.string().min(1),
  definition: z.unknown(),
  input: z.unknown(),
  mode: z.enum(["dry-run", "manual"]),
})

export type WorkflowRunCommand = WorkflowRunStartCommand

export async function executeWorkflowRun(command: unknown) {
  const parsed = workflowRunSchema.parse(command)
  const definition = normalizeWorkflowDefinition(parsed.definition) as WorkflowDefinition
  const [agents, documents, integrations, providers] = await Promise.all([
    agentService.list(),
    documentService.list(),
    integrationApplicationService.list(),
    modelService.list(),
  ])
  const issues = validateWorkflowNodes({
    nodes: definition.nodes,
    edges: definition.edges,
    availableAgentIds: agents.map((item) => item.id),
    availableDocumentIds: documents.map((item) => item.id),
    availableIntegrationIds: integrations.map((item) => item.id),
    availableModelIds: providers.flatMap((provider) => provider.models.map((model) => model.id)),
  })
  const blockingIssues = issues.filter((issue) => issue.severity === "error")
  if (blockingIssues.length > 0)
    throw new Error(
      `Workflow validation failed: ${blockingIssues
        .slice(0, 5)
        .map((issue) => issue.message)
        .join("; ")}`,
    )
  return {
    requestId: parsed.requestId,
    workflowId: parsed.workflowId,
    versionId: parsed.versionId,
    mode: parsed.mode,
    definition: definition as WorkflowRunStartCommand["definition"],
    input: parsed.input,
  } satisfies WorkflowRunStartCommand
}
