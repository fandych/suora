import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from "react"
import type { Edge, Node, Viewport } from "@xyflow/react"
import type {
  WorkflowBudget,
  WorkflowDefinition,
  WorkflowEdgeData,
  WorkflowNodeData,
  WorkflowNotificationSettings,
  WorkflowVariable,
} from "@/types/workflow"
import { showToast } from "@/services/toast-service"
import {
  defaultWorkflowBindings,
  defaultWorkflowNotifications,
} from "@/lib/workflow/editor-config"
import { DEFAULT_WORKFLOW_DRY_RUN_INPUT } from "@/lib/workflow/editor-state"
import { exportWorkflowJson, parseWorkflowJson } from "@/lib/workflow/transfer"

export function useWorkflowTransferActions(input: {
  title: string
  summary: string
  definition: WorkflowDefinition
  versionLabel?: string
  isReadOnly: boolean
  hasUnsavedChanges: boolean
  importInputRef: RefObject<HTMLInputElement | null>
  setTitle: Dispatch<SetStateAction<string>>
  setSummary: Dispatch<SetStateAction<string>>
  setNodes: Dispatch<SetStateAction<Node<WorkflowNodeData>[]>>
  setEdges: Dispatch<SetStateAction<Edge<WorkflowEdgeData>[]>>
  setResourceBindings: Dispatch<SetStateAction<typeof defaultWorkflowBindings>>
  setNotifications: Dispatch<SetStateAction<WorkflowNotificationSettings>>
  setVariables: Dispatch<SetStateAction<WorkflowVariable[]>>
  setBudget: Dispatch<SetStateAction<WorkflowBudget | undefined>>
  setDryRunInput: Dispatch<SetStateAction<string>>
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>
  applyViewport: (viewport: Viewport) => void
}) {
  const handleExport = () =>
    exportWorkflowJson({
      title: input.title,
      summary: input.summary,
      definition: input.definition,
      versionLabel: input.versionLabel,
    })
  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    if (input.isReadOnly) {
      event.target.value = ""
      return
    }
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      showToast({ title: "Import failed", description: "Workflow JSON must be 5 MiB or smaller.", type: "error" })
      return
    }
    if (input.hasUnsavedChanges && !window.confirm("Importing replaces unsaved canvas changes. Continue?")) return
    try {
      const payload = parseWorkflowJson(await file.text())
      input.setTitle(payload.title)
      input.setSummary(payload.summary)
      input.setNodes(payload.definition.nodes)
      input.setEdges(payload.definition.edges)
      input.setResourceBindings(payload.definition.resourceBindings ?? defaultWorkflowBindings)
      input.setNotifications(payload.definition.notifications ?? defaultWorkflowNotifications)
      input.setVariables(payload.definition.variables ?? [])
      input.setBudget(payload.definition.budget)
      input.setDryRunInput(payload.definition.dryRunInputJson ?? DEFAULT_WORKFLOW_DRY_RUN_INPUT)
      input.setSelectedNodeId(payload.definition.nodes[0]?.id ?? null)
      input.applyViewport(payload.definition.viewport)
    } catch (error) {
      showToast({
        title: "Import failed",
        description: error instanceof Error ? error.message : String(error),
        type: "error",
      })
    }
  }
  return { handleExport, handleImport }
}
