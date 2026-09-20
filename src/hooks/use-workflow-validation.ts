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
import { validateNodeProperties } from "@/lib/workflow/validator/node"

type WorkflowValidationInput = {
  title: string
  summary: string
  nodes: Node<WorkflowNodeData>[]
  edges: Edge<WorkflowEdgeData>[]
  viewport: WorkflowDefinition["viewport"]
  resourceBindings: WorkflowDefinition["resourceBindings"]
  dryRunInput: string
  notifications: WorkflowDefinition["notifications"]
  variables: WorkflowDefinition["variables"]
  budget: WorkflowDefinition["budget"]
  savedDefinition?: WorkflowDefinition
  savedTitle?: string
  savedSummary?: string
  availableAgentIds: string[]
  availableDocumentIds: string[]
  availableIntegrationIds: string[]
  availableModelIds: string[]
}

export function useWorkflowValidation(input: WorkflowValidationInput) {
  const availableAgentIdsKey = input.availableAgentIds.join("\u0000")
  const availableDocumentIdsKey = input.availableDocumentIds.join("\u0000")
  const availableIntegrationIdsKey = input.availableIntegrationIds.join("\u0000")
  const availableModelIdsKey = input.availableModelIds.join("\u0000")
  const availableAgentIds = useMemo(() => (availableAgentIdsKey ? availableAgentIdsKey.split("\u0000") : []), [availableAgentIdsKey])
  const availableDocumentIds = useMemo(() => (availableDocumentIdsKey ? availableDocumentIdsKey.split("\u0000") : []), [availableDocumentIdsKey])
  const availableIntegrationIds = useMemo(
    () => (availableIntegrationIdsKey ? availableIntegrationIdsKey.split("\u0000") : []),
    [availableIntegrationIdsKey],
  )
  const availableModelIds = useMemo(() => (availableModelIdsKey ? availableModelIdsKey.split("\u0000") : []), [availableModelIdsKey])

  const currentDefinition = useMemo<WorkflowDefinition>(
    () => ({
      nodes: input.nodes,
      edges: input.edges,
      viewport: input.viewport,
      resourceBindings: input.resourceBindings,
      dryRunInputJson: input.dryRunInput,
      variables: input.variables ?? [],
      budget: input.budget,
      notifications: input.notifications,
    }),
    [
      input.dryRunInput,
      input.edges,
      input.notifications,
      input.nodes,
      input.resourceBindings,
      input.budget,
      input.variables,
      input.viewport,
    ],
  )

  const designIssues = useMemo(
    () =>
      [
        ...getWorkflowDesignIssues({
          nodes: input.nodes,
          edges: input.edges,
          availableAgentIds,
          availableDocumentIds,
          availableIntegrationIds,
          availableModelIds,
        }),
        ...input.nodes.flatMap((node) =>
          validateNodeProperties(node, {
            availableAgentIds,
            availableDocumentIds,
            availableIntegrationIds,
            availableModelIds,
          }),
        ),
      ].filter(
        (issue, index, issues) =>
          issues.findIndex((candidate) => candidate.nodeId === issue.nodeId && candidate.message === issue.message) ===
          index,
      ),
    [
      availableAgentIds,
      availableDocumentIds,
      availableIntegrationIds,
      availableModelIds,
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
