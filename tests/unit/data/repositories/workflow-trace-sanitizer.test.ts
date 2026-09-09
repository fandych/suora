import { describe, expect, it } from "vitest"

import { createWorkflowTraceSnapshot } from "@/data/repositories/workflow-trace-sanitizer"

describe("workflow trace sanitizer", () => {
  it("redacts nested secrets and bounds oversized values", () => {
    const snapshot = createWorkflowTraceSnapshot({
      input: { password: "not-visible", profile: { access_token: "token-value" }, large: "x".repeat(20_000) },
      current: { authorization: "Bearer private" },
      vars: { apiKey: "private-key" },
      steps: {},
    })

    const serialized = JSON.stringify(snapshot)
    expect(serialized).not.toContain("not-visible")
    expect(serialized).not.toContain("token-value")
    expect(serialized).not.toContain("private-key")
    expect(snapshot.redactedPaths).toEqual(expect.arrayContaining(["input.password", "input.profile.access_token", "current.authorization", "vars.apiKey"]))
    expect(snapshot.truncated).toBe(true)
  })
})
