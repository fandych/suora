/* eslint-disable react-hooks/refs */
import { useCallback, useState } from "react"
import { useNavigate } from "react-router"
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  SelectionMode,
  type Edge,
  type FinalConnectionState,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import {
  EllipsisIcon,
  HistoryIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PencilIcon,
  RotateCcwIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import PageHeader from "@/pages/components/page-header"
import { ConfirmDeleteDialog } from "@/pages/components/confirm-delete-dialog"
import { RecentlyDeletedDialog } from "@/pages/components/recently-deleted-dialog"
import { ErrorCard, LoadingCard } from "@/pages/components/resource-state"
import { WorkflowIssuesControl, WorkflowNodeSearchControl } from "@/pages/workflows/components/workflow-canvas-controls"
import { workflowNodeTypes } from "@/pages/workflows/components/workflow-canvas-node"
import { workflowEdgeTypes } from "@/pages/workflows/components/workflow-edge"
import { WorkflowRevisionActions } from "@/pages/workflows/components/workflow-header-actions"
import { WorkflowPreferenceDialog } from "@/pages/workflows/components/workflow-preference-dialog"
import { WorkflowPropertiesPanel } from "@/pages/workflows/components/workflow-properties-panel"
import { WorkflowNodeActionsProvider } from "@/pages/workflows/components/workflow-node-actions-context"
import { WorkflowTryPanel } from "@/pages/workflows/components/workflow-try-panel"
import { WorkflowLibraryPanel } from "@/pages/workflows/components/workflow-workbench-panels"
import { WorkflowInvocationHistory } from "@/pages/workflows/components/workflow-invocation-history"
import { WorkflowZoomControls } from "@/pages/workflows/components/workflow-zoom-controls"
import { WorkflowPanelResizeHandle } from "@/pages/workflows/components/workflow-panel-resize-handle"
import { useWorkflowDetailController } from "@/hooks/use-workflow-detail-controller"
import { emitDataChanged } from "@/services/data-events"
import { showToast } from "@/services/toast-service"
import type { WorkflowEdgeData, WorkflowNodeData } from "@/types/workflow"

const DEFAULT_EDGE_OPTIONS = { type: "workflow", markerEnd: { type: MarkerType.ArrowClosed } }
const WORKFLOW_ARIA_LABELS = {
  "node.a11yDescription.default": "Workflow step. Press Enter to select it and use arrow keys to move it.",
  "edge.a11yDescription.default": "Workflow connection. Press Enter to select it.",
}

const WorkflowDetailPage = () => {
  const controller = useWorkflowDetailController()
  const navigate = useNavigate()
  const [isRecentlyDeletedOpen, setIsRecentlyDeletedOpen] = useState(false)
  const { inspectorMode, setFlowInstance, setInspectorMode, setSelectedNodeId, viewport } = controller
  const stopPanelEvent = useCallback((event: React.MouseEvent | React.PointerEvent) => event.stopPropagation(), [])
  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
    if (inspectorMode === "properties") {
      setInspectorMode("closed")
    }
  }, [inspectorMode, setInspectorMode, setSelectedNodeId])
  const handleFlowInit = useCallback(
    (instance: ReactFlowInstance<Node<WorkflowNodeData>, Edge<WorkflowEdgeData>>) => {
      setFlowInstance(instance)
      void instance.setViewport(viewport, { duration: 0 })
    },
    [setFlowInstance, viewport],
  )
      const handleOpenImport = () => {
        controller.importInputRef.current?.click()
      }
  const handleConnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      if (!connectionState.isValid && !controller.isReadOnly && connectionState.toHandle) {
        showToast({
          title: "Connection not allowed",
          description: "Connect an output to a compatible input, without duplicating an existing path.",
          type: "warning",
        })
      }
    },
    [controller.isReadOnly],
  )
  const workflowData = controller.data

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={controller.title || controller.data?.workflow.title || "Workflow"}
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsRecentlyDeletedOpen(true)}>
              <RotateCcwIcon className="size-4" />
              Recently deleted
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button type="button" size="icon-sm" variant="ghost" aria-label="Workflow actions" />}
              >
                <EllipsisIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => controller.setIsPreferenceDialogOpen(true)}
                    disabled={controller.isReadOnly}
                  >
                    <PencilIcon />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => controller.setIsHistoryDialogOpen(true)}>
                    <HistoryIcon />
                    Run history
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => controller.setIsDeleteDialogOpen(true)} variant="destructive">
                    <Trash2Icon />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <RecentlyDeletedDialog
        kind="workflow"
        open={isRecentlyDeletedOpen}
        onOpenChange={setIsRecentlyDeletedOpen}
        onRestored={async (result) => {
          emitDataChanged("/workflows")
          navigate(`/workflows/${result.resourceId}`)
        }}
        title="Restore deleted workflows"
      />

      <input
        ref={controller.importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => void controller.handleImport(event)}
      />

      <div className="flex min-h-0 flex-1 flex-col p-3">
        {controller.isLoading ? <LoadingCard title="Loading workflow..." /> : null}
        {controller.error ? <ErrorCard error={controller.error} onRetry={controller.reload} /> : null}
        {controller.canShowContent && workflowData ? (
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border bg-card">
            <WorkflowNodeActionsProvider
              value={{
                canEdit: !controller.isReadOnly,
                hasOutgoingConnection: controller.hasOutgoingConnection,
                onAddNodeFromHandle: controller.handleAddNodeFromHandle,
              }}
            >
              <ReactFlow
                key={workflowData.selectedVersion.id}
                nodes={controller.tracedNodes}
                edges={controller.edges}
                nodeTypes={workflowNodeTypes}
                edgeTypes={workflowEdgeTypes}
                onNodesChange={controller.isReadOnly ? undefined : controller.onNodesChange}
                onEdgesChange={controller.isReadOnly ? undefined : controller.onEdgesChange}
                onConnect={controller.handleConnect}
                onConnectEnd={handleConnectEnd}
                isValidConnection={controller.isValidConnection}
                onNodesDelete={controller.isReadOnly ? undefined : controller.handleNodesDelete}
                onSelectionChange={controller.handleSelectionChange}
                onNodeClick={controller.handleNodeClick}
                onPaneClick={handlePaneClick}
                defaultViewport={controller.viewport}
                onMoveEnd={(_event, nextViewport) => controller.setViewport(nextViewport)}
                onInit={handleFlowInit}
                nodesDraggable={!controller.isReadOnly}
                nodesConnectable={!controller.isReadOnly}
                elementsSelectable
                deleteKeyCode={controller.isReadOnly ? null : ["Backspace", "Delete"]}
                connectionLineType={ConnectionLineType.SmoothStep}
                connectionLineStyle={{ stroke: "var(--color-primary)", strokeWidth: 2, strokeDasharray: "5 4" }}
                defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
                proOptions={{ hideAttribution: true }}
                ariaLabelConfig={WORKFLOW_ARIA_LABELS}
                minZoom={0.25}
                maxZoom={2}
                snapToGrid
                snapGrid={[16, 16]}
                connectionDragThreshold={4}
                connectionRadius={28}
                autoPanOnConnect
                autoPanOnNodeDrag
                panOnDrag
                selectionKeyCode="Shift"
                selectionMode={SelectionMode.Partial}
                zoomOnScroll
                onlyRenderVisibleElements={controller.nodes.length > 80}
                fitView={false}
              >
                <Background variant={BackgroundVariant.Dots} gap={16} size={1.5} color="var(--color-border)" />
                <Background variant={BackgroundVariant.Lines} gap={80} size={1} color="var(--color-muted-foreground)" />

                <Panel
                  position="top-right"
                  className="top-3! right-3! m-0! pointer-events-auto"
                  onPointerDown={stopPanelEvent}
                  onMouseDown={stopPanelEvent}
                  onClick={stopPanelEvent}
                >
                  <WorkflowRevisionActions
                    canSave={controller.hasUnsavedChanges}
                    canTryRun={!controller.isDryRunning && controller.blockingIssues.length === 0}
                    onExport={controller.handleExport}
                    onImport={handleOpenImport}
                    importDisabled={controller.isReadOnly}
                    onOpenTryRun={() => controller.setInspectorMode("try-run")}
                    onSave={() => void controller.handleSave()}
                  />
                </Panel>

                <Panel
                  position="top-left"
                  className="top-3! left-3! m-0! pointer-events-auto"
                  onPointerDown={stopPanelEvent}
                  onMouseDown={stopPanelEvent}
                  onClick={stopPanelEvent}
                >
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="bg-background/95 shadow-lg"
                      onClick={() => controller.setShowLibrary((current) => !current)}
                      aria-label={controller.showLibrary ? "Collapse node library" : "Expand node library"}
                      title={controller.showLibrary ? "Collapse node library" : "Expand node library"}
                    >
                      {controller.showLibrary ? <PanelLeftCloseIcon /> : <PanelLeftOpenIcon />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="bg-background/95 shadow-lg"
                      onClick={controller.handleAutoLayout}
                      disabled={controller.isReadOnly || controller.nodes.length < 2}
                      aria-label="Auto layout workflow"
                      title="Auto layout workflow"
                    >
                      <SparklesIcon />
                    </Button>
                    <WorkflowNodeSearchControl nodes={controller.nodes} onNodeSelect={controller.focusNode} />
                    <WorkflowIssuesControl issues={controller.visibleIssues} onIssueSelect={controller.focusNode} />
                  </div>
                </Panel>

                {controller.showLibrary ? (
                  <Panel
                    position="top-left"
                    className="top-14! left-3! m-0! w-64 max-w-88 pointer-events-auto"
                    onPointerDown={stopPanelEvent}
                    onMouseDown={stopPanelEvent}
                    onClick={stopPanelEvent}
                  >
                    <WorkflowLibraryPanel
                      isOpen
                      presets={controller.workflowPresetNodes}
                      canEdit={!controller.isReadOnly}
                      hasStartNode={controller.nodes.some((node) => node.data.kind === "start")}
                      onAddPresetNode={controller.handleAddPresetNode}
                    />
                  </Panel>
                ) : null}

                {controller.inspectorMode === "properties" && controller.selectedNode ? (
                  <Panel
                    position="top-right"
                    className="top-14! right-3! bottom-3! m-0! p-0! pointer-events-auto"
                    onPointerDown={stopPanelEvent}
                    onMouseDown={stopPanelEvent}
                    onClick={stopPanelEvent}
                  >
                    <div
                      className="relative h-full min-h-0 max-w-[calc(100vw-1.5rem)]"
                      style={{ width: controller.propertiesPanelWidth }}
                    >
                      <WorkflowPanelResizeHandle
                        label="Resize node properties panel"
                        onResize={(deltaX) =>
                          controller.setPropertiesPanelWidth((current) =>
                            Math.min(520, Math.max(260, current - deltaX)),
                          )
                        }
                      />
                      <WorkflowPropertiesPanel
                        agents={controller.agents}
                        documents={controller.documents}
                        integrations={controller.integrations}
                        modelOptions={controller.modelOptions}
                        nodes={controller.nodes}
                        edges={controller.edges}
                        onDeleteNode={controller.handleDeleteNode}
                        onRenameNodeId={controller.handleRenameSelectedNodeId}
                        readOnly={controller.isReadOnly}
                        selectedNode={
                          controller.selectedNode
                            ? { id: controller.selectedNode.id, data: controller.selectedNode.data }
                            : null
                        }
                        updateNode={controller.handleSelectedNodeChange}
                      />
                    </div>
                  </Panel>
                ) : null}

                {controller.inspectorMode === "try-run" ? (
                  <Panel
                    position="top-right"
                    className="top-14! right-3! bottom-3! m-0! p-0! pointer-events-auto"
                    onPointerDown={stopPanelEvent}
                    onMouseDown={stopPanelEvent}
                    onClick={stopPanelEvent}
                  >
                    <WorkflowTryPanel
                      width={controller.tryPanelWidth}
                      onWidthChange={controller.setTryPanelWidth}
                      invocation={controller.selectedInvocation}
                      input={controller.dryRunInput}
                      isRunning={controller.isDryRunning}
                      error={controller.dryRunError}
                      onInputChange={(value) => {
                        controller.setDryRunInput(value)
                      }}
                      onClose={() => controller.setInspectorMode("closed")}
                      onRun={() => void controller.handleDryRun()}
                    />
                  </Panel>
                ) : null}

                {controller.inspectorMode === "history" ? (
                  <Panel
                    position="top-right"
                    className="top-14! right-3! bottom-3! m-0! w-80 p-0! pointer-events-auto"
                    onPointerDown={stopPanelEvent}
                    onMouseDown={stopPanelEvent}
                    onClick={stopPanelEvent}
                  >
                    <WorkflowInvocationHistory
                      invocations={workflowData.invocations}
                      selectedId={controller.selectedInvocationId}
                      onSelect={(id) => {
                        controller.setSelectedInvocationId(id)
                        controller.setInspectorMode("try-run")
                      }}
                    />
                  </Panel>
                ) : null}

                {!controller.selectedNode &&
                controller.inspectorMode !== "try-run" &&
                controller.inspectorMode !== "history" ? (
                  <Panel
                    position="bottom-right"
                    className="m-3 pointer-events-auto"
                    onPointerDown={stopPanelEvent}
                    onMouseDown={stopPanelEvent}
                    onClick={stopPanelEvent}
                  >
                    <div className="h-32 w-48 overflow-hidden rounded-2xl border bg-background/92 shadow-sm backdrop-blur">
                      <MiniMap pannable zoomable />
                    </div>
                  </Panel>
                ) : null}

                <Panel
                  position="bottom-center"
                  className="m-3 pointer-events-auto"
                  onPointerDown={stopPanelEvent}
                  onMouseDown={stopPanelEvent}
                  onClick={stopPanelEvent}
                >
                  <WorkflowZoomControls
                    zoom={controller.viewport.zoom}
                    onZoomOut={() => controller.handleZoomStep(-0.1)}
                    onZoomIn={() => controller.handleZoomStep(0.1)}
                    onFitView={controller.handleFitView}
                  />
                </Panel>
              </ReactFlow>
            </WorkflowNodeActionsProvider>
          </div>
        ) : null}
      </div>

      <WorkflowPreferenceDialog
        open={controller.isPreferenceDialogOpen}
        title={controller.title}
        summary={controller.summary}
        enabled={controller.enabled}
        readOnly={controller.isReadOnly}
        onOpenChange={controller.setIsPreferenceDialogOpen}
        onTitleChange={controller.setTitle}
        onSummaryChange={controller.setSummary}
        onEnabledChange={controller.setEnabled}
      />

      <Dialog open={controller.isHistoryDialogOpen} onOpenChange={controller.setIsHistoryDialogOpen}>
        <DialogContent className="max-h-[80vh] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Run history</DialogTitle>
            <DialogDescription>Review recent workflow executions and their results.</DialogDescription>
          </DialogHeader>
          {workflowData ? (
            <WorkflowInvocationHistory
              invocations={workflowData.invocations}
              selectedId={controller.selectedInvocationId}
              onSelect={(id) => controller.setSelectedInvocationId(id)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={controller.isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!controller.isDeleting) {
            controller.setIsDeleteDialogOpen(open)
          }
        }}
        title="Delete workflow"
        description="This permanently deletes the workflow, its versions, and invocation history. This action cannot be undone."
        onConfirm={() => void controller.handleDeleteWorkflow()}
      />
    </div>
  )
}

export default WorkflowDetailPage
