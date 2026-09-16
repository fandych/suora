import { interpolate } from "@/electron/app/workflows/variable-context"
import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"

export const executeTemplateNode: WorkflowNodeExecutor = async (node, context) => {
  const rendered = interpolate(node.data.template ?? node.data.prompt, context)
  if (node.data.templateOutputFormat === "json") {
    try {
      return JSON.parse(rendered)
    } catch {
      return rendered
    }
  }
  return rendered
}
