import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowExpressionSuggestion } from "@/lib/workflow/expression-suggestions"
import { WorkflowParameterEditor } from "@/pages/workflows/components/workflow-parameter-editor"
import { WorkflowPanelSection } from "@/pages/workflows/components/workflow-field"

export function NodeIfElseForm({
  node,
  updateNode,
  suggestions,
}: {
  node: WorkflowNodeData
  updateNode: (patch: Partial<WorkflowNodeData>) => void
  suggestions: WorkflowExpressionSuggestion[]
}) {
  const branches = node.branches ?? [
    { id: "true", label: node.trueLabel ?? "True", expression: node.runIf ?? "" },
    { id: "false", label: node.falseLabel ?? "False", expression: "" },
  ]
  return (
    <WorkflowPanelSection title="Branch rules">
      <WorkflowParameterEditor
        items={branches.map((branch, index) => ({
          id: branch.id,
          name: branch.label,
          value: index === branches.length - 1 ? "Always selected when no condition matches" : branch.expression,
          namePlaceholder: index === 0 ? "If" : index === branches.length - 1 ? "Else" : `Else if ${index}`,
          valuePlaceholder: "$input.amount > 1000",
          valueDisabled: index === branches.length - 1,
        }))}
        nameLabel="Branch name"
        valueLabel="Condition expression"
        onNameChange={(itemId, value) =>
          updateNode({ branches: branches.map((item) => (item.id === itemId ? { ...item, label: value } : item)) })
        }
        onValueChange={(itemId, value) =>
          updateNode({
            runIf: branches[0]?.id === itemId ? value : node.runIf,
            branches: branches.map((item) => (item.id === itemId ? { ...item, expression: value } : item)),
          })
        }
        onAdd={() =>
          updateNode({
            branches: [
              ...branches.slice(0, -1),
              { id: `branch-${branches.length}`, label: `Else if ${branches.length - 1}`, expression: "" },
              branches.at(-1)!,
            ],
          })
        }
        addLabel="Add elseif branch"
        suggestions={suggestions}
      />
    </WorkflowPanelSection>
  )
}
