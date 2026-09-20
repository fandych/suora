import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"
import { interpolate } from "@/electron/app/workflows/variable-context"

export const executeEmailNode: WorkflowNodeExecutor = async (node, context, _mode, signal) => {
  const runtime = (
    context as typeof context & {
      runtime?: { sendMail: (payload: { to: string; subject: string; content: string }, abortSignal?: AbortSignal) => Promise<unknown> }
    }
  ).runtime
  if (!runtime) throw new Error("Workflow runtime is missing mail execution capability.")
  return runtime.sendMail({
    to: interpolate(node.data.emailTo ?? "", context),
    subject: interpolate(node.data.emailSubject ?? "", context),
    content: interpolate(node.data.emailBody ?? "", context),
  }, signal)
}
