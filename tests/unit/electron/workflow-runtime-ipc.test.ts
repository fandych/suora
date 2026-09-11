import { describe, expect, it } from "vitest"
import { z } from "zod"

describe("workflow runtime command contract", () => {
  const commandSchema = z.object({ requestId: z.string().min(1).max(128), workflowId: z.string().min(1), versionId: z.string().min(1), definition: z.unknown(), input: z.unknown(), mode: z.enum(["dry-run", "manual"]) })

  it("accepts a valid start command", () => {
    expect(commandSchema.parse({ requestId: "request-1", workflowId: "workflow-1", versionId: "version-1", definition: { nodes: [], edges: [] }, input: {}, mode: "manual" })).toMatchObject({ requestId: "request-1", mode: "manual" })
  })

  it("rejects malformed or unsupported commands", () => {
    expect(() => commandSchema.parse({ requestId: "", workflowId: "workflow-1", versionId: "version-1", definition: {}, input: {}, mode: "manual" })).toThrow()
    expect(() => commandSchema.parse({ requestId: "request-1", workflowId: "workflow-1", versionId: "version-1", definition: {}, input: {}, mode: "background" })).toThrow()
  })
})
