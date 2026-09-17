import { Input } from "@/components/ui/input"
import type { ChangeEvent } from "react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { ResourceSelectorOption } from "@/types/resource-selector"
import type { WorkflowExpressionSuggestion } from "@/lib/workflow/expression-suggestions"
import { WorkflowExpressionInput } from "@/pages/workflows/components/workflow-expression-input"
import { WorkflowField, WorkflowPanelSection } from "@/pages/workflows/components/workflow-field"
import { WorkflowNodeSelect, WorkflowResourceSelect } from "@/pages/workflows/components/workflow-node-select"

export function NodeAiResponseForm({
  node,
  modelOptions,
  updateNode,
  suggestions,
}: {
  node: WorkflowNodeData
  modelOptions: ResourceSelectorOption[]
  updateNode: (patch: Partial<WorkflowNodeData>) => void
  suggestions: WorkflowExpressionSuggestion[]
}) {
  return (
    <WorkflowPanelSection title="AI response">
      <WorkflowResourceSelect
        label="Model"
        emptyLabel="Use default model"
        options={modelOptions}
        value={node.modelId ?? ""}
        onChange={(event) => updateNode({ modelId: event.target.value })}
      />
      <WorkflowField label="System instructions">
        <WorkflowExpressionInput
          multiline
          rows={3}
          value={node.systemPrompt ?? ""}
          onChange={(systemPrompt) => updateNode({ systemPrompt })}
          suggestions={suggestions}
        />
      </WorkflowField>
      <div className="grid gap-3 sm:grid-cols-2">
        <WorkflowField label="Temperature">
          <Input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={String(node.temperature ?? 0.7)}
            onChange={(event) => updateNode({ temperature: Math.max(0, Math.min(2, Number(event.target.value) || 0)) })}
          />
        </WorkflowField>
        <WorkflowField label="Max tokens">
          <Input
            type="number"
            min={1}
            max={32768}
            value={String(node.maxTokens ?? 1024)}
            onChange={(event) => updateNode({ maxTokens: Math.max(1, Number(event.target.value) || 1) })}
          />
        </WorkflowField>
      </div>
      <WorkflowNodeSelect
        label="Response format"
        value={node.responseFormat ?? "text"}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          updateNode({ responseFormat: event.target.value as "text" | "json" })
        }
      >
        <option value="text">Text</option>
        <option value="json">JSON</option>
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
