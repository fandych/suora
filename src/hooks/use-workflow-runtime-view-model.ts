import { useCallback, useEffect, useState } from "react"
import type { WorkflowDefinition, WorkflowInvocationRecord, WorkflowRunEvent } from "@/types/workflow"
import { WorkflowApi } from "@/services/workflow-service"

export type WorkflowRuntimeViewModel = {
  requestId: string | null
  status: "idle" | "queued" | "running" | "completed" | "failed" | "cancelled"
  error: string | null
  invocation: WorkflowInvocationRecord | null
  start: (input: {
    workflowId: string
    versionId: string
    definition: WorkflowDefinition
    input: unknown
    mode: "dry-run" | "manual"
  }) => Promise<void>
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
      if (event.type === "trace" && event.trace) {
        const trace = event.trace
        setStatus("running")
        setInvocation((current) => {
          const base = current ?? {
            id: event.requestId,
            versionId: "",
            status: "running",
            trigger: "manual",
            input: "{}",
            output: "{}",
            traces: [],
            createdAt: Date.now(),
          }
          return {
            ...base,
            status: trace.status === "error" ? "error" : "running",
            traces: [...base.traces.filter((existingTrace) => existingTrace.traceId !== trace.traceId), trace],
          }
        })
      }
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

    const bridgeListener = WorkflowApi.onRunEvent(handleEvent)
    return () => WorkflowApi.offRunEvent(bridgeListener)
  }, [requestId])

  const start = useCallback(async (input: Parameters<WorkflowRuntimeViewModel["start"]>[0]) => {
    const nextRequestId = crypto.randomUUID()
    setRequestId(nextRequestId)
    setStatus("queued")
    setError(null)
    setInvocation({
      id: nextRequestId,
      versionId: input.versionId,
      status: "running",
      trigger: input.mode,
      input: JSON.stringify(input.input),
      output: "{}",
      traces: [],
      createdAt: Date.now(),
    })
    await WorkflowApi.run({ ...input, requestId: nextRequestId })
  }, [])

  const cancel = useCallback(async () => {
    if (!requestId) return
    await WorkflowApi.cancelRun(requestId)
  }, [requestId])

  return { requestId, status, error, invocation, start, cancel }
}
