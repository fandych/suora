import { NativeSelectOption } from "@/components/ui/native-select"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowExpressionSuggestion } from "@/lib/workflow/expression-suggestions"
import { WorkflowExpressionInput } from "@/pages/workflows/components/workflow-expression-input"
import { WorkflowField, WorkflowPanelSection } from "@/pages/workflows/components/workflow-field"
import { WorkflowNodeSelect } from "@/pages/workflows/components/workflow-node-select"

export function NodeAgentForm({
  node,
  agents,
  modelOptions,
  updateNode,
  suggestions,
}: {
  node: WorkflowNodeData
  agents: Array<{ id: string; title: string }>
  modelOptions: Array<{ id: string; label: string }>
  updateNode: (patch: Partial<WorkflowNodeData>) => void
  suggestions: WorkflowExpressionSuggestion[]
}) {
  return (
    <WorkflowPanelSection title="Agent settings">
      <WorkflowNodeSelect
        label="Agent"
        value={node.agentId ?? ""}
        onChange={(event) => updateNode({ agentId: event.target.value })}
      >
        <NativeSelectOption value="">Select an agent</NativeSelectOption>
        {agents.map((agent) => (
          <NativeSelectOption key={agent.id} value={agent.id}>
            {agent.title}
          </NativeSelectOption>
        ))}
      </WorkflowNodeSelect>
      <WorkflowNodeSelect
        label="Model override"
        value={node.modelId ?? ""}
        onChange={(event) => updateNode({ modelId: event.target.value })}
      >
        <NativeSelectOption value="">Use default model</NativeSelectOption>
        {modelOptions.map((model) => (
          <NativeSelectOption key={model.id} value={model.id}>
            {model.label}
          </NativeSelectOption>
        ))}
      </WorkflowNodeSelect>
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
