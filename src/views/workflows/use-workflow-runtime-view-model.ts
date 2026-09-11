import { useCallback, useEffect, useState } from "react"
import type { WorkflowDefinition, WorkflowInvocationRecord } from "@/data/domain/models"
import { projectIpc } from "@/lib/ipc"
import type { WorkflowRunEvent } from "@/services/workflows/workflow-run-protocol"

export type WorkflowRuntimeViewModel = {
  requestId: string | null
  status: "idle" | "queued" | "running" | "completed" | "failed" | "cancelled"
  error: string | null
  invocation: WorkflowInvocationRecord | null
  start: (input: { workflowId: string; versionId: string; definition: WorkflowDefinition; input: unknown; mode: "dry-run" | "manual" }) => Promise<void>
  cancel: () => Promise<void>
}

export function useWorkflowRuntimeViewModel(): WorkflowRuntimeViewModel {
  const [requestId, setRequestId] = useState<string | null>(null)
  const [status, setStatus] = useState<WorkflowRuntimeViewModel["status"]>("idle")
  const [error, setError] = useState<string | null>(null)
  const [invocation, setInvocation] = useState<WorkflowInvocationRecord | null>(null)

  useEffect(() => {
    const handleEvent = (rawEvent: unknown) => {
      if (!rawEvent || typeof rawEvent !== "object") return
      const event = rawEvent as WorkflowRunEvent
      if (!requestId || event.requestId !== requestId) return
      if (event.type === "started") setStatus("running")
      if (event.type === "trace" && event.trace) setStatus("running")
      if (event.type === "completed") {
        setStatus("completed")
        setInvocation(event.invocation ?? null)
      }
      if (event.type === "failed") {
        setStatus("failed")
        setError(event.error ?? "Workflow execution failed.")
      }
      if (event.type === "cancelled") setStatus("cancelled")
    }

    projectIpc.workflows.onRunEvent(handleEvent)
    return () => projectIpc.workflows.offRunEvent(handleEvent)
  }, [requestId])

  const start = useCallback(async (input: Parameters<WorkflowRuntimeViewModel["start"]>[0]) => {
    const nextRequestId = crypto.randomUUID()
    setRequestId(nextRequestId)
    setStatus("queued")
    setError(null)
    setInvocation(null)
    await projectIpc.workflows.start({ ...input, requestId: nextRequestId })
  }, [])

  const cancel = useCallback(async () => {
    if (!requestId) return
    await projectIpc.workflows.cancel(requestId)
  }, [requestId])

  return { requestId, status, error, invocation, start, cancel }
}
