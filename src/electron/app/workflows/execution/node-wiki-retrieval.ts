import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"
import { interpolate } from "@/electron/app/workflows/variable-context"

export const executeWikiRetrievalNode: WorkflowNodeExecutor = async (node, context) => {
  const runtime = (
    context as typeof context & { runtime?: { getDocumentDetail: (documentId: string) => Promise<unknown> } }
  ).runtime
  const documentId = node.data.documentId || (context as typeof context & { resourceBindings?: { documentId?: string } }).resourceBindings?.documentId
  if (!runtime || !documentId) throw new Error("Wiki retrieval runtime or bound document is missing.")
  const detail = await runtime.getDocumentDetail(documentId)
  const query = interpolate(node.data.queryExpression ?? node.data.prompt ?? "", context).toLowerCase()
  const pages = (detail as { pages?: Array<{ id: string; title: string; content: string }> }).pages ?? []
  return pages
    .filter((page) => `${page.title}\n${page.content}`.toLowerCase().includes(query))
    .slice(0, node.data.resultLimit ?? 5)
    .map((page) => ({ id: page.id, title: page.title, content: page.content }))
}