import { describe, expect, it } from "vitest"

import { parseIpcInput, schedulerSaveSchema, versionedResourceSaveSchema, workflowInvocationSchema, workflowSaveSchema } from "@electron/ipc/system/ipc-input-schemas"

describe("resource IPC schemas", () => {
  it("accepts scheduler values within bounds", () => {
    expect(parseIpcInput(schedulerSaveSchema, { id: "scheduler-1", title: "Daily", description: "", enabled: true, schedule: "0 9 * * *", timeZone: "Asia/Shanghai", targetType: "workflow", targetId: "workflow-1", targetName: "Workflow", missedRunPolicy: "skip", retryLimit: 2, retryBackoffSeconds: 300, inputPayloadJson: "{}" })).toMatchObject({ retryLimit: 2 })
    expect(() => parseIpcInput(schedulerSaveSchema, { id: "scheduler-1", title: "Daily", description: "", enabled: true, schedule: "", timeZone: "Asia/Shanghai", targetType: "workflow", targetId: "workflow-1", targetName: "Workflow", missedRunPolicy: "skip", retryLimit: 2, retryBackoffSeconds: 300, inputPayloadJson: "{}" })).toThrow(/Invalid IPC payload/)
  })

  it("bounds workflow invocation records", () => {
    expect(parseIpcInput(workflowInvocationSchema, { workflowId: "workflow-1", versionId: "version-1", status: "success", trigger: "manual", input: "{}", output: "{}", traceJson: "[]" })).toMatchObject({ workflowId: "workflow-1" })
    expect(() => parseIpcInput(workflowSaveSchema, { id: "workflow-1", title: "Workflow", summary: "", definitionJson: "x".repeat(16 * 1024 * 1024 + 1) })).toThrow(/Invalid IPC payload/)
  })

  it("bounds versioned agent and skill payloads", () => {
    expect(parseIpcInput(versionedResourceSaveSchema, { id: "agent-1", title: "Agent", summary: "", kind: "custom", configJson: "{}" })).toMatchObject({ id: "agent-1" })
    expect(() => parseIpcInput(versionedResourceSaveSchema, { id: "skill-1", title: "Skill", summary: "", filesJson: "x".repeat(16 * 1024 * 1024 + 1) })).toThrow(/Invalid IPC payload/)
  })
})
