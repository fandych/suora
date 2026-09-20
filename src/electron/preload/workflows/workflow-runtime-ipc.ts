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
import type { ChatRuntimeSettings } from "@/types/chat"

const activeRuns = new Map<string, AbortController>()
const cancelledRunIds = new Set<string>()

function sendIfAlive(sender: Electron.WebContents, payload: WorkflowRunEvent | { requestId: string; type: "started" | "cancelled" }) {
  if (sender.isDestroyed()) return
  try {
    sender.send("workflow:run:event", payload)
  } catch {
    // Ignore renderer teardown races.
  }
}

export function registerWorkflowRuntimeIpc() {
  ipcMain.handle("workflows:run:start", async (_event, value: unknown) => {
    const command = await executeWorkflowRun(value)
    if (activeRuns.has(command.requestId)) {
      throw new Error("A workflow run with the same requestId is already active.")
    }
    const controller = new AbortController()
    activeRuns.set(command.requestId, controller)
    let terminalState: "completed" | "failed" | "cancelled" | null = null
    const finishRun = (nextState: typeof terminalState) => {
      if (terminalState) return false
      terminalState = nextState
      activeRuns.delete(command.requestId)
      return true
    }
    sendIfAlive(_event.sender, { requestId: command.requestId, type: "started" })
    const runtime = {
      getChatRuntimeSettings: () =>
        chatApplicationService.getSessionSettings(null).then((settings) => settings.runtime as ChatRuntimeSettings),
      executeAgent: (
        input: { prompt: string; systemPrompt?: string; modelId?: string; selectedAgentId?: string },
        abortSignal?: AbortSignal,
      ) => runWorkflowAgent(input, abortSignal ?? controller.signal),
      getDocumentDetail: (documentId: string) => documentService.get(documentId),
      executeIntegration: (
        config: import("@/types/integration").IntegrationConfig,
        inputJson: string,
        integrationId?: string,
        abortSignal?: AbortSignal,
      ) => integrationApplicationService.execute({ kind: config.kind, config, inputJson, integrationId, abortSignal }),
      sendMail: async (payload: { to: string; subject: string; content: string }, abortSignal?: AbortSignal) => {
        if (abortSignal?.aborted) throw new Error("Workflow execution cancelled.")
        const profile = getSystemMailProfile()
        if (!profile) return { success: false, error: "SMTP is not configured." }
        const result = await sendMail({ profile, toAddress: payload.to, subject: payload.subject, content: payload.content })
        if (abortSignal?.aborted) throw new Error("Workflow execution cancelled.")
        return result
      },
    }
    void executeWorkflowCommand(
      { ...command, runtime },
      (event) => sendIfAlive(_event.sender, event),
      controller.signal,
    )
      .then(async (result) => {
        if (cancelledRunIds.delete(command.requestId)) {
          finishRun("cancelled")
          return
        }
        if (!finishRun("completed")) return
        const invocation = (await workflowService.recordInvocation({
          workflowId: command.workflowId,
          versionId: command.versionId,
          status: "success",
          trigger: command.mode,
          input: JSON.stringify(command.input),
          output: JSON.stringify(result.output),
          traceJson: JSON.stringify(result.traces),
        })) as WorkflowInvocationRecord
        sendIfAlive(_event.sender, {
          requestId: command.requestId,
          type: "completed",
          invocation,
        } satisfies WorkflowRunEvent)
      })
      .catch(async (error) => {
        if (controller.signal.aborted) {
          cancelledRunIds.delete(command.requestId)
          finishRun("cancelled")
          return
        }
        if (finishRun("failed")) {
          const failureTraces =
            error instanceof Error && "traces" in error && Array.isArray((error as { traces?: unknown }).traces)
              ? ((error as { traces: WorkflowInvocationRecord["traces"] }).traces ?? [])
              : []
          const invocation = (await workflowService.recordInvocation({
            workflowId: command.workflowId,
            versionId: command.versionId,
            status: "error",
            trigger: command.mode,
            input: JSON.stringify(command.input),
            output: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
            traceJson: JSON.stringify(failureTraces),
          })) as WorkflowInvocationRecord
          sendIfAlive(_event.sender, {
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
    if (wasActive) cancelledRunIds.add(id)
    if (wasActive) sendIfAlive(_event.sender, { requestId: id, type: "cancelled" })
    return { cancelled: wasActive, requestId: id }
  })
}
