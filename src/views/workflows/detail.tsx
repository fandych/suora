import { useEffect, useMemo, useRef, useState } from "react"
import { Background, Controls, Panel, ReactFlow, addEdge, useEdgesState, useNodesState, type Connection, type Edge, type Node, type NodeMouseHandler } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useParams } from "react-router"
import { DownloadIcon, PanelRightOpenIcon, PanelRightCloseIcon, PlayIcon, SaveIcon, UploadIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { listAgents } from "@/data/repositories/agent-repository"
import { listDocuments } from "@/data/repositories/document-repository"
import { listIntegrationSummaries } from "@/data/repositories/integration-repository"
import { listConfiguredModelProviders } from "@/data/repositories/model-config-repository"
import PageHeader from "@/views/components/page-header"
import VersionSelect from "@/views/components/version-select"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { createWorkflowNodeData, defaultWorkflowBindings, workflowPresetNodes } from "@/views/workflows/components/workflow-editor-config"
import { DEFAULT_WORKFLOW_DRY_RUN_INPUT, buildWorkflowFingerprint, getWorkflowDesignIssues } from "@/views/workflows/components/workflow-editor-state"
import { workflowNodeTypes } from "@/views/workflows/components/workflow-canvas-node"
import { WorkflowPropertiesPanel } from "@/views/workflows/components/workflow-properties-panel"
import { exportWorkflowJson, parseWorkflowJson } from "@/views/workflows/components/workflow-transfer"
import { WorkflowDesignIssuesSummary, WorkflowLibraryPanel } from "@/views/workflows/components/workflow-workbench-panels"
import { useAsyncResource } from "@/hooks/use-async-resource"
import type { WorkflowNodeData } from "@/data/domain/models"
import { getWorkflowDetail, publishWorkflowVersion, runWorkflow, saveWorkflowDraft } from "@/data/repositories/workflow-repository"

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

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  )
  const latestInvocation = data?.invocations[0] ?? null
  const nodeSearchResults = useMemo(() => {
    const keyword = libraryQuery.trim().toLowerCase()
    if (!keyword) {
      return []
    }

    return nodes.filter((node) => `${node.data.label} ${node.data.task ?? ""} ${node.data.kind}`.toLowerCase().includes(keyword))
  }, [libraryQuery, nodes])
  const designIssues = useMemo(() => getWorkflowDesignIssues(nodes), [nodes])
  const currentFingerprint = useMemo(
    () => buildWorkflowFingerprint({ title, summary, nodes, edges, resourceBindings, dryRunInput }),
    [dryRunInput, edges, nodes, resourceBindings, summary, title]
  )
  const savedFingerprint = useMemo(() => {
    if (!data) {
      return ""
    }

    return buildWorkflowFingerprint({
      title: data.workflow.title,
      summary: data.workflow.summary,
      nodes: data.definition.nodes,
      edges: data.definition.edges,
      resourceBindings: data.definition.resourceBindings ?? defaultWorkflowBindings,
      dryRunInput: data.definition.dryRunInputJson ?? DEFAULT_WORKFLOW_DRY_RUN_INPUT,
    })
  }, [data])
  const hasUnsavedChanges = Boolean(data) && currentFingerprint !== savedFingerprint
  const isReleaseVersion = Boolean(data?.selectedVersion.isRelease)
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
    setEdges((current) => addEdge(connection, current))
  }

  const handleSave = async () => {
    if (!workflowId) {
      return
    }

    const next = await saveWorkflowDraft(workflowId, {
      title,
      summary,
      selectedVersionId: data?.selectedVersion.id,
      definition: {
        nodes,
        edges,
        viewport: data?.definition.viewport ?? { x: 0, y: 0, zoom: 1 },
        resourceBindings,
        dryRunInputJson: dryRunInput,
        variables: data?.definition.variables ?? [],
        budget: data?.definition.budget,
      },
    })

    setData(next)
    setSelectedVersionId(next.selectedVersion.id)
  }

  const handlePublish = async () => {
    if (!workflowId || !data) {
      return
    }

    const next = await publishWorkflowVersion(workflowId, data.selectedVersion.id)
    setData(next)
    setSelectedVersionId(next.selectedVersion.id)
  }

  const handleRun = async () => {
    if (!workflowId || !data) {
      return
    }

    const next = await runWorkflow(workflowId, data.selectedVersion.id)
    setData(next)
  }

  const handleNodeClick: NodeMouseHandler<Node<WorkflowNodeData>> = (_event, node) => {
    setSelectedNodeId(node.id)
  }

  const handleAddNode = () => {
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
    if (!selectedNodeId) {
      return
    }

    setNodes((current) => current.map((node) => node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node))
  }

  const handleDuplicateNode = () => {
    if (!selectedNode) {
      return
    }

    const nextId = `${selectedNode.id}-copy-${nodes.length + 1}`
    setNodes((current) => [...current, { ...selectedNode, id: nextId, position: { x: selectedNode.position.x + 48, y: selectedNode.position.y + 48 } }])
    setSelectedNodeId(nextId)
  }

  const handleDeleteNode = () => {
    if (!selectedNodeId) {
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

    exportWorkflowJson({ title, summary, definition: { nodes, edges, viewport: data.definition.viewport, resourceBindings, dryRunInputJson: dryRunInput, variables: data.definition.variables ?? [], budget: data.definition.budget }, versionLabel: data.selectedVersion.label })
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
          <>
            <VersionSelect versions={data.versions} value={data.selectedVersion.id} onChange={setSelectedVersionId} />
            <Badge variant={isReleaseVersion ? "secondary" : "outline"}>{isReleaseVersion ? "Release revision" : "Draft revision"}</Badge>
            <Badge variant={hasUnsavedChanges ? "destructive" : "outline"}>{hasUnsavedChanges ? "Unsaved changes" : "Saved"}</Badge>
            <Badge variant={designIssues.length ? "destructive" : "outline"}>{designIssues.length} design issue{designIssues.length === 1 ? "" : "s"}</Badge>
            <Button size="sm" variant="outline" onClick={() => setShowLibrary((value) => !value)}>
              {showLibrary ? <PanelLeftCloseIcon /> : <PanelLeftOpenIcon />}
              Library
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowInspector((value) => !value)}>
              {showInspector ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
              Panels
            </Button>
            <Button size="sm" variant="outline" onClick={handleRun}>
              <PlayIcon />
              Run
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasUnsavedChanges}>
              <SaveIcon />
              Save draft
            </Button>
            <Button size="sm" variant="outline" onClick={handlePublish} disabled={hasUnsavedChanges || !isReleaseVersion && designIssues.some((issue) => issue.severity === "error")}>
              <UploadIcon />
              Publish
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
                <DownloadIcon />
                Transfer
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 min-w-40">
                <DropdownMenuItem onClick={handleExport}>Export JSON</DropdownMenuItem>
                <DropdownMenuItem onClick={() => importInputRef.current?.click()}>Import JSON</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void handleImport(event)} />
          </>
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
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={handleConnect}
              onNodeClick={handleNodeClick}
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
                  onQueryChange={setLibraryQuery}
                  onSelectNode={setSelectedNodeId}
                  onAddNode={handleAddNode}
                  onAddPresetNode={handleAddPresetNode}
                  onOpenChange={setShowLibrary}
                />
              </Panel>

              <Panel position="top-right" className="m-3 w-88 max-w-[calc(100vw-2rem)] pointer-events-auto">
                {showInspector ? (
                  <div className="max-h-[calc(100vh-10rem)] overflow-hidden rounded-2xl border bg-card shadow-sm">
                    <WorkflowDesignIssuesSummary issues={designIssues} onSelectNode={setSelectedNodeId} />
                    <WorkflowPropertiesPanel
                      agents={agents}
                      documents={documents}
                      integrations={integrations}
                      modelOptions={modelOptions}
                      onDeleteNode={handleDeleteNode}
                      onDuplicateNode={handleDuplicateNode}
                      onRun={handleRun}
                      onSave={handleSave}
                      onSelectTraceNode={setSelectedNodeId}
                      resourceBindings={resourceBindings}
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
                  </div>
                ) : (
                  <div className="rounded-2xl border bg-card p-2 shadow-sm">
                    <Button size="sm" variant="ghost" onClick={() => setShowInspector(true)}>
                      <PanelRightOpenIcon />
                    </Button>
                  </div>
                )}
              </Panel>

              <Panel position="bottom-left" className="m-3 pointer-events-none">
                <div className="flex items-center gap-2 rounded-full border bg-background/92 px-3 py-1.5 backdrop-blur">
                  <span className="text-[11px] font-medium">{title || data.workflow.title}</span>
                  <Separator orientation="vertical" className="h-3" />
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{data.selectedVersion.label}</Badge>
                  <span className="text-[10px] text-muted-foreground">{nodes.length} nodes</span>
                </div>
              </Panel>
            </ReactFlow>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default WorkflowDetailPage