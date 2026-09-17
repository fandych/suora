import { describe, expect, it } from "vitest"

import { executeWorkflowCommand } from "@/electron/app/workflows/execute-engine"
import type { WorkflowExecutionRuntime, WorkflowNode } from "@/types/workflow-runtime"

function createRuntime(overrides?: Partial<WorkflowExecutionRuntime>): WorkflowExecutionRuntime {
  return {
    getChatRuntimeSettings: async () => ({ providerId: "", modelId: "", systemPrompt: "", temperature: 0.7, maxTokens: 1024 }),
    executeAgent: async () => "agent-result",
    getDocumentDetail: async () => ({ pages: [{ id: "page-1", title: "Python", content: "Python overview" }] }),
    executeIntegration: async () => ({ ok: true, status: 200, body: "ok" }),
    sendMail: async () => ({ success: true }),
    ...overrides,
  }
}

describe("workflow runtime extended nodes", () => {
  it("executes fork, join, parallel, serial, and wiki retrieval nodes", async () => {
    const result = await executeWorkflowCommand(
      {
        requestId: "request-extended",
        workflowId: "workflow-extended",
        versionId: "version-extended",
        mode: "manual",
        input: { items: [1, 2], query: "python" },
        runtime: createRuntime(),
        definition: {
          nodes: [
            { id: "start", data: { label: "Start", prompt: "", kind: "start", outputKey: "request", enabled: true } },
            { id: "fork", data: { label: "Fork", prompt: "", kind: "fork", branchCount: 2, enabled: true } },
            {
              id: "wiki",
              data: {
                label: "Wiki",
                prompt: "python",
                kind: "wiki-retrieval",
                documentId: "doc-1",
                queryExpression: "python",
                resultLimit: 3,
                enabled: true,
              },
            },
            { id: "parallel", data: { label: "Parallel", prompt: "", kind: "parallel", concurrency: 2, mergeStrategy: "all-settled", enabled: true } },
            { id: "serial", data: { label: "Serial", prompt: "", kind: "serial", notes: "ordered stage", enabled: true } },
            { id: "join", data: { label: "Join", prompt: "", kind: "join", joinStrategy: "wait-all", enabled: true } },
            { id: "end", data: { label: "End", prompt: "", kind: "end", inputTemplate: "{{current}}", enabled: true } },
          ] satisfies WorkflowNode[],
          edges: [
            { source: "start", target: "fork" },
            { source: "fork", target: "wiki" },
            { source: "wiki", target: "parallel" },
            { source: "parallel", target: "serial" },
            { source: "serial", target: "join" },
            { source: "join", target: "end" },
          ],
          budget: { maxSteps: 16, maxDurationMs: 5000 },
        },
      },
      () => undefined,
      new AbortController().signal,
    )

    expect(result.traces.map((trace) => trace.nodeId)).toEqual(["start", "fork", "wiki", "parallel", "serial", "join", "end"])
    expect(result.traces.find((trace) => trace.nodeId === "wiki")?.output).toContain("Python overview")
  })

  it("persists partial traces on workflow failure", async () => {
    await expect(
      executeWorkflowCommand(
        {
          requestId: "request-failure",
          workflowId: "workflow-failure",
          versionId: "version-failure",
          mode: "manual",
          input: {},
          runtime: createRuntime({ executeIntegration: async () => ({ ok: false, status: 500, body: "boom" }) }),
          definition: {
            nodes: [
              { id: "start", data: { label: "Start", prompt: "", kind: "start", outputKey: "request", enabled: true } },
              { id: "http", data: { label: "HTTP", prompt: "", kind: "http", url: "https://api.github.com/zen", method: "GET", headersJson: '{}', queryJson: '{}', bodyJson: '{}', enabled: true, continueOnError: false } },
              { id: "end", data: { label: "End", prompt: "", kind: "end", inputTemplate: "{{current}}", enabled: true } },
            ] satisfies WorkflowNode[],
            edges: [
              { source: "start", target: "http" },
              { source: "http", target: "end" },
            ],
            budget: { maxSteps: 8, maxDurationMs: 5000 },
          },
        },
        () => undefined,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      message: "Integration execution failed.",
      traces: expect.arrayContaining([
        expect.objectContaining({ nodeId: "start", status: "success" }),
        expect.objectContaining({ nodeId: "http", status: "error" }),
      ]),
    })
  })
})