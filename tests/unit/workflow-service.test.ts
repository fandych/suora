import { describe, expect, it, vi } from "vitest"

const workflowsGet = vi.fn(async () => ({
  workflow: {
    id: "workflow-lead-intake",
    title: "Lead Intake Flow",
    summary: "Route new leads, classify intent, and create assignments.",
    enabled: true,
    updatedAt: 0,
  },
  versions: [
    {
      id: "version-1",
      major: 1,
      minor: 0,
      isRelease: true,
      createdAt: 0,
      definitionJson: JSON.stringify({
        nodes: [
          { id: "start", type: "workflowNode", position: { x: 0, y: 0 }, data: { kind: "start", label: "Start", prompt: "" } },
          { id: "lead-agent", type: "workflowNode", position: { x: 0, y: 120 }, data: { kind: "agent", label: "Agent Step", prompt: "Classify lead" } },
          { id: "output", type: "workflowNode", position: { x: 0, y: 240 }, data: { kind: "output", label: "Output", prompt: "Return lead routing", inputTemplate: "{{current}}" } },
        ],
        edges: [
          { source: "start", target: "lead-agent" },
          { source: "lead-agent", target: "output" },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
      }),
    },
  ],
  invocations: [],
}))

vi.mock("@/services/bridge", () => ({
  requireAppBridge: () => ({
    workflows: {
      get: workflowsGet,
    },
  }),
}))

import { WorkflowApi } from "@/services/workflow-service"

describe("workflow service normalization", () => {
  it("normalizes legacy output nodes into end nodes when loading workflow detail", async () => {
    const detail = await WorkflowApi.get("workflow-lead-intake")

    expect(workflowsGet).toHaveBeenCalledWith("workflow-lead-intake", undefined)
    expect(detail?.definition.nodes.map((node) => node.data.kind)).toEqual(["start", "agent", "end"])
    expect(detail?.definition.nodes.at(-1)?.data.label).toBe("Output")
  })
})