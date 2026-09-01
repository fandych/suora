import { useEffect, useMemo, useState } from "react"
import { Background, Controls, MiniMap, ReactFlow, addEdge, useEdgesState, useNodesState, type Connection, type Edge, type Node, type NodeMouseHandler } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useParams } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import PageHeader from "@/views/components/page-header"
import VersionSelect from "@/views/components/version-select"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
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

  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<WorkflowNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [resourceBindings, setResourceBindings] = useState({ providerId: "provider-openai", skillId: "skill-plan", documentId: "document-product-manual", integrationId: "integration-webhook" })
  const [dryRunInput, setDryRunInput] = useState("{\n  \"leadId\": \"LD-1001\"\n}")

  useEffect(() => {
    if (!data) {
      return
    }

    setTitle(data.workflow.title)
    setSummary(data.workflow.summary)
    setNodes(data.definition.nodes)
    setEdges(data.definition.edges)
    setSelectedVersionId(data.selectedVersion.id)
    setSelectedNodeId(data.definition.nodes[0]?.id ?? null)
  }, [data, setEdges, setNodes])

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  )
  const latestInvocation = data?.invocations[0] ?? null
  const tracedNodes = useMemo(() => {
    const traceMap = new Map(latestInvocation?.traces.map((trace) => [trace.nodeId, trace]) ?? [])
    return nodes.map((node) => {
      const trace = traceMap.get(node.id)
      if (!trace) {
        return node
      }

      return {
        ...node,
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
      definition: {
        nodes,
        edges,
        viewport: data?.definition.viewport ?? { x: 0, y: 0, zoom: 1 },
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
        position: { x: 220 + current.length * 120, y: 260 },
        data: { label: `Step ${nextIndex}`, prompt: "Describe what this node should do.", kind: "agent" },
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
        position: { x: 120 + current.length * 120, y: 120 + (current.length % 3) * 90 },
        data: { label: `${kind[0].toUpperCase()}${kind.slice(1)} ${nextIndex}`, prompt: `Configure ${kind} node behavior.`, kind },
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

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={data?.workflow.title ?? "Workflow"}
        description="Versioned flow editor with local SQLite persistence and xyflow canvas."
        actions={data ? (
          <>
            <VersionSelect versions={data.versions} value={data.selectedVersion.id} onChange={setSelectedVersionId} />
            <Button variant="outline" onClick={handleRun}>Run</Button>
            <Button onClick={handleSave}>Save draft</Button>
            <Button variant="outline" onClick={handlePublish}>Publish</Button>
          </>
        ) : null}
      />

      <div className="flex-1 p-6">
        <div className="mx-auto max-w-7xl">
          {isLoading ? <LoadingCard title="Loading workflow..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && data ? (
            <Card className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle>Workflow canvas</CardTitle>
                    <Badge variant="outline">{data.selectedVersion.label}</Badge>
                  </div>
                  <CardDescription>Single-canvas workflow editor with floating config and run history panels, closer to the forhub editing model.</CardDescription>
                </CardHeader>
                <CardContent className="relative h-[44rem] p-0">
                  <ReactFlow nodes={tracedNodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={handleConnect} onNodeClick={handleNodeClick} fitView>
                    <Background />
                    <MiniMap />
                    <Controls />
                  </ReactFlow>
                  <div className="absolute bottom-4 left-4 z-10 w-72 rounded-2xl border bg-background/95 shadow-sm backdrop-blur">
                    <div className="border-b px-4 py-3">
                      <div className="text-sm font-medium">Node library</div>
                      <div className="text-xs text-muted-foreground">Quick-add preset workflow steps.</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 px-4 py-4">
                      <Button size="sm" variant="outline" onClick={() => handleAddPresetNode("start")}>Start</Button>
                      <Button size="sm" variant="outline" onClick={() => handleAddPresetNode("agent")}>Agent</Button>
                      <Button size="sm" variant="outline" onClick={() => handleAddPresetNode("condition")}>Condition</Button>
                      <Button size="sm" variant="outline" onClick={() => handleAddPresetNode("output")}>Output</Button>
                    </div>
                  </div>
                  <div className="absolute top-4 left-4 z-10 w-80 rounded-2xl border bg-background/95 shadow-sm backdrop-blur">
                    <div className="border-b px-4 py-3">
                      <div className="text-sm font-medium">Workflow meta</div>
                      <div className="text-xs text-muted-foreground">Edit draft metadata without leaving the canvas.</div>
                    </div>
                    <div className="space-y-3 px-4 py-4">
                      <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Workflow name" />
                      <Textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} placeholder="Workflow summary" />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleAddNode}>Add node</Button>
                        <Button size="sm" variant="outline" onClick={handleRun}>Run now</Button>
                      </div>
                    </div>
                  </div>

                  <div className="absolute top-56 left-4 z-10 w-80 rounded-2xl border bg-background/95 shadow-sm backdrop-blur">
                    <div className="border-b px-4 py-3">
                      <div className="text-sm font-medium">Resource bindings</div>
                      <div className="text-xs text-muted-foreground">Bind runtime resources before dry-run or publish.</div>
                    </div>
                    <div className="space-y-3 px-4 py-4">
                      <Input value={resourceBindings.providerId} onChange={(event) => setResourceBindings({ ...resourceBindings, providerId: event.target.value })} placeholder="Provider ID" />
                      <Input value={resourceBindings.skillId} onChange={(event) => setResourceBindings({ ...resourceBindings, skillId: event.target.value })} placeholder="Skill ID" />
                      <Input value={resourceBindings.documentId} onChange={(event) => setResourceBindings({ ...resourceBindings, documentId: event.target.value })} placeholder="Document ID" />
                      <Input value={resourceBindings.integrationId} onChange={(event) => setResourceBindings({ ...resourceBindings, integrationId: event.target.value })} placeholder="Integration ID" />
                    </div>
                  </div>

                  <div className="absolute top-4 right-4 z-10 w-88 rounded-2xl border bg-background/95 shadow-sm backdrop-blur">
                    <div className="border-b px-4 py-3">
                      <div className="text-sm font-medium">Node config</div>
                      <div className="text-xs text-muted-foreground">Select a node on the canvas to edit its behavior.</div>
                    </div>
                    <div className="space-y-3 px-4 py-4 text-sm">
                      {selectedNode ? (
                        <>
                          <Input value={selectedNode.data.label} onChange={(event) => handleSelectedNodeChange({ label: event.target.value })} />
                          <NativeSelect value={selectedNode.data.kind} onChange={(event) => handleSelectedNodeChange({ kind: event.target.value as WorkflowNodeData["kind"] })}>
                            <NativeSelectOption value="start">Start</NativeSelectOption>
                            <NativeSelectOption value="agent">Agent</NativeSelectOption>
                            <NativeSelectOption value="condition">Condition</NativeSelectOption>
                            <NativeSelectOption value="output">Output</NativeSelectOption>
                          </NativeSelect>
                          <Textarea value={selectedNode.data.prompt} onChange={(event) => handleSelectedNodeChange({ prompt: event.target.value })} rows={6} />
                        </>
                      ) : (
                        <div className="text-muted-foreground">No node selected.</div>
                      )}
                    </div>
                  </div>

                  <div className="absolute right-4 bottom-4 z-10 w-[26rem] rounded-2xl border bg-background/95 shadow-sm backdrop-blur">
                    <div className="border-b px-4 py-3">
                      <div className="text-sm font-medium">Run history</div>
                      <div className="text-xs text-muted-foreground">Recent manual runs for this workflow draft or release.</div>
                    </div>
                    <div className="max-h-64 space-y-3 overflow-auto px-4 py-4 text-sm">
                      <div className="space-y-2 rounded-lg border p-3">
                        <div className="font-medium">Dry run input</div>
                        <Textarea value={dryRunInput} onChange={(event) => setDryRunInput(event.target.value)} rows={5} className="font-mono" />
                        <div className="text-xs text-muted-foreground">Bindings: {resourceBindings.providerId} / {resourceBindings.skillId} / {resourceBindings.documentId} / {resourceBindings.integrationId}</div>
                      </div>
                      {data.invocations.length ? data.invocations.map((invocation) => (
                        <div key={invocation.id} className="rounded-xl border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{invocation.status}</span>
                            <span className="text-xs text-muted-foreground">{new Date(invocation.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">{invocation.trigger} · {invocation.versionId}</div>
                          <div className="mt-2 whitespace-pre-wrap text-xs">{invocation.output}</div>
                          {invocation.traces.length ? (
                            <div className="mt-3 space-y-2 border-t pt-3">
                              {invocation.traces.map((trace) => (
                                <div key={`${invocation.id}-${trace.nodeId}`} className={`rounded-lg border px-2 py-2 text-xs ${selectedNodeId === trace.nodeId ? "border-primary bg-primary/5" : "border-border"}`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium">{trace.label}</span>
                                    <span className="text-muted-foreground">{trace.status}</span>
                                  </div>
                                  <div className="mt-1 text-muted-foreground">{trace.output}</div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )) : <div className="text-muted-foreground">No workflow runs yet.</div>}
                    </div>
                  </div>
                </CardContent>
              </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default WorkflowDetailPage