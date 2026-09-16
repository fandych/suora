import { describe, expect, it, vi } from "vitest"

vi.mock("@/electron/app/workflows/repository", () => ({
  assertWorkflowVersion: vi.fn(async (workflowId: string, versionId: string) => {
    if (workflowId !== "workflow-1" || versionId !== "version-1") throw new Error("Workflow or version not found")
  }),
}))

import { assertWorkflowVersion } from "@/electron/preload/workflows/workflow-ipc-policy"

describe("workflow IPC policy", () => {
  it("requires an existing workflow version", async () => {
    await expect(assertWorkflowVersion("missing", "version-1")).rejects.toThrow("Workflow or version not found")
    await expect(assertWorkflowVersion("workflow-1", "version-2")).rejects.toThrow("Workflow or version not found")
    await expect(assertWorkflowVersion("workflow-1", "version-1")).resolves.toBeUndefined()
  })
})
