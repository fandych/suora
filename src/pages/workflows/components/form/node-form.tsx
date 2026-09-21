import type { DocumentSummary } from "@/types/document"
import type { IntegrationSummary } from "@/types/integration"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowExpressionSuggestion } from "@/lib/workflow/expression-suggestions"
import { NodeAgentForm } from "@/pages/workflows/components/form/node-agent"
import { NodeAiResponseForm } from "@/pages/workflows/components/form/node-ai-response"
import { NodeConditionForm } from "@/pages/workflows/components/form/node-condition"
import { NodeDocumentRetrievalForm } from "@/pages/workflows/components/form/node-document-retrieval"
import { NodeEmailForm } from "@/pages/workflows/components/form/node-email"
import { NodeEndForm } from "@/pages/workflows/components/form/node-end"
import { NodeForkForm } from "@/pages/workflows/components/form/node-fork"
import { NodeHttpForm } from "@/pages/workflows/components/form/node-http"
import { NodeIfElseForm } from "@/pages/workflows/components/form/node-if-else"
import { NodeJoinForm } from "@/pages/workflows/components/form/node-join"
import { NodeLoopForm } from "@/pages/workflows/components/form/node-loop"
import { NodeParallelForm } from "@/pages/workflows/components/form/node-parallel"
import { NodeScriptForm } from "@/pages/workflows/components/form/node-script"
import { NodeSerialForm } from "@/pages/workflows/components/form/node-serial"
import { NodeStartForm } from "@/pages/workflows/components/form/node-start"
import { NodeTemplateForm } from "@/pages/workflows/components/form/node-template"
import { NodeVariableAssignerForm } from "@/pages/workflows/components/form/node-variable-assigner"
import { NodeWikiRetrievalForm } from "@/pages/workflows/components/form/node-wiki-retrieval"
import { NodeDefaultForm } from "@/pages/workflows/components/form/node-default"

export function NodeForm({
  node,
  agents,
  documents,
  integrations,
  modelOptions,
  updateNode,
  suggestions,
}: {
  node: WorkflowNodeData
  agents: Array<{ id: string; label: string; enabled: boolean }>
  documents: DocumentSummary[]
  integrations: IntegrationSummary[]
  modelOptions: Array<{ id: string; label: string; enabled: boolean }>
  updateNode: (patch: Partial<WorkflowNodeData>) => void
  suggestions: WorkflowExpressionSuggestion[]
}) {
  switch (node.kind) {
    case "start":
      return <NodeStartForm node={node} updateNode={updateNode} />
    case "end":
      return <NodeEndForm node={node} updateNode={updateNode} suggestions={suggestions} />
    case "agent":
      return (
        <NodeAgentForm
          node={node}
          agents={agents}
          modelOptions={modelOptions}
          updateNode={updateNode}
          suggestions={suggestions}
        />
      )
    case "ai-response":
      return (
        <NodeAiResponseForm node={node} modelOptions={modelOptions} updateNode={updateNode} suggestions={suggestions} />
      )
    case "condition":
      return <NodeConditionForm node={node} updateNode={updateNode} suggestions={suggestions} />
    case "if-else":
      return <NodeIfElseForm node={node} updateNode={updateNode} suggestions={suggestions} />
    case "document-retrieval":
      return (
        <NodeDocumentRetrievalForm
          node={node}
          documents={documents}
          updateNode={updateNode}
          suggestions={suggestions}
        />
      )
    case "wiki-retrieval":
      return <NodeWikiRetrievalForm node={node} documents={documents} updateNode={updateNode} suggestions={suggestions} />
    case "http":
    case "toolset":
    case "webhook":
      return <NodeHttpForm node={node} integrations={integrations} updateNode={updateNode} suggestions={suggestions} />
    case "smtp":
      return <NodeEmailForm node={node} updateNode={updateNode} suggestions={suggestions} />
    case "script":
      return <NodeScriptForm node={node} updateNode={updateNode} />
    case "variable-assigner":
      return <NodeVariableAssignerForm node={node} updateNode={updateNode} suggestions={suggestions} />
    case "template":
      return <NodeTemplateForm node={node} updateNode={updateNode} suggestions={suggestions} />
    case "loop":
      return <NodeLoopForm node={node} updateNode={updateNode} suggestions={suggestions} />
    case "parallel":
      return <NodeParallelForm node={node} updateNode={updateNode} />
    case "serial":
      return <NodeSerialForm node={node} updateNode={updateNode} />
    case "fork":
      return <NodeForkForm node={node} updateNode={updateNode} />
    case "join":
      return <NodeJoinForm node={node} updateNode={updateNode} />
    default:
      return <NodeDefaultForm node={node} updateNode={updateNode} suggestions={suggestions} />
  }
}
