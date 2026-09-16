import { ipcMain } from "electron"
import { z } from "zod"
import { executeWorkflowRun } from "@/electron/app/workflows/runtime"
import { executeWorkflowCommand } from "@/electron/app/workflows/execute-engine"
import { workflowService } from "@/electron/app/workflows/service"
import type { WorkflowInvocationRecord, WorkflowRunEvent } from "@/types/workflow"
import { chatApplicationService } from "@/electron/app/chats/service"
import { runWorkflowAgent } from "@/electron/app/workflows/runtime-agent"
import { documentService } from "@/electron/app/documents/service"
import { integrationApplicationService } from "@/electron/app/integrations/service"
import { getSystemMailProfile, sendMail } from "@/electron/app/channels/mail-service"

const activeRuns = new Map<string, AbortController>()

export function registerWorkflowRuntimeIpc() {
  ipcMain.handle("workflows:run:start", async (_event, value: unknown) => {
    const command = await executeWorkflowRun(value)
    const controller = new AbortController()
    activeRuns.set(command.requestId, controller)
    _event.sender.send("workflow:run:event", { requestId: command.requestId, type: "started" })
    const runtime = {
      getChatRuntimeSettings: () =>
        chatApplicationService.getSessionSettings(null).then((settings) => settings.runtime),
      executeAgent: (input: { prompt: string; systemPrompt?: string; modelId?: string; selectedAgentId?: string }) =>
        runWorkflowAgent(input, controller.signal),
      getDocumentDetail: (documentId: string) => documentService.get(documentId),
      executeIntegration: (
        config: import("@/types/integration").IntegrationConfig,
        inputJson: string,
        integrationId?: string,
      ) => integrationApplicationService.execute({ kind: "http", config, inputJson, integrationId }),
      sendMail: async (payload: { to: string; subject: string; content: string }) => {
        const profile = getSystemMailProfile()
        if (!profile) return { success: false, error: "SMTP is not configured." }
        return sendMail({ profile, toAddress: payload.to, subject: payload.subject, content: payload.content })
      },
    }
    void executeWorkflowCommand(
      { ...command, runtime },
      (event) => _event.sender.send("workflow:run:event", event),
      controller.signal,
    )
      .then(async (result) => {
        activeRuns.delete(command.requestId)
        const invocation = (await workflowService.recordInvocation({
          workflowId: command.workflowId,
          versionId: command.versionId,
          status: "success",
          trigger: command.mode,
          input: JSON.stringify(command.input),
          output: JSON.stringify(result.output),
          traceJson: JSON.stringify(result.traces),
        })) as WorkflowInvocationRecord
        _event.sender.send("workflow:run:event", {
          requestId: command.requestId,
          type: "completed",
          invocation,
        } satisfies WorkflowRunEvent)
      })
      .catch(async (error) => {
        activeRuns.delete(command.requestId)
        if (!controller.signal.aborted) {
          const invocation = (await workflowService.recordInvocation({
            workflowId: command.workflowId,
            versionId: command.versionId,
            status: "error",
            trigger: command.mode,
            input: JSON.stringify(command.input),
            output: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
            traceJson: "[]",
          })) as WorkflowInvocationRecord
          _event.sender.send("workflow:run:event", {
            requestId: command.requestId,
            type: "failed",
            error: error instanceof Error ? error.message : String(error),
            invocation,
          })
        }
      })
    return { accepted: true, requestId: command.requestId, mode: command.mode, state: "queued" }
  })
  ipcMain.handle("workflows:run:cancel", async (_event, requestId: unknown) => {
    const id = z.string().min(1).max(128).parse(requestId)
    const controller = activeRuns.get(id)
    const wasActive = Boolean(controller)
    controller?.abort()
    activeRuns.delete(id)
    if (wasActive) _event.sender.send("workflow:run:event", { requestId: id, type: "cancelled" })
    return { cancelled: wasActive, requestId: id }
  })
}
