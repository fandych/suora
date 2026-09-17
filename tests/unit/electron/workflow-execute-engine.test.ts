import { describe, expect, it, vi } from "vitest"

import { createWorkflowExecutionContext } from "@/electron/app/workflows/context"
import { executeConditionNode } from "@/electron/app/workflows/execution/node-condition"
import { executeWorkflowCommand } from "@/electron/app/workflows/execute-engine"
import type { IntegrationConfig } from "@/types/integration"
import type { WorkflowExecutionRuntime, WorkflowNode } from "@/types/workflow-runtime"

function createRuntime(overrides?: Partial<WorkflowExecutionRuntime>): WorkflowExecutionRuntime {
  return {
    getChatRuntimeSettings: async () => ({ providerId: "", modelId: "", systemPrompt: "", temperature: 0.7, maxTokens: 1024 }),
    executeAgent: async () => ({ ok: true }),
    getDocumentDetail: async () => ({ id: "doc-1" }),
    executeIntegration: async () => ({ ok: true, status: 200, body: '{"ok":true}' }),
    sendMail: async () => ({ success: true }),
    ...overrides,
  }
}

describe("workflow execute engine", () => {
  it("executes script nodes through the integration runtime", async () => {
    const executeIntegration = vi.fn(async (config: IntegrationConfig, inputJson: string) => ({
      ok: true,
      status: 200,
      body: JSON.stringify({ config, inputJson }),
    }))
    const runtime = createRuntime({ executeIntegration })

    const result = await executeWorkflowCommand(
      {
        requestId: "request-1",
        workflowId: "workflow-1",
        versionId: "version-1",
        mode: "manual",
        input: { approved: true, items: [1, 2] },
        runtime,
        definition: {
          nodes: [
            {
              id: "start",
              data: { label: "Start", prompt: "", kind: "start", outputKey: "request", enabled: true },
            },
            {
              id: "script-1",
              data: {
                label: "Script 1",
                prompt: "",
                kind: "script",
                runtime: "node",
                timeoutSeconds: 30,
                script: "export async function main(input) { return { ok: true, input } }",
                enabled: true,
              },
            },
            {
              id: "end",
              data: { label: "End", prompt: "", kind: "end", enabled: true },
            },
          ] satisfies WorkflowNode[],
          edges: [
            { source: "start", target: "script-1" },
            { source: "script-1", target: "end" },
          ],
          budget: { maxSteps: 5, maxDurationMs: 1000 },
        },
      },
      () => undefined,
      new AbortController().signal,
    )

    expect(executeIntegration).toHaveBeenCalledTimes(1)
    expect(executeIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "scripts",
        runtime: "node",
        selectedScriptId: "script-1-script",
      }),
      JSON.stringify({ approved: true, items: [1, 2] }),
      undefined,
    )
    expect(result.traces.map((trace) => trace.nodeId)).toEqual(["start", "script-1", "end"])
  })

  it("evaluates condition expressions with workflow expression semantics", async () => {
    const context = createWorkflowExecutionContext({ approved: false, code: "0" })
    const result = await executeConditionNode(
      {
        id: "condition-1",
        data: { label: "Condition", prompt: "", kind: "condition", runIf: "$input.approved === true" },
      },
      context,
      "manual",
    )

    expect(result).toBe(false)
  })
})