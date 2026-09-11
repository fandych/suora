import type { WorkflowRunCommand } from "@/services/workflows/workflow-run-protocol"
import { getProjectBridge } from "@/lib/ipc/bridge"

export const workflowRuntimeIpc = {
  start: (command: WorkflowRunCommand) => getProjectBridge().workflows.startRun(command),
  cancel: (requestId: string) => getProjectBridge().workflows.cancelRun(requestId),
  onRunEvent: (listener: (event: unknown) => void) => getProjectBridge().workflows.onRunEvent(listener),
  offRunEvent: (listener: (event: unknown) => void) => getProjectBridge().workflows.offRunEvent(listener),
}
