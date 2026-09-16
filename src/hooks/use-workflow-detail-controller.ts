import { useEffect, useMemo, useRef, useState } from "react"
import {
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react"
import { useNavigate, useParams } from "react-router"

import type { WorkflowEdgeData, WorkflowNodeData, WorkflowNotificationSettings } from "@/types/workflow"
import { AgentApi } from "@/services/agent-service"
import { DocumentApi } from "@/services/document-service"
import { IntegrationApi } from "@/services/integration-service"
import { ModelApi } from "@/services/model-service"
import { useAsyncResource } from "@/hooks/use-async-resource"
import { showToast } from "@/services/toast-service"
import {
  defaultWorkflowBindings,
  defaultWorkflowNotifications,
  workflowPresetNodes,
} from "@/lib/workflow/editor-config"
import { DEFAULT_WORKFLOW_DRY_RUN_INPUT, getAutoLayoutedWorkflowNodes } from "@/lib/workflow/editor-state"
import { parseDryRunObject } from "@/lib/workflow/panel-helpers"
import { useWorkflowTransferActions } from "@/hooks/use-workflow-transfer-actions"
import { useWorkflowNodeActions } from "@/hooks/use-workflow-node-actions"
import { useWorkflowValidation } from "@/hooks/use-workflow-validation"
import { useWorkflowRuntimeViewModel } from "@/hooks/use-workflow-runtime-view-model"
import { WorkflowApi } from "@/services/workflow-service"

export type InspectorMode = "closed" | "properties" | "try-run" | "history"

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 }

export function useWorkflowDetailController() {
  const { workflowId } = useParams<{ workflowId: string }>()
  const navigate = useNavigate()
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(
    () => WorkflowApi.get(workflowId ?? ""),
    [workflowId, selectedVersionId],
  )
  const { data: agentsData } = useAsyncResource(() => AgentApi.listAvailable(), [])
  const { data: providersData } = useAsyncResource(() => ModelApi.listAll(), [])
  const { data: documentsData } = useAsyncResource(() => DocumentApi.listAll(), [])
  const { data: integrationsData } = useAsyncResource(() => IntegrationApi.listAll(), [])

  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<WorkflowNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<WorkflowEdgeData>>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [resourceBindings, setResourceBindings] = useState(defaultWorkflowBindings)
  const [notifications, setNotifications] = useState<WorkflowNotificationSettings>(defaultWorkflowNotifications)
  const [dryRunInput, setDryRunInput] = useState(DEFAULT_WORKFLOW_DRY_RUN_INPUT)
  const [showLibrary, setShowLibrary] = useState(true)
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>("properties")
  const [isPreferenceDialogOpen, setIsPreferenceDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDryRunning, setIsDryRunning] = useState(false)
  const [dryRunError, setDryRunError] = useState<string | null>(null)
  const [selectedInvocationId, setSelectedInvocationId] = useState<string | null>(null)
  const [propertiesPanelWidth, setPropertiesPanelWidth] = useState(288)
  const [tryPanelWidth, setTryPanelWidth] = useState(320)
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT)
  const workflowRuntime = useWorkflowRuntimeViewModel()

  const flowRef = useRef<ReactFlowInstance<Node<WorkflowNodeData>, Edge> | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const agents = useMemo(() => agentsData ?? [], [agentsData])
  const documents = useMemo(() => documentsData ?? [], [documentsData])
  const integrations = useMemo(() => integrationsData ?? [], [integrationsData])
  const modelOptions = (providersData ?? []).flatMap((provider) =>
    provider.models.map((model) => ({ id: model.id, label: `${provider.title} / ${model.name}` })),
  )

  const applyViewport = (nextViewport: Viewport) => {
    setViewport(nextViewport)
    void flowRef.current?.setViewport(nextViewport, { duration: 0 })
  }
  const setFlowInstance = (instance: ReactFlowInstance<Node<WorkflowNodeData>, Edge> | null) => {
    flowRef.current = instance
  }

  useEffect(() => {
    if (!data) return
    setTitle(data.workflow.title)
    setSummary(data.workflow.summary)
    setNodes(data.definition.nodes)
    setEdges(data.definition.edges)
    setResourceBindings(data.definition.resourceBindings ?? defaultWorkflowBindings)
    setNotifications(data.definition.notifications ?? defaultWorkflowNotifications)
    setDryRunInput(data.definition.dryRunInputJson ?? DEFAULT_WORKFLOW_DRY_RUN_INPUT)
    setSelectedVersionId(data.selectedVersion.id)
    setSelectedNodeId(data.definition.nodes[0]?.id ?? null)
    applyViewport(data.definition.viewport ?? DEFAULT_VIEWPORT)
  }, [data, setEdges, setNodes])

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) ?? null, [nodes, selectedNodeId])
  const latestInvocation = workflowRuntime.invocation ?? data?.invocations[0] ?? null
  const selectedInvocation =
    (selectedInvocationId === workflowRuntime.invocation?.id ? workflowRuntime.invocation : undefined) ??
    data?.invocations.find((invocation) => invocation.id === selectedInvocationId) ??
    latestInvocation
  const { blockingIssues, currentDefinition, hasUnsavedChanges, visibleIssues } = useWorkflowValidation({
    title,
    summary,
    nodes,
    edges,
    viewport,
    resourceBindings,
    dryRunInput,
    notifications,
    savedDefinition: data?.definition,
    savedTitle: data?.workflow.title,
    savedSummary: data?.workflow.summary,
    availableAgentIds: agents.map((agent) => agent.id),
    availableDocumentIds: documents.map((document) => document.id),
    availableIntegrationIds: integrations.map((integration) => integration.id),
    availableModelIds: modelOptions.map((model) => model.id),
  })
  const isReleaseVersion = Boolean(data?.selectedVersion.isRelease)
  const isDraftVersion = Boolean(data && !data.selectedVersion.isRelease)
  const isReadOnly = isReleaseVersion
  const { handleExport, handleImport } = useWorkflowTransferActions({
    title,
    summary,
    definition: currentDefinition,
    versionLabel: data?.selectedVersion.label,
    isReadOnly,
    hasUnsavedChanges,
    importInputRef,
    setTitle,
    setSummary,
    setNodes,
    setEdges,
    setResourceBindings,
    setNotifications,
    setDryRunInput,
    setSelectedNodeId,
    applyViewport,
  })
  const nodeActions = useWorkflowNodeActions({
    nodes,
    edges,
    selectedNodeId,
    isReadOnly,
    setNodes,
    setEdges,
    setSelectedNodeId,
    setInspectorMode,
    deleteElements: (payload) => flowRef.current?.deleteElements(payload) ?? Promise.resolve(null),
  })
  const tracedNodes = useMemo<Node<WorkflowNodeData>[]>(() => {
    const traceMap = new Map(latestInvocation?.traces.map((trace) => [trace.nodeId, trace]) ?? [])
    return nodes.map((node) => {
      const trace = traceMap.get(node.id)
      if (!trace) {
        return { ...node, data: { ...node.data, executionStatus: undefined } }
      }

      return {
        ...node,
        type: "workflowNode",
        data: { ...node.data, executionStatus: trace.status },
        style: {
          border: trace.status === "success" ? "1px solid var(--color-primary)" : "1px solid var(--color-destructive)",
          boxShadow:
            trace.status === "success"
              ? "0 0 0 2px color-mix(in oklch,var(--color-primary),transparent 75%)"
              : "0 0 0 2px color-mix(in oklch,var(--color-destructive),transparent 75%)",
        },
      }
    })
  }, [latestInvocation, nodes])

  const handleSave = async () => {
    if (!workflowId || !data) {
      return
    }
    if (isReadOnly) {
      showToast({
        title: "Release revisions are read-only",
        description: "Switch back to a draft revision before editing this workflow.",
        type: "warning",
      })
      return
    }

    try {
      const next = await WorkflowApi.save({
        id: workflowId,
        title,
        summary,
        selectedVersionId: data.selectedVersion.id,
        definition: currentDefinition,
      })
      setData(next)
      setSelectedVersionId(next.selectedVersion.id)
    } catch (error) {
      showToast({
        title: "Save failed",
        description: error instanceof Error ? error.message : String(error),
        type: "error",
      })
    }
  }

  const handlePublish = async () => {
    if (!workflowId || !data) {
      return
    }
    if (!isDraftVersion) {
      showToast({
        title: "Select a draft revision",
        description: "Published revisions stay read-only. Switch to a draft before publishing a new release.",
        type: "warning",
      })
      return
    }
    if (hasUnsavedChanges) {
      showToast({
        title: "Save the draft first",
        description: "Publishing only works from the latest saved draft snapshot.",
        type: "warning",
      })
      return
    }
    if (blockingIssues[0]) {
      showToast({ title: "Resolve workflow issues", description: blockingIssues[0].message, type: "error" })
      return
    }

    try {
      const next = await WorkflowApi.save({
        id: workflowId,
        title: data.workflow.title,
        summary: data.workflow.summary,
        definition: data.definition,
        selectedVersionId: data.selectedVersion.id,
        publish: true,
      })
      setData(next)
      setSelectedVersionId(next.selectedVersion.id)
    } catch (error) {
      showToast({
        title: "Publish failed",
        description: error instanceof Error ? error.message : String(error),
        type: "error",
      })
    }
  }

  const handleRunRelease = async () => {
    if (!workflowId || !data) {
      return
    }
    if (!isReleaseVersion) {
      showToast({
        title: "Publish a release first",
        description: "Use Try run while iterating on a draft. Release run is reserved for published revisions.",
        type: "warning",
      })
      return
    }

    try {
      await workflowRuntime.start({
        workflowId,
        versionId: data.selectedVersion.id,
        definition: data.definition,
        input: {},
        mode: "manual",
      })
    } catch (error) {
      showToast({
        title: "Run failed",
        description: error instanceof Error ? error.message : String(error),
        type: "error",
      })
    }
  }

  const handleDryRun = async (inputValue = dryRunInput) => {
    if (!workflowId || !data) {
      return
    }
    if (isReadOnly) {
      showToast({
        title: "Switch to a draft revision",
        description: "Try run works from editable draft revisions so you can validate the current canvas state.",
        type: "warning",
      })
      return
    }
    if (blockingIssues[0]) {
      showToast({ title: "Resolve workflow issues", description: blockingIssues[0].message, type: "error" })
      return
    }

    try {
      const parsed = parseDryRunObject(inputValue)
      setDryRunError(null)
      setIsDryRunning(true)
      await workflowRuntime.start({
        workflowId,
        versionId: data.selectedVersion.id,
        definition: {
          ...currentDefinition,
          dryRunInputJson: JSON.stringify(parsed, null, 2),
        },
        input: parsed,
        mode: "dry-run",
      })
      setDryRunInput(JSON.stringify(parsed, null, 2))
    } catch (error) {
      setDryRunError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsDryRunning(false)
    }
  }

  const focusNode = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    setInspectorMode("properties")
    const node = nodes.find((item) => item.id === nodeId)
    if (node) {
      void flowRef.current?.fitView({ nodes: [node], duration: 350, maxZoom: 1.2, padding: 0.35 })
    }
  }

  const handleAutoLayout = () => {
    setNodes((current) => getAutoLayoutedWorkflowNodes({ nodes: current, edges }))
    void flowRef.current?.fitView({ padding: 0.2, duration: 250 })
  }

  const handleZoomStep = (delta: number) => {
    const currentZoom = flowRef.current?.getZoom() ?? viewport.zoom
    const nextZoom = Math.max(0.2, Math.min(2, Number((currentZoom + delta).toFixed(2))))
    void flowRef.current?.zoomTo(nextZoom, { duration: 150 })
  }

  const handleFitView = () => {
    void flowRef.current?.fitView({ padding: 0.2, duration: 200 })
  }

  const handleDeleteWorkflow = async () => {
    if (!workflowId || isDeleting) {
      return
    }

    setIsDeleting(true)
    try {
      const deleted = await WorkflowApi.remove(workflowId)
      if (!deleted) {
        showToast({ title: "Delete failed", description: "The workflow could not be deleted.", type: "error" })
        return
      }

      setIsDeleteDialogOpen(false)
      navigate("/workflows")
      showToast({ title: "Workflow deleted", description: "The workflow was removed.", type: "success" })
    } catch (error) {
      showToast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : String(error),
        type: "error",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return {
    agents,
    blockingIssues,
    canShowContent: !isLoading && !error && data,
    data,
    documents,
    dryRunInput,
    edges,
    error,
    dryRunError,
    flowRef,
    ...nodeActions,
    handleAutoLayout,
    focusNode,
    handleDeleteWorkflow,
    handleDryRun,
    handleExport,
    handleFitView,
    handleImport,
    handlePublish,
    handleRunRelease,
    handleSave,
    handleZoomStep,
    hasUnsavedChanges,
    importInputRef,
    setFlowInstance,
    inspectorMode,
    integrations,
    isDeleteDialogOpen,
    isDeleting,
    isDraftVersion,
    isDryRunning,
    isHistoryDialogOpen,
    isLoading,
    isPreferenceDialogOpen,
    isReadOnly,
    isReleaseVersion,
    workflowRuntime,
    modelOptions,
    nodes,
    notifications,
    onEdgesChange,
    onNodesChange,
    reload,
    propertiesPanelWidth,
    resourceBindings,
    selectedNode,
    selectedNodeId,
    setData,
    setDryRunInput,
    setEdges,
    setInspectorMode,
    setIsDeleteDialogOpen,
    selectedInvocation,
    selectedInvocationId,
    setIsHistoryDialogOpen,
    setIsPreferenceDialogOpen,
    setNotifications,
    setResourceBindings,
    setSelectedInvocationId,
    setSelectedNodeId,
    setSelectedVersionId,
    setPropertiesPanelWidth,
    setShowLibrary,
    setSummary,
    setTitle,
    setTryPanelWidth,
    setViewport,
    showLibrary,
    summary,
    title,
    tracedNodes,
    tryPanelWidth,
    viewport,
    visibleIssues,
    workflowPresetNodes,
  }
}
