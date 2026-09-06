import { Background, ConnectionLineType, MarkerType, MiniMap, Panel, ReactFlow } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { PlayIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import PageHeader from "@/views/components/page-header"
import { ConfirmDeleteDialog } from "@/views/components/confirm-delete-dialog"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { WorkflowIssuesControl, WorkflowNodeSearchControl } from "@/views/workflows/components/workflow-canvas-controls"
import { workflowNodeTypes } from "@/views/workflows/components/workflow-canvas-node"
import { workflowEdgeTypes } from "@/views/workflows/components/workflow-edge"
import { WorkflowHeaderActions } from "@/views/workflows/components/workflow-header-actions"
import { WorkflowPreferenceDialog } from "@/views/workflows/components/workflow-preference-dialog"
import { WorkflowPropertiesPanel } from "@/views/workflows/components/workflow-properties-panel"
import { WorkflowNodeActionsProvider } from "@/views/workflows/components/workflow-node-actions-context"
import { WorkflowTryPanel } from "@/views/workflows/components/workflow-try-panel"
import { WorkflowLibraryPanel } from "@/views/workflows/components/workflow-workbench-panels"
import { WorkflowInvocationHistory } from "@/views/workflows/components/workflow-invocation-history"
import { WorkflowZoomControls } from "@/views/workflows/components/workflow-zoom-controls"
import { WorkflowStatusPill } from "@/views/workflows/components/workflow-status-pill"
import { useWorkflowDetailController } from "@/views/workflows/use-workflow-detail-controller"

const WorkflowDetailPage = () => {
  const controller = useWorkflowDetailController()
  const stopPanelEvent = (event: React.MouseEvent | React.PointerEvent) => event.stopPropagation()
  const workflowData = controller.data

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title={controller.title || controller.data?.workflow.title || "Workflow"} />

      <div className="flex min-h-0 flex-1 flex-col p-3">
        {controller.isLoading ? <LoadingCard title="Loading workflow..." /> : null}
        {controller.error ? <ErrorCard error={controller.error} onRetry={controller.reload} /> : null}
        {controller.canShowContent && workflowData ? (
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border bg-card">
            <WorkflowNodeActionsProvider value={{ canEdit: !controller.isReadOnly, hasOutgoingConnection: controller.hasOutgoingConnection, onAddNodeFromHandle: controller.handleAddNodeFromHandle }}>
            <ReactFlow
              key={workflowData.selectedVersion.id}
              nodes={controller.tracedNodes}
              edges={controller.edges}
              nodeTypes={workflowNodeTypes}
              edgeTypes={workflowEdgeTypes}
              onNodesChange={controller.isReadOnly ? undefined : controller.onNodesChange}
              onEdgesChange={controller.isReadOnly ? undefined : controller.onEdgesChange}
              onConnect={controller.handleConnect}
              onNodesDelete={controller.isReadOnly ? undefined : controller.handleNodesDelete}
              onSelectionChange={controller.handleSelectionChange}
              onNodeClick={controller.handleNodeClick}
              onPaneClick={() => {
                controller.setSelectedNodeId(null)
                if (controller.inspectorMode === "properties") {
                  controller.setInspectorMode("closed")
                }
              }}
              defaultViewport={controller.viewport}
              onMoveEnd={(_event, nextViewport) => controller.setViewport(nextViewport)}
              onInit={(instance) => {
                controller.setFlowInstance(instance)
                void instance.setViewport(controller.viewport, { duration: 0 })
              }}
              nodesDraggable={!controller.isReadOnly}
              nodesConnectable={!controller.isReadOnly}
              elementsSelectable
              deleteKeyCode={controller.isReadOnly ? null : ["Backspace", "Delete"]}
              connectionLineType={ConnectionLineType.SmoothStep}
              defaultEdgeOptions={{ type: "workflow", markerEnd: { type: MarkerType.ArrowClosed } }}
              proOptions={{ hideAttribution: true }}
              minZoom={0.25}
              maxZoom={2}
              snapToGrid
              fitView={false}
            >
              <Background gap={20} size={1} color="var(--color-border)" />

              <Panel position="top-center" className="m-3 flex w-[min(100%-1.5rem,72rem)] pointer-events-auto justify-center" onPointerDown={stopPanelEvent} onMouseDown={stopPanelEvent} onClick={stopPanelEvent}>
                <WorkflowStatusPill title={controller.title || workflowData.workflow.title} versionLabel={workflowData.selectedVersion.label} nodeCount={controller.nodes.length} isDraft={controller.isDraftVersion} hasUnsavedChanges={controller.hasUnsavedChanges} issueCount={controller.visibleIssues.length} />
              </Panel>
              <Panel position="top-center" className="mt-16! m-3 flex w-[min(100%-1.5rem,72rem)] pointer-events-auto justify-center" onPointerDown={stopPanelEvent} onMouseDown={stopPanelEvent} onClick={stopPanelEvent}>
                <WorkflowHeaderActions
                  versions={workflowData.versions}
                  selectedVersionId={workflowData.selectedVersion.id}
                  onVersionChange={controller.setSelectedVersionId}
                  showLibrary={controller.showLibrary}
                  canSave={controller.isDraftVersion && controller.hasUnsavedChanges}
                  canPublish={controller.isDraftVersion && !controller.hasUnsavedChanges && controller.blockingIssues.length === 0}
                  canRunRelease={controller.isReleaseVersion}
                  onToggleLibrary={() => controller.setShowLibrary((current) => !current)}
                  onSave={() => void controller.handleSave()}
                  onAutoLayout={controller.handleAutoLayout}
                  onOpenPreference={() => controller.setIsPreferenceDialogOpen(true)}
                  onOpenTryRun={() => controller.setInspectorMode("try-run")}
                  onOpenHistory={() => controller.setInspectorMode("history")}
                  onRunRelease={controller.handleRunRelease}
                  onPublish={controller.handlePublish}
                  onExport={controller.handleExport}
                  onImport={() => controller.importInputRef.current?.click()}
                  onDelete={() => controller.setIsDeleteDialogOpen(true)}
                  importInputRef={controller.importInputRef}
                  onImportChange={controller.handleImport}
                />
              </Panel>

              <Panel position="top-left" className={`${controller.showLibrary ? "left-62!" : "left-12!"} m-3! pointer-events-auto`} onPointerDown={stopPanelEvent} onMouseDown={stopPanelEvent} onClick={stopPanelEvent}>
                <div className="flex items-center gap-2">
                  <WorkflowNodeSearchControl
                    nodes={controller.nodes}
                    onNodeSelect={controller.focusNode}
                  />
                  <WorkflowIssuesControl
                    issues={controller.visibleIssues}
                    onIssueSelect={controller.focusNode}
                  />
                </div>
              </Panel>

              <Panel position="top-left" className="m-3 w-64 max-w-88 pointer-events-auto" onPointerDown={stopPanelEvent} onMouseDown={stopPanelEvent} onClick={stopPanelEvent}>
                <WorkflowLibraryPanel
                  isOpen={controller.showLibrary}
                  presets={controller.workflowPresetNodes}
                  canEdit={!controller.isReadOnly}
                  hasStartNode={controller.nodes.some((node) => node.data.kind === "start")}
                  onAddPresetNode={controller.handleAddPresetNode}
                  onOpenChange={controller.setShowLibrary}
                />
              </Panel>

              {controller.inspectorMode !== "properties" ? (
                <Panel position="top-right" className="m-3! pointer-events-auto" onPointerDown={stopPanelEvent} onMouseDown={stopPanelEvent} onClick={stopPanelEvent}>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="bg-background/95 shadow-lg"
                    onClick={() => controller.setInspectorMode("try-run")}
                    disabled={controller.isReadOnly || controller.isDryRunning}
                    aria-label="Open try panel"
                    title="Open try panel"
                  >
                    <PlayIcon />
                  </Button>
                </Panel>
              ) : null}

              {controller.inspectorMode === "properties" && controller.selectedNode ? (
                <Panel position="top-right" className="top-3! right-3! bottom-3! m-0! p-0! pointer-events-auto" onPointerDown={stopPanelEvent} onMouseDown={stopPanelEvent} onClick={stopPanelEvent}>
                  <div className="relative h-full min-h-0 max-w-[calc(100vw-1.5rem)]" style={{ width: controller.propertiesPanelWidth }}>
                    <button
                      type="button"
                      aria-label="Resize node properties panel"
                      title="Resize node properties panel"
                      className="absolute top-1/2 -left-2 z-10 h-10 w-1 -translate-y-1/2 touch-none cursor-ew-resize rounded-full bg-border/70 hover:bg-primary"
                      onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
                      onPointerMove={(event) => {
                        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
                          return
                        }

                        controller.setPropertiesPanelWidth((current) => Math.min(520, Math.max(260, current - event.movementX)))
                      }}
                    />
                    <div className="workflow-properties-panel flex h-full min-h-0 flex-col gap-2 rounded-xl border bg-background/95 p-2 shadow-xl">
                      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
                        <WorkflowPropertiesPanel
                          agents={controller.agents}
                          documents={controller.documents}
                          integrations={controller.integrations}
                          modelOptions={controller.modelOptions}
                          onDeleteNode={controller.handleDeleteNode}
                          onDuplicateNode={controller.handleDuplicateNode}
                          onRenameNodeId={controller.handleRenameSelectedNodeId}
                          readOnly={controller.isReadOnly}
                          selectedNode={controller.selectedNode ? { id: controller.selectedNode.id, data: controller.selectedNode.data } : null}
                          updateNode={controller.handleSelectedNodeChange}
                        />
                      </div>
                    </div>
                  </div>
                </Panel>
              ) : null}

              {controller.inspectorMode === "try-run" ? (
                <Panel position="top-right" className="top-3! right-3! bottom-3! m-0! p-0! pointer-events-auto" onPointerDown={stopPanelEvent} onMouseDown={stopPanelEvent} onClick={stopPanelEvent}>
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
                <Panel position="top-right" className="top-3! right-3! bottom-3! m-0! w-80 p-0! pointer-events-auto" onPointerDown={stopPanelEvent} onMouseDown={stopPanelEvent} onClick={stopPanelEvent}>
                  <WorkflowInvocationHistory invocations={workflowData.invocations} selectedId={controller.selectedInvocationId} onSelect={(id) => { controller.setSelectedInvocationId(id); controller.setInspectorMode("try-run") }} />
                </Panel>
              ) : null}

              {!controller.selectedNode && controller.inspectorMode !== "try-run" && controller.inspectorMode !== "history" ? (
                <Panel position="bottom-right" className="m-3 pointer-events-auto" onPointerDown={stopPanelEvent} onMouseDown={stopPanelEvent} onClick={stopPanelEvent}>
                  <div className="h-32 w-48 overflow-hidden rounded-2xl border bg-background/92 shadow-sm backdrop-blur">
                    <MiniMap pannable zoomable />
                  </div>
                </Panel>
              ) : null}

              <Panel position="bottom-center" className="m-3 pointer-events-auto" onPointerDown={stopPanelEvent} onMouseDown={stopPanelEvent} onClick={stopPanelEvent}>
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
        dryRunInput={controller.dryRunInput}
        readOnly={controller.isReadOnly}
        notifications={controller.notifications}
        resourceBindings={controller.resourceBindings}
        onOpenChange={controller.setIsPreferenceDialogOpen}
        onDryRunInputChange={controller.setDryRunInput}
        onNotificationsChange={controller.setNotifications}
        onResourceBindingsChange={controller.setResourceBindings}
        onTitleChange={controller.setTitle}
        onSummaryChange={controller.setSummary}
      />

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