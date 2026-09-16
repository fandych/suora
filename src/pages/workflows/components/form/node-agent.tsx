import type { WorkflowNodeData } from "@/types/workflow"
import type { ResourceSelectorOption } from "@/types/resource-selector"
import type { WorkflowExpressionSuggestion } from "@/lib/workflow/expression-suggestions"
import { WorkflowExpressionInput } from "@/pages/workflows/components/workflow-expression-input"
import { WorkflowField, WorkflowPanelSection } from "@/pages/workflows/components/workflow-field"
import { WorkflowResourceSelect } from "@/pages/workflows/components/workflow-node-select"

export function NodeAgentForm({
  node,
  agents,
  modelOptions,
  updateNode,
  suggestions,
}: {
  node: WorkflowNodeData
  agents: ResourceSelectorOption[]
  modelOptions: ResourceSelectorOption[]
  updateNode: (patch: Partial<WorkflowNodeData>) => void
  suggestions: WorkflowExpressionSuggestion[]
}) {
  return (
    <WorkflowPanelSection title="Agent settings">
      <WorkflowResourceSelect
        label="Agent"
        emptyLabel="Select an agent"
        options={agents}
        value={node.agentId ?? ""}
        onChange={(event) => updateNode({ agentId: event.target.value })}
      />
      <WorkflowResourceSelect
        label="Model override"
        emptyLabel="Use default model"
        options={modelOptions}
        value={node.modelId ?? ""}
        onChange={(event) => updateNode({ modelId: event.target.value })}
      />
      <WorkflowField label="Prompt">
        <WorkflowExpressionInput
          multiline
          rows={6}
          value={node.prompt}
          onChange={(prompt) => updateNode({ prompt })}
          suggestions={suggestions}
        />
      </WorkflowField>
    </WorkflowPanelSection>
  )
}
