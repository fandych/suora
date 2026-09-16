import { Input } from "@/components/ui/input"
import { NativeSelectOption } from "@/components/ui/native-select"
import type { DocumentSummary } from "@/types/document"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowExpressionSuggestion } from "@/lib/workflow/expression-suggestions"
import { WorkflowExpressionInput } from "@/pages/workflows/components/workflow-expression-input"
import { WorkflowField, WorkflowPanelSection } from "@/pages/workflows/components/workflow-field"
import { WorkflowNodeSelect } from "@/pages/workflows/components/workflow-node-select"

export function NodeDocumentRetrievalForm({
  node,
  documents,
  updateNode,
  suggestions,
}: {
  node: WorkflowNodeData
  documents: DocumentSummary[]
  updateNode: (patch: Partial<WorkflowNodeData>) => void
  suggestions: WorkflowExpressionSuggestion[]
}) {
  return (
    <WorkflowPanelSection title="Document retrieval">
      <WorkflowNodeSelect
        label="Document"
        value={node.documentId ?? ""}
        onChange={(event) => {
          const document = documents.find((item) => item.id === event.target.value)
          updateNode({ documentId: event.target.value, documentName: document?.title ?? "" })
        }}
      >
        <NativeSelectOption value="">Select a document</NativeSelectOption>
        {documents.map((document) => (
          <NativeSelectOption key={document.id} value={document.id}>
            {document.title}
          </NativeSelectOption>
        ))}
      </WorkflowNodeSelect>
      <WorkflowField label="Search question">
        <WorkflowExpressionInput
          value={node.queryExpression ?? ""}
          onChange={(queryExpression) => updateNode({ queryExpression })}
          suggestions={suggestions}
        />
      </WorkflowField>
      <WorkflowField label="Result limit">
        <Input
          type="number"
          min={1}
          max={20}
          value={String(node.resultLimit ?? 5)}
          onChange={(event) => updateNode({ resultLimit: Math.max(1, Math.min(20, Number(event.target.value) || 5)) })}
        />
      </WorkflowField>
    </WorkflowPanelSection>
  )
}
