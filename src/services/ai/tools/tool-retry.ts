import { getDocumentDetail } from "@/data/repositories/document-repository"
import { executeIntegration } from "@/data/repositories/integration-execution-repository"
import { getIntegrationDetail } from "@/data/repositories/integration-repository"
import { getSkillDetail } from "@/data/repositories/skill-repository"
import { getWorkflowDetail } from "@/data/repositories/workflow-repository"
import { projectIpc } from "@/lib/ipc"
import { executeHttpTool } from "@/services/ai/tools/http-tools"
import { searchDocuments, searchSkills, searchWorkflows } from "@/services/ai/tools/resource-search-tools"

export type RetryableToolActivity = { toolName: string; input?: Record<string, unknown> }
export type RetryContext = {
  scopedDocuments?: Array<Awaited<ReturnType<typeof getDocumentDetail>> | null>
  scopedSkills?: Array<Awaited<ReturnType<typeof getSkillDetail>> | null>
  scopedWorkflows?: Array<Awaited<ReturnType<typeof getWorkflowDetail>> | null>
  scopedIntegrations?: Array<Awaited<ReturnType<typeof getIntegrationDetail>> | null>
}

function stringifyToolResult(value: unknown) {
  if (typeof value === "string") return value
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

export async function retryToolActivity(activity: RetryableToolActivity, context?: RetryContext & { browserSessionId?: string }) {
  const input = activity.input ?? {}
  switch (activity.toolName) {
    case "listWorkspaceFiles": return stringifyToolResult(await projectIpc.tools.listFiles(typeof input.relativePath === "string" ? input.relativePath : undefined))
    case "readWorkspaceFile":
      if (typeof input.path !== "string") throw new Error("Tool input is missing the file path.")
      return stringifyToolResult(await projectIpc.tools.readFile(input.path))
    case "writeWorkspaceFile":
      if (typeof input.path !== "string" || typeof input.content !== "string") throw new Error("Tool input is missing the file path or content.")
      return stringifyToolResult(await projectIpc.tools.writeFile({ path: input.path, content: input.content }))
    case "runWorkspaceCommand":
      if (typeof input.command !== "string") throw new Error("Tool input is missing the command.")
      return stringifyToolResult(await projectIpc.tools.runCommand({ command: input.command, cwd: typeof input.cwd === "string" ? input.cwd : undefined, timeoutMs: typeof input.timeoutMs === "number" ? input.timeoutMs : undefined }))
    case "openExternalUrl":
      if (typeof input.url !== "string") throw new Error("Tool input is missing the URL.")
      return stringifyToolResult(await projectIpc.tools.openExternal(input.url))
    case "browser_navigate": return stringifyToolResult(await projectIpc.tools.browserNavigate({ sessionId: context?.browserSessionId, url: typeof input.url === "string" ? input.url : undefined, visible: typeof input.visible === "boolean" ? input.visible : false }))
    case "browser_page": return stringifyToolResult(await projectIpc.tools.browserPage({ sessionId: context?.browserSessionId, includeText: typeof input.includeText === "boolean" ? input.includeText : true, includeLinks: typeof input.includeLinks === "boolean" ? input.includeLinks : false }))
    case "browser_click":
      if (typeof input.selector !== "string") throw new Error("Tool input is missing the CSS selector.")
      return stringifyToolResult(await projectIpc.tools.browserClick(context?.browserSessionId ?? "global", input.selector))
    case "browser_fill":
      if (typeof input.selector !== "string" || typeof input.value !== "string") throw new Error("Tool input is missing the selector or value.")
      return stringifyToolResult(await projectIpc.tools.browserFill({ sessionId: context?.browserSessionId, selector: input.selector, value: input.value }))
    case "httpRequest": return stringifyToolResult(await executeHttpTool(input, "chat http tool retry"))
    case "searchDocuments":
      if (typeof input.query !== "string" || !input.query) throw new Error("Tool input is missing the document query.")
      return stringifyToolResult(await searchDocuments(input.query, context?.scopedDocuments ?? []))
    case "searchSkills":
      if (typeof input.query !== "string" || !input.query) throw new Error("Tool input is missing the skill query.")
      return stringifyToolResult(await searchSkills(input.query, context?.scopedSkills ?? []))
    case "searchWorkflows":
      if (typeof input.query !== "string" || !input.query) throw new Error("Tool input is missing the workflow query.")
      return stringifyToolResult(await searchWorkflows(input.query, context?.scopedWorkflows ?? []))
    case "runIntegration": {
      const integrationId = typeof input.integrationId === "string" ? input.integrationId : ""
      if (!integrationId) throw new Error("Tool input is missing the integration ID.")
      const boundIntegration = context?.scopedIntegrations?.find((item) => item?.integration.id === integrationId)
      if (context?.scopedIntegrations?.length && !boundIntegration) throw new Error("The selected agent cannot access this integration.")
      const detail = boundIntegration ?? await getIntegrationDetail(integrationId)
      const result = await executeIntegration(detail.config, typeof input.inputJson === "string" ? input.inputJson : "{}")
      return stringifyToolResult({ integration: detail.integration.title, ok: result.ok, status: result.status, body: result.body })
    }
    default: throw new Error(`Retry is not available for ${activity.toolName}.`)
  }
}
