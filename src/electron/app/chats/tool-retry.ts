import { z } from "zod"
import { executeChatTool } from "@/electron/app/chats/chat-tools"
import { chatApplicationService } from "@/electron/app/chats/service"

const retryToolSchema = z.object({
  sessionId: z.string().min(1),
  activity: z.object({ toolName: z.string().min(1), input: z.record(z.string(), z.unknown()).optional() }),
})
function stringify(value: unknown) {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
function readString(input: Record<string, unknown>, key: string, message: string) {
  const value = input[key]
  if (typeof value !== "string" || !value) throw new Error(message)
  return value
}

export async function retryChatToolActivity(value: unknown) {
  const { sessionId, activity } = retryToolSchema.parse(value)
  const input = activity.input ?? {}
  if (activity.toolName === "readWorkspaceFile") readString(input, "path", "Tool input is missing the file path.")
  if (activity.toolName === "writeWorkspaceFile") {
    readString(input, "path", "Tool input is missing the file path.")
    readString(input, "content", "Tool input is missing the file content.")
  }
  if (activity.toolName === "runWorkspaceCommand") readString(input, "command", "Tool input is missing the command.")
  if (activity.toolName === "openExternalUrl") readString(input, "url", "Tool input is missing the URL.")
  if (activity.toolName === "browser_click") readString(input, "selector", "Tool input is missing the CSS selector.")
  if (activity.toolName === "browser_fill") {
    readString(input, "selector", "Tool input is missing the selector.")
    readString(input, "value", "Tool input is missing the value.")
  }
  if (activity.toolName === "runIntegration") {
    readString(input, "integrationId", "Tool input is missing the integration ID.")
  }

  const session = await chatApplicationService.getSessionSettings(sessionId)
  return stringify(
    await executeChatTool(activity.toolName, input, {
      sessionId,
      selectedAgentId: session.selectedAgentId || undefined,
    }),
  )
}
