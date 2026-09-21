import { describe, expect, it, vi } from "vitest"
import { z } from "zod"

vi.mock("@/electron/app/agents/service", () => ({
  agentService: {
    list: vi.fn(async () => []),
  },
}))

vi.mock("@/electron/app/documents/service", () => ({
  documentService: {
    list: vi.fn(async () => []),
  },
}))

vi.mock("@/electron/app/integrations/service", () => ({
  integrationApplicationService: {
    list: vi.fn(async () => []),
  },
}))

vi.mock("@/electron/app/models/service", () => ({
  modelService: {
    list: vi.fn(async () => []),
  },
}))

import { validateWorkflowDefinitionJson } from "@/electron/app/workflows/definition"
import { executeWorkflowRun } from "@/electron/app/workflows/runtime"

describe("workflow runtime command contract", () => {
  const commandSchema = z.object({
    requestId: z.string().min(1).max(128),
    workflowId: z.string().min(1),
    versionId: z.string().min(1),
    definition: z.unknown(),
    input: z.unknown(),
    mode: z.enum(["dry-run", "manual"]),
  })

  it("accepts a valid start command", () => {
    expect(
      commandSchema.parse({
        requestId: "request-1",
        workflowId: "workflow-1",
        versionId: "version-1",
        definition: { nodes: [], edges: [] },
        input: {},
        mode: "manual",
      }),
    ).toMatchObject({ requestId: "request-1", mode: "manual" })
  })

  it("rejects malformed or unsupported commands", () => {
    expect(() =>
      commandSchema.parse({
        requestId: "",
        workflowId: "workflow-1",
        versionId: "version-1",
        definition: {},
        input: {},
        mode: "manual",
      }),
    ).toThrow()
    expect(() =>
      commandSchema.parse({
        requestId: "request-1",
        workflowId: "workflow-1",
        versionId: "version-1",
        definition: {},
        input: {},
        mode: "background",
      }),
    ).toThrow()
  })

  it("accepts control-flow nodes in workflow definitions", () => {
    expect(() =>
      validateWorkflowDefinitionJson(
        JSON.stringify({
          nodes: [
            { id: "start", data: { kind: "start", label: "Start", prompt: "", enabled: true } },
            { id: "fork", data: { kind: "fork", label: "Fork", prompt: "", branchCount: 2, enabled: true } },
            {
              id: "parallel",
              data: {
                kind: "parallel",
                label: "Parallel",
                prompt: "",
                concurrency: 2,
                mergeStrategy: "all-settled",
                enabled: true,
              },
            },
            { id: "loop", data: { kind: "loop", label: "Loop", prompt: "", maxIterations: 2, enabled: true } },
            { id: "join", data: { kind: "join", label: "Join", prompt: "", joinStrategy: "wait-all", enabled: true } },
            { id: "end", data: { kind: "end", label: "End", prompt: "", inputTemplate: "{{current}}", enabled: true } },
          ],
          edges: [
            { source: "start", target: "fork" },
            { source: "fork", target: "parallel" },
            { source: "parallel", target: "loop" },
            { source: "loop", target: "join" },
            { source: "join", target: "end" },
          ],
          budget: { maxSteps: 16, maxDurationMs: 5000 },
        }),
      ),
    ).not.toThrow()
  })

  it("prepares a workflow run start command with control-flow nodes", async () => {
    const command = await executeWorkflowRun({
      requestId: "request-1",
      workflowId: "workflow-1",
      versionId: "version-1",
      definition: {
        nodes: [
          { id: "start", data: { kind: "start", label: "Start", prompt: "", enabled: true } },
          { id: "fork", data: { kind: "fork", label: "Fork", prompt: "", branchCount: 2, enabled: true } },
          {
            id: "parallel",
            data: {
              kind: "parallel",
              label: "Parallel",
              prompt: "",
              concurrency: 2,
              mergeStrategy: "all-settled",
              enabled: true,
            },
          },
          { id: "loop", data: { kind: "loop", label: "Loop", prompt: "", maxIterations: 2, enabled: true } },
          { id: "join", data: { kind: "join", label: "Join", prompt: "", joinStrategy: "wait-all", enabled: true } },
          { id: "end", data: { kind: "end", label: "End", prompt: "", inputTemplate: "{{current}}", enabled: true } },
        ],
        edges: [
          { source: "start", target: "fork" },
          { source: "fork", target: "parallel" },
          { source: "parallel", target: "loop" },
          { source: "loop", target: "join" },
          { source: "join", target: "end" },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
        budget: { maxSteps: 16, maxDurationMs: 5000 },
      },
      input: [1, 2, 3],
      mode: "manual",
    })

    expect(command.requestId).toBe("request-1")
    expect(command.definition.nodes.map((node) => node.data.kind)).toEqual([
      "start",
      "fork",
      "parallel",
      "loop",
      "join",
      "end",
    ])
  })
})
