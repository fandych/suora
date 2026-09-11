import { describe, expect, it } from "vitest"
import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/data/domain/workflow-models"
import { createWorkflowExecutionContext } from "@/data/repositories/workflow-execution-context"
import { executeWorkflowNode } from "@/data/repositories/workflow-node-executor"
import type { WorkflowRuntimePorts } from "@/services/workflows/workflow-runtime-ports"

const ports: WorkflowRuntimePorts = {
  getChatRuntimeSettings: async () => ({ providerId: "provider", modelId: "model", temperature: 0.7, maxSteps: 10 }),
  streamChatAgentResponse: async function* () { yield { type: "text-delta", text: "hello" } },
  getDocumentDetail: async () => ({ document: { id: "doc", title: "Doc", summary: "", updatedAt: 1 }, pages: [{ id: "page", documentId: "doc", title: "Guide", slug: "guide", content: "workflow guide", sortOrder: 0, parentId: null, level: 0, path: "guide", createdAt: 1, updatedAt: 1 }], versions: [], selectedVersion: { id: "version", label: "v1", isRelease: true, major: 1, minor: 0, createdAt: 1, definitionJson: "{}" }, latestVersion: { id: "version", label: "v1", isRelease: true, major: 1, minor: 0, createdAt: 1, definitionJson: "{}" } }),
  getIntegrationDetail: async () => { throw new Error("not needed") },
  executeIntegration: async () => ({ ok: true }),
  sendMail: async () => ({ success: true }),
  serializeContext: (context) => JSON.stringify(context),
}

function node(data: Partial<WorkflowNodeData>) {
  return { id: "node", data: { kind: "template", label: "Node", prompt: "", ...data } } as Node<WorkflowNodeData>
}

describe("workflow node executor ports", () => {
  it("executes template nodes without concrete infrastructure dependencies", async () => {
    const context = createWorkflowExecutionContext({ name: "Ada" })
    await expect(executeWorkflowNode(node({ template: "Hello {{input.name}}" }), context, "manual", ports)).resolves.toBe("Hello Ada")
  })

  it("uses injected document and mail ports", async () => {
    const context = createWorkflowExecutionContext({ query: "workflow" })
    const result = await executeWorkflowNode(node({ kind: "document-retrieval", documentId: "doc", queryExpression: "$input.query" }), context, "manual", ports)
    expect(result).toEqual([{ title: "Guide", content: "workflow guide" }])
  })

  it("skips effectful nodes during dry-run before using ports", async () => {
    const context = createWorkflowExecutionContext({})
    const result = await executeWorkflowNode(node({ kind: "smtp" }), context, "dry-run", ports)
    expect(result).toMatchObject({ dryRun: true, skipped: true })
  })
})
