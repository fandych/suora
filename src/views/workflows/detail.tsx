import { useEffect, useMemo, useRef, useState } from "react"
import { Background, Controls, Panel, ReactFlow, addEdge, useEdgesState, useNodesState, type Connection, type Edge, type Node, type NodeMouseHandler } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useParams } from "react-router"
import { listAgents } from "@/data/repositories/agent-repository"
import { listDocuments } from "@/data/repositories/document-repository"
import { listIntegrationSummaries } from "@/data/repositories/integration-repository"
import { listConfiguredModelProviders } from "@/data/repositories/model-config-repository"
import { showToast } from "@/lib/app-toast"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { createWorkflowNodeData, defaultWorkflowBindings, workflowPresetNodes } from "@/views/workflows/components/workflow-editor-config"
import { DEFAULT_WORKFLOW_DRY_RUN_INPUT, buildWorkflowFingerprint, getWorkflowDesignIssues, getWorkflowDryRunInputIssue } from "@/views/workflows/components/workflow-editor-state"
import { WorkflowHeaderActions } from "@/views/workflows/components/workflow-header-actions"
import { WorkflowInspectorShell } from "@/views/workflows/components/workflow-inspector-shell"
import { WorkflowStatusPill } from "@/views/workflows/components/workflow-status-pill"
import { workflowNodeTypes } from "@/views/workflows/components/workflow-canvas-node"
import { WorkflowPropertiesPanel } from "@/views/workflows/components/workflow-properties-panel"
import { exportWorkflowJson, parseWorkflowJson } from "@/views/workflows/components/workflow-transfer"
import { WorkflowDesignIssuesSummary, WorkflowLibraryPanel } from "@/views/workflows/components/workflow-workbench-panels"
import { useAsyncResource } from "@/hooks/use-async-resource"
import type { WorkflowNodeData } from "@/data/domain/models"
import { dryRunWorkflowSnapshot, getWorkflowDetail, publishWorkflowVersion, runWorkflow, saveWorkflowDraft } from "@/data/repositories/workflow-repository"

const WorkflowDetailPage = () => {
  const { workflowId } = useParams<{ workflowId: string }>()
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(
    () => getWorkflowDetail(workflowId ?? "", selectedVersionId),
    [workflowId, selectedVersionId]
  )
  const { data: agentsData } = useAsyncResource(() => listAgents(), [])
  const { data: providersData } = useAsyncResource(() => listConfiguredModelProviders(), [])
  const { data: documentsData } = useAsyncResource(() => listDocuments(), [])
  const { data: integrationsData } = useAsyncResource(() => listIntegrationSummaries(), [])
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<WorkflowNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [resourceBindings, setResourceBindings] = useState(defaultWorkflowBindings)
  const [dryRunInput, setDryRunInput] = useState(DEFAULT_WORKFLOW_DRY_RUN_INPUT)
  const [libraryQuery, setLibraryQuery] = useState("")
  const [showLibrary, setShowLibrary] = useState(true)
  const [showInspector, setShowInspector] = useState(true)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const agents = agentsData ?? []
  const documents = documentsData ?? []
  const integrations = integrationsData ?? []
  const modelOptions = (providersData ?? []).flatMap((provider) => provider.models.map((model) => ({ id: model.id, label: `${provider.title} / ${model.name}` })))

  useEffect(() => {
    if (!data) {
      return
    }
    setTitle(data.workflow.title)
    setSummary(data.workflow.summary)
    setNodes(data.definition.nodes)
    setEdges(data.definition.edges)
    setResourceBindings(data.definition.resourceBindings ?? defaultWorkflowBindings)
    setDryRunInput(data.definition.dryRunInputJson ?? DEFAULT_WORKFLOW_DRY_RUN_INPUT)
    setSelectedVersionId(data.selectedVersion.id)
    setSelectedNodeId(data.definition.nodes[0]?.id ?? null)
  }, [data, setEdges, setNodes])

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) ?? null, [nodes, selectedNodeId])
  const latestInvocation = data?.invocations[0] ?? null
  const currentDefinition = useMemo(() => ({
    nodes,
    edges,
    viewport: data?.definition.viewport ?? { x: 0, y: 0, zoom: 1 },
    resourceBindings,
    dryRunInputJson: dryRunInput,
    variables: data?.definition.variables ?? [],
    budget: data?.definition.budget,
  }), [data, dryRunInput, edges, nodes, resourceBindings])
  const nodeSearchResults = useMemo(() => {
    const keyword = libraryQuery.trim().toLowerCase()
    if (!keyword) {
      return []
    }
    return nodes.filter((node) => `${node.data.label} ${node.data.task ?? ""} ${node.data.kind}`.toLowerCase().includes(keyword))
  }, [libraryQuery, nodes])
  const designIssues = useMemo(() => getWorkflowDesignIssues({
    nodes,
    edges,
    availableAgentIds: agents.map((agent) => agent.id),
    availableDocumentIds: documents.map((document) => document.id),
    availableIntegrationIds: integrations.map((integration) => integration.id),
    availableModelIds: modelOptions.map((model) => model.id),
  }), [agents, documents, edges, integrations, modelOptions, nodes])
  const dryRunInputIssue = useMemo(() => getWorkflowDryRunInputIssue(dryRunInput), [dryRunInput])
  const visibleIssues = useMemo(() => dryRunInputIssue ? [...designIssues, dryRunInputIssue] : designIssues, [designIssues, dryRunInputIssue])
  const blockingIssues = useMemo(() => visibleIssues.filter((issue) => issue.severity === "error"), [visibleIssues])
  const currentFingerprint = useMemo(() => buildWorkflowFingerprint({ title, summary, definition: currentDefinition }), [currentDefinition, summary, title])
  const savedFingerprint = useMemo(() => {
    if (!data) {
      return ""
    }

    return buildWorkflowFingerprint({
      title: data.workflow.title,
      summary: data.workflow.summary,
      definition: {
        ...data.definition,
        resourceBindings: data.definition.resourceBindings ?? defaultWorkflowBindings,
        dryRunInputJson: data.definition.dryRunInputJson ?? DEFAULT_WORKFLOW_DRY_RUN_INPUT,
      },
    })
  }, [data])
  const hasUnsavedChanges = Boolean(data) && currentFingerprint !== savedFingerprint
  const isReleaseVersion = Boolean(data?.selectedVersion.isRelease)
  const isDraftVersion = Boolean(data && !data.selectedVersion.isRelease)
  const isReadOnly = isReleaseVersion
  const tracedNodes = useMemo(() => {
    const traceMap = new Map(latestInvocation?.traces.map((trace) => [trace.nodeId, trace]) ?? [])
    return nodes.map((node) => {
      const trace = traceMap.get(node.id)
      if (!trace) {
        return node
      }

      return {
        ...node,
        type: "workflowNode",
        style: {
          border: trace.status === "success" ? "1px solid var(--color-primary)" : "1px solid var(--color-destructive)",
          boxShadow: trace.status === "success" ? "0 0 0 2px color-mix(in oklch,var(--color-primary),transparent 75%)" : "0 0 0 2px color-mix(in oklch,var(--color-destructive),transparent 75%)",
        },
      }
    })
  }, [latestInvocation, nodes])

  const handleConnect = (connection: Connection) => {
    if (isReadOnly) {
      return
    }
    setEdges((current) => addEdge(connection, current))
  }

  const handleSave = async () => {
    if (!workflowId || !data) {
      return
    }
    if (isReadOnly) {
      showToast({ title: "Release revisions are read-only", description: "Switch back to a draft revision before editing this workflow.", type: "warning" })
      return
    }
    const next = await saveWorkflowDraft(workflowId, {
      title,
      summary,
      selectedVersionId: data?.selectedVersion.id,
      definition: currentDefinition,
    })

    setData(next)
    setSelectedVersionId(next.selectedVersion.id)
  }

  const handlePublish = async () => {
    if (!workflowId || !data) {
      return
    }
    if (!isDraftVersion) {
      showToast({ title: "Select a draft revision", description: "Published revisions stay read-only. Switch to a draft before publishing a new release.", type: "warning" })
      return
    }
    if (hasUnsavedChanges) {
      showToast({ title: "Save the draft first", description: "Publishing only works from the latest saved draft snapshot.", type: "warning" })
      return
    }
    if (blockingIssues[0]) {
      showToast({ title: "Resolve workflow issues", description: blockingIssues[0].message, type: "error" })
      return
    }
    const next = await publishWorkflowVersion(workflowId, data.selectedVersion.id)
    setData(next)
    setSelectedVersionId(next.selectedVersion.id)
  }

  const handleRunRelease = async () => {
    if (!workflowId || !data) {
      return
    }
    if (!isReleaseVersion) {
      showToast({ title: "Publish a release first", description: "Use Dry run while iterating on a draft. Header Run is reserved for published revisions.", type: "warning" })
      return
    }
    const next = await runWorkflow(workflowId, data.selectedVersion.id)
    setData(next)
  }

  const handleDryRun = async () => {
    if (!workflowId || !data) {
      return
    }
    if (isReadOnly) {
      showToast({ title: "Switch to a draft revision", description: "Dry run works from editable draft revisions so you can test the current canvas state.", type: "warning" })
      return
    }
    if (blockingIssues[0]) {
      showToast({ title: "Resolve workflow issues", description: blockingIssues[0].message, type: "error" })
      return
    }
    const invocation = await dryRunWorkflowSnapshot({
      workflowId,
      workflowTitle: title || data.workflow.title,
      selectedVersion: data.selectedVersion,
      definition: currentDefinition,
    })

    setData((current) => current ? { ...current, invocations: [invocation, ...current.invocations] } : current)
  }

  const handleNodeClick: NodeMouseHandler<Node<WorkflowNodeData>> = (_event, node) => setSelectedNodeId(node.id)

  const handleAddNode = () => {
    if (isReadOnly) {
      return
    }
    const nextIndex = nodes.length + 1
    const nextId = `node-${nextIndex}`
    setNodes((current) => [
      ...current,
      {
        id: nextId,
        type: "workflowNode",
        position: { x: 220 + current.length * 120, y: 260 },
        data: createWorkflowNodeData("agent", nextIndex),
      },
    ])
    setSelectedNodeId(nextId)
  }

  const handleAddPresetNode = (kind: WorkflowNodeData["kind"]) => {
    if (isReadOnly) {
      return
    }
    const nextIndex = nodes.length + 1
    const nextId = `${kind}-${nextIndex}`
    setNodes((current) => [
      ...current,
      {
        id: nextId,
        type: "workflowNode",
        position: { x: 120 + current.length * 120, y: 120 + (current.length % 3) * 90 },
        data: createWorkflowNodeData(kind, nextIndex),
      },
    ])
    setSelectedNodeId(nextId)
  }

  const handleSelectedNodeChange = (patch: Partial<WorkflowNodeData>) => {
    if (!selectedNodeId || isReadOnly) {
      return
    }
    setNodes((current) => current.map((node) => node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node))
  }

  const handleDuplicateNode = () => {
    if (!selectedNode || isReadOnly) {
      return
    }
    const nextId = `${selectedNode.id}-copy-${nodes.length + 1}`
    setNodes((current) => [...current, { ...selectedNode, id: nextId, position: { x: selectedNode.position.x + 48, y: selectedNode.position.y + 48 } }])
    setSelectedNodeId(nextId)
  }

  const handleDeleteNode = () => {
    if (!selectedNodeId || isReadOnly) {
      return
    }

    setNodes((current) => current.filter((node) => node.id !== selectedNodeId))
    setEdges((current) => current.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId))
    setSelectedNodeId(null)
  }

  const handleExport = () => {
    if (!data) {
      return
    }

    exportWorkflowJson({ title, summary, definition: currentDefinition, versionLabel: data.selectedVersion.label })
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) {
      event.target.value = ""
      return
    }

    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) {
      return
    }

    const payload = parseWorkflowJson(await file.text())
    setTitle(payload.title)
    setSummary(payload.summary)
    setNodes(payload.definition.nodes)
    setEdges(payload.definition.edges)
    setResourceBindings(payload.definition.resourceBindings ?? defaultWorkflowBindings)
    setDryRunInput(payload.definition.dryRunInputJson ?? "{}")
    setSelectedNodeId(payload.definition.nodes[0]?.id ?? null)
  }

  const filteredPresets = useMemo(() => {
    const keyword = libraryQuery.trim().toLowerCase()
    if (!keyword) {
      return workflowPresetNodes
    }

    return workflowPresetNodes.filter((item) => `${item.label} ${item.summary} ${item.kind}`.toLowerCase().includes(keyword))
  }, [libraryQuery])

  const canShowContent = !isLoading && !error && data

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={data?.workflow.title ?? "Workflow"}
        description="Forhub-style workflow editor with a full-width graph canvas and compact side panels."
        actions={data ? (
          <WorkflowHeaderActions
            versions={data.versions}
            selectedVersionId={data.selectedVersion.id}
            onVersionChange={setSelectedVersionId}
            isReleaseVersion={isReleaseVersion}
            hasUnsavedChanges={hasUnsavedChanges}
            issueCount={visibleIssues.length}
            showLibrary={showLibrary}
            showInspector={showInspector}
            canRunRelease={isReleaseVersion}
            canSaveDraft={!isReadOnly && hasUnsavedChanges}
            canPublish={isDraftVersion && !hasUnsavedChanges && blockingIssues.length === 0}
            onToggleLibrary={() => setShowLibrary((value) => !value)}
            onToggleInspector={() => setShowInspector((value) => !value)}
            onRunRelease={handleRunRelease}
            onSaveDraft={handleSave}
            onPublish={handlePublish}
            onExport={handleExport}
            onImport={() => importInputRef.current?.click()}
            importInputRef={importInputRef}
            onImportChange={handleImport}
          />
        ) : null}
      />

      <div className="flex min-h-0 flex-1 flex-col p-3">
        {isLoading ? <LoadingCard title="Loading workflow..." /> : null}
        {error ? <ErrorCard error={error} onRetry={reload} /> : null}
        {canShowContent ? (
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border bg-card">
            <ReactFlow
              nodes={tracedNodes}
              edges={edges}
              nodeTypes={workflowNodeTypes}
              onNodesChange={isReadOnly ? undefined : onNodesChange}
              onEdgesChange={isReadOnly ? undefined : onEdgesChange}
              onConnect={handleConnect}
              onNodeClick={handleNodeClick}
              nodesDraggable={!isReadOnly}
              nodesConnectable={!isReadOnly}
              elementsSelectable
              fitView
            >
              <Background gap={20} size={1} color="var(--color-border)" />
              <Controls showInteractive={false} />

              <Panel position="top-left" className="m-3 w-64 max-w-88 pointer-events-auto">
                <WorkflowLibraryPanel
                  isOpen={showLibrary}
                  query={libraryQuery}
                  matchingNodes={nodeSearchResults}
                  presets={filteredPresets}
                  canEdit={!isReadOnly}
                  onQueryChange={setLibraryQuery}
                  onSelectNode={setSelectedNodeId}
                  onAddNode={handleAddNode}
                  onAddPresetNode={handleAddPresetNode}
                  onOpenChange={setShowLibrary}
                />
              </Panel>

              <Panel position="top-right" className="m-3 w-88 max-w-[calc(100vw-2rem)] pointer-events-auto">
                <WorkflowInspectorShell isOpen={showInspector} onOpen={() => setShowInspector(true)}>
                  <WorkflowDesignIssuesSummary issues={visibleIssues} onSelectNode={setSelectedNodeId} />
                  <WorkflowPropertiesPanel
                    agents={agents}
                    documents={documents}
                    integrations={integrations}
                    modelOptions={modelOptions}
                    onDeleteNode={handleDeleteNode}
                    onDuplicateNode={handleDuplicateNode}
                    onRunDraft={handleDryRun}
                    onSave={handleSave}
                    onSelectTraceNode={setSelectedNodeId}
                    readOnly={isReadOnly}
                    resourceBindings={resourceBindings}
                    runDraftDisabled={blockingIssues.length > 0}
                    saveDisabled={!hasUnsavedChanges}
                    selectedNode={selectedNode ? { id: selectedNode.id, data: selectedNode.data } : null}
                    selectedNodeId={selectedNodeId}
                    setDryRunInput={setDryRunInput}
                    setResourceBindings={setResourceBindings}
                    setSummary={setSummary}
                    setTitle={setTitle}
                    summary={summary}
                    title={title}
                    traces={data.invocations}
                    updateNode={handleSelectedNodeChange}
                    dryRunInput={dryRunInput}
                  />
                </WorkflowInspectorShell>
              </Panel>

              <Panel position="bottom-left" className="m-3 pointer-events-none">
                <WorkflowStatusPill title={title || data.workflow.title} versionLabel={data.selectedVersion.label} nodeCount={nodes.length} />
              </Panel>
            </ReactFlow>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default WorkflowDetailPage