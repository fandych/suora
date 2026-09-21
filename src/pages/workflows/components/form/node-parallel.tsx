import { Input } from "@/components/ui/input"
import { NativeSelectOption } from "@/components/ui/native-select"
import type { ChangeEvent } from "react"
import type { WorkflowNodeData } from "@/types/workflow"
import { WorkflowField, WorkflowPanelSection } from "@/pages/workflows/components/workflow-field"
import { WorkflowNodeSelect } from "@/pages/workflows/components/workflow-node-select"

export function NodeParallelForm({
  node,
  updateNode,
}: {
  node: WorkflowNodeData
  updateNode: (patch: Partial<WorkflowNodeData>) => void
}) {
  return (
    <WorkflowPanelSection title="Parallel execution">
      <WorkflowField label="Concurrency">
        <Input
          type="number"
          min={2}
          max={20}
          value={String(node.concurrency ?? 2)}
          onChange={(event) => updateNode({ concurrency: Math.max(2, Math.min(20, Number(event.target.value) || 2)) })}
        />
      </WorkflowField>
      <WorkflowNodeSelect
        label="Merge strategy"
        value={node.mergeStrategy ?? "all-settled"}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          updateNode({ mergeStrategy: event.target.value as "all-settled" | "fail-fast" })
        }
      >
        <NativeSelectOption value="all-settled">All settled</NativeSelectOption>
        <NativeSelectOption value="fail-fast">Fail fast</NativeSelectOption>
      </WorkflowNodeSelect>
    </WorkflowPanelSection>
  )
}
