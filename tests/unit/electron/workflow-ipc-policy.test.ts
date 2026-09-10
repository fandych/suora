import { describe, expect, it, vi } from "vitest"

import { assertWorkflowVersion } from "@electron/ipc/domain/workflow-ipc-policy"

describe("workflow IPC policy", () => {
  it("requires a version belonging to the workflow", () => {
    const database = {
      prepare: vi.fn(() => ({ get: vi.fn((workflowId: string, versionId: string) => workflowId === "workflow-1" && versionId === "version-1" ? { id: workflowId } : undefined) })),
    } as never

    expect(() => assertWorkflowVersion(database, "missing", "version-1")).toThrow("Workflow or version not found")
    expect(() => assertWorkflowVersion(database, "workflow-1", "version-2")).toThrow("Workflow or version not found")
    expect(assertWorkflowVersion(database, "workflow-1", "version-1")).toBeUndefined()
  })
})