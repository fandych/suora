import type { WorkflowDefinition, WorkflowDetail } from "@/data/domain/models"
import { deleteWorkflow as deleteWorkflowRepository, publishWorkflowVersion as publishWorkflowVersionRepository, saveWorkflowDraft as saveWorkflowDraftRepository } from "@/data/repositories/workflow-repository"

export function saveWorkflowDraft(input: {
  workflowId: string
  title: string
  summary: string
  definition: WorkflowDefinition
  selectedVersionId?: string
}) {
  return saveWorkflowDraftRepository(input.workflowId, {
    title: input.title,
    summary: input.summary,
    definition: input.definition,
    selectedVersionId: input.selectedVersionId,
  })
}

export function publishWorkflowVersion(workflowId: string, versionId: string) {
  return publishWorkflowVersionRepository(workflowId, versionId)
}

export function deleteWorkflow(workflowId: string) {
  return deleteWorkflowRepository(workflowId)
}

export type WorkflowPublishResult = WorkflowDetail
