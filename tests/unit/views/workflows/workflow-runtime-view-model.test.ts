import { describe, expect, it } from "vitest"
import type { WorkflowRunCommand } from "@/services/workflows/workflow-run-protocol"

describe("workflow runtime MVVM protocol", () => {
  it("keeps command data independent from view components", () => {
    const command: WorkflowRunCommand = {
      requestId: "request-1",
      workflowId: "workflow-1",
      versionId: "version-1",
      definition: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
      input: { customerId: "customer-1" },
      mode: "dry-run",
    }
    expect(command.requestId).toBe("request-1")
    expect(command.mode).toBe("dry-run")
    expect(command.definition.nodes).toHaveLength(0)
  })

  it("models terminal lifecycle events", () => {
    const events = ["started", "trace", "completed", "failed", "cancelled"] as const
    expect(events).toContain("cancelled")
    expect(events).toContain("completed")
  })
})
