import { useMemo } from "react"
import type { Edge, Node } from "@xyflow/react"
import type { WorkflowDefinition, WorkflowEdgeData, WorkflowNodeData } from "@/types/workflow"
import {
  buildWorkflowFingerprint,
  DEFAULT_WORKFLOW_DRY_RUN_INPUT,
  getWorkflowDesignIssues,
  getWorkflowDryRunInputIssue,
} from "@/lib/workflow/editor-state"
import { defaultWorkflowBindings, defaultWorkflowNotifications } from "@/lib/workflow/editor-config"
import { validateWorkflowNodeProperties } from "@/lib/workflow/validator/node-properties"

type WorkflowValidationInput = {
  title: string
  summary: string
  nodes: Node<WorkflowNodeData>[]
  edges: Edge<WorkflowEdgeData>[]
  viewport: WorkflowDefinition["viewport"]
  resourceBindings: WorkflowDefinition["resourceBindings"]
  dryRunInput: string
  notifications: WorkflowDefinition["notifications"]
  savedDefinition?: WorkflowDefinition
  savedTitle?: string
  savedSummary?: string
  availableAgentIds: string[]
  availableDocumentIds: string[]
  availableIntegrationIds: string[]
  availableModelIds: string[]
}

export function useWorkflowValidation(input: WorkflowValidationInput) {
  const currentDefinition = useMemo<WorkflowDefinition>(
    () => ({
      nodes: input.nodes,
      edges: input.edges,
      viewport: input.viewport,
      resourceBindings: input.resourceBindings,
      dryRunInputJson: input.dryRunInput,
      variables: input.savedDefinition?.variables ?? [],
      budget: input.savedDefinition?.budget,
      notifications: input.notifications,
    }),
    [
      input.dryRunInput,
      input.edges,
      input.notifications,
      input.nodes,
      input.resourceBindings,
      input.savedDefinition?.budget,
      input.savedDefinition?.variables,
      input.viewport,
    ],
  )

  const designIssues = useMemo(
    () =>
      [
        ...getWorkflowDesignIssues({
          nodes: input.nodes,
          edges: input.edges,
          availableAgentIds: input.availableAgentIds,
          availableDocumentIds: input.availableDocumentIds,
          availableIntegrationIds: input.availableIntegrationIds,
          availableModelIds: input.availableModelIds,
        }),
        ...input.nodes.flatMap((node) =>
          validateWorkflowNodeProperties(node, {
            availableAgentIds: input.availableAgentIds,
            availableDocumentIds: input.availableDocumentIds,
            availableIntegrationIds: input.availableIntegrationIds,
            availableModelIds: input.availableModelIds,
          }),
        ),
      ].filter(
        (issue, index, issues) =>
          issues.findIndex((candidate) => candidate.nodeId === issue.nodeId && candidate.message === issue.message) ===
          index,
      ),
    [
      input.availableAgentIds,
      input.availableDocumentIds,
      input.availableIntegrationIds,
      input.availableModelIds,
      input.edges,
      input.nodes,
    ],
  )
  const dryRunInputIssue = useMemo(() => getWorkflowDryRunInputIssue(input.dryRunInput), [input.dryRunInput])
  const visibleIssues = useMemo(
    () => (dryRunInputIssue ? [...designIssues, dryRunInputIssue] : designIssues),
    [designIssues, dryRunInputIssue],
  )
  const blockingIssues = useMemo(() => visibleIssues.filter((issue) => issue.severity === "error"), [visibleIssues])
  const currentFingerprint = useMemo(
    () => buildWorkflowFingerprint({ title: input.title, summary: input.summary, definition: currentDefinition }),
    [currentDefinition, input.summary, input.title],
  )
  const savedFingerprint = useMemo(() => {
    if (!input.savedDefinition || input.savedTitle == null || input.savedSummary == null) return ""
    return buildWorkflowFingerprint({
      title: input.savedTitle,
      summary: input.savedSummary,
      definition: {
        ...input.savedDefinition,
        viewport: input.savedDefinition.viewport ?? { x: 0, y: 0, zoom: 1 },
        resourceBindings: input.savedDefinition.resourceBindings ?? defaultWorkflowBindings,
        dryRunInputJson: input.savedDefinition.dryRunInputJson ?? DEFAULT_WORKFLOW_DRY_RUN_INPUT,
        notifications: input.savedDefinition.notifications ?? defaultWorkflowNotifications,
      },
    })
  }, [input.savedDefinition, input.savedSummary, input.savedTitle])

  return {
    blockingIssues,
    currentDefinition,
    hasUnsavedChanges: Boolean(input.savedDefinition) && currentFingerprint !== savedFingerprint,
    visibleIssues,
  }
}
