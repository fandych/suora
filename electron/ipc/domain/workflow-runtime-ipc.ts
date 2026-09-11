import { ipcMain } from "electron"
import { z } from "zod"

const runRequestSchema = z.object({ requestId: z.string().min(1).max(128), workflowId: z.string().min(1), versionId: z.string().min(1), definition: z.unknown(), input: z.unknown(), mode: z.enum(["dry-run", "manual"]) })
const activeRuns = new Set<string>()

export function registerWorkflowRuntimeIpc() {
  ipcMain.handle("workflows:run:start", async (_event, value: unknown) => {
    const command = runRequestSchema.parse(value)
    activeRuns.add(command.requestId)
    _event.sender.send("workflow:run:event", { requestId: command.requestId, type: "started" })
    return { accepted: true, requestId: command.requestId, mode: command.mode, state: "queued" }
  })
  ipcMain.handle("workflows:run:cancel", async (_event, requestId: unknown) => {
    const id = z.string().min(1).max(128).parse(requestId)
    const wasActive = activeRuns.delete(id)
    if (wasActive) _event.sender.send("workflow:run:event", { requestId: id, type: "cancelled" })
    return { cancelled: wasActive, requestId: id }
  })
}
