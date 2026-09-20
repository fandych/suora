import { Input } from "@/components/ui/input"
import { NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import type { ChangeEvent } from "react"
import type { WorkflowNodeData } from "@/types/workflow"
import { WorkflowField, WorkflowPanelSection } from "@/pages/workflows/components/workflow-field"
import { WorkflowNodeSelect } from "@/pages/workflows/components/workflow-node-select"

export function NodeScriptForm({
  node,
  updateNode,
}: {
  node: WorkflowNodeData
  updateNode: (patch: Partial<WorkflowNodeData>) => void
}) {
  return (
    <WorkflowPanelSection title="Script">
      <WorkflowNodeSelect
        label="Runtime"
        value={node.runtime ?? "node"}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => updateNode({ runtime: event.target.value })}
      >
        <NativeSelectOption value="node">Node</NativeSelectOption>
        <NativeSelectOption value="javascript">JavaScript</NativeSelectOption>
      </WorkflowNodeSelect>
      <WorkflowField label="Timeout seconds">
        <Input
          type="number"
          min={1}
          max={60}
          value={String(node.timeoutSeconds ?? 60)}
          onChange={(event) =>
            updateNode({ timeoutSeconds: Math.max(1, Math.min(60, Number(event.target.value) || 60)) })
          }
        />
      </WorkflowField>
      <WorkflowField label="Script">
        <Textarea
          className="min-h-40 font-mono text-xs"
          value={node.script ?? ""}
          onChange={(event) => updateNode({ script: event.target.value })}
        />
      </WorkflowField>
    </WorkflowPanelSection>
  )
}
