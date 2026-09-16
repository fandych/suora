import { NativeSelectOption } from "@/components/ui/native-select"
import type { IntegrationSummary } from "@/types/integration"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowExpressionSuggestion } from "@/lib/workflow/expression-suggestions"
import { WorkflowExpressionInput } from "@/pages/workflows/components/workflow-expression-input"
import { WorkflowField, WorkflowPanelSection } from "@/pages/workflows/components/workflow-field"
import { WorkflowKeyValueEditor } from "@/pages/workflows/components/workflow-parameter-editor"
import { WorkflowNodeSelect } from "@/pages/workflows/components/workflow-node-select"

export function NodeHttpForm({
  node,
  integrations,
  updateNode,
  suggestions,
}: {
  node: WorkflowNodeData
  integrations: IntegrationSummary[]
  updateNode: (patch: Partial<WorkflowNodeData>) => void
  suggestions: WorkflowExpressionSuggestion[]
}) {
  return (
    <WorkflowPanelSection title={node.kind === "webhook" ? "Webhook" : node.kind === "toolset" ? "Toolset" : "HTTP"}>
      <WorkflowNodeSelect
        label="Integration"
        value={node.integrationId ?? ""}
        onChange={(event) => {
          const integration = integrations.find((item) => item.id === event.target.value)
          updateNode({ integrationId: event.target.value, integrationName: integration?.title ?? "" })
        }}
      >
        <NativeSelectOption value="">Select integration</NativeSelectOption>
        {integrations.map((integration) => (
          <NativeSelectOption key={integration.id} value={integration.id}>
            {integration.title}
          </NativeSelectOption>
        ))}
      </WorkflowNodeSelect>
      <WorkflowNodeSelect
        label="Method"
        value={node.method ?? "POST"}
        onChange={(event) => updateNode({ method: event.target.value })}
      >
        {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => (
          <NativeSelectOption key={method} value={method}>
            {method}
          </NativeSelectOption>
        ))}
      </WorkflowNodeSelect>
      <WorkflowField label="URL">
        <WorkflowExpressionInput
          value={node.url ?? ""}
          onChange={(url) => updateNode({ url })}
          suggestions={suggestions}
          placeholder="https://api.example.com/${input.id}"
        />
      </WorkflowField>
      <WorkflowKeyValueEditor
        label="Query parameters"
        value={node.queryJson ?? "{}"}
        onChange={(queryJson) => updateNode({ queryJson })}
        suggestions={suggestions}
      />
      <WorkflowKeyValueEditor
        label="Headers"
        value={node.headersJson ?? "{}"}
        onChange={(headersJson) => updateNode({ headersJson })}
        suggestions={suggestions}
      />
      <WorkflowField label="Body">
        <WorkflowExpressionInput
          multiline
          rows={5}
          value={node.bodyJson ?? "{}"}
          onChange={(bodyJson) => updateNode({ bodyJson })}
          suggestions={suggestions}
        />
      </WorkflowField>
    </WorkflowPanelSection>
  )
}
