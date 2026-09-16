import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"
import { interpolate } from "@/electron/app/workflows/variable-context"

export const executeDocumentRetrievalNode: WorkflowNodeExecutor = async (node, context) => {
  const runtime = (
    context as typeof context & { runtime?: { getDocumentDetail: (documentId: string) => Promise<unknown> } }
  ).runtime
  if (!runtime || !node.data.documentId) throw new Error("Document retrieval runtime or document is missing.")
  const detail = await runtime.getDocumentDetail(node.data.documentId)
  const query = interpolate(node.data.queryExpression ?? "", context)
  const pages = (detail as { pages?: Array<{ id: string; title: string; content: string }> }).pages ?? []
  const normalized = query.toLowerCase()
  return pages
    .filter((page) => `${page.title}\n${page.content}`.toLowerCase().includes(normalized))
    .slice(0, node.data.resultLimit ?? 5)
    .map((page) => ({ id: page.id, title: page.title, content: page.content }))
}
