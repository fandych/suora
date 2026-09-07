import { describe, expect, it } from "vitest"

import type { WorkflowDefinition } from "@/data/domain/models"
import {
  evaluateExpression,
  executeWorkflowDefinition,
  interpolate,
  readPath,
  toWorkflowHttpResult,
  type ExecutionContext,
} from "@/data/repositories/workflow-execution-engine"

describe("Workflow Execution Engine", () => {
  describe("Interpolation and Path Reading", () => {
    const context: ExecutionContext = {
      input: { query: "hello", user: { name: "Alice", id: 123 }, tags: ["ai", "workflow"] },
      vars: { currentRole: "admin", maxLimit: 10 },
      steps: { start_1: { status: "ok" }, node_agent: { text: "Generated result" } },
      current: { status: "draft" },
    }
    context.$input = context.input
    context.$vars = context.vars
    context.$steps = context.steps
    context.$current = context.current

    it("reads paths correctly using readPath", () => {
      expect(readPath(context, "input.query")).toBe("hello")
      expect(readPath(context, "{{ $input.user.name }}")).toBe("Alice")
      expect(readPath(context, "${vars.currentRole}")).toBe("admin")
      expect(readPath(context, "currentRole")).toBe("admin")
      expect(readPath(context, "input.tags[1]")).toBe("workflow")
      expect(readPath(context, "steps.node_agent.text")).toBe("Generated result")
      expect(readPath(context, "current.status")).toBe("draft")
      expect(readPath(context, "$current.status")).toBe("draft")
    })

    it("interpolates templates with {{}}, ${}, and $var syntax", () => {
      expect(interpolate("Query is {{ input.query }} and user is ${user.name}", context)).toBe("Query is hello and user is Alice")
      expect(interpolate("Role: ${vars.currentRole}, Limit: {{maxLimit}}", context)).toBe("Role: admin, Limit: 10")
    })

    it("interpolates templates with pipe filters (| upper, | lower, | default)", () => {
      const pipeContext: ExecutionContext = {
        input: { title: "hello suora", tag: "" },
        vars: { emptyVal: null },
        steps: {},
      }
      expect(interpolate("{{ input.title | upper }}", pipeContext)).toBe("HELLO SUORA")
      expect(interpolate("{{ input.title | upper | trim }}", pipeContext)).toBe("HELLO SUORA")
      expect(interpolate("{{ input.tag | default('Fallback Tag') }}", pipeContext)).toBe("Fallback Tag")
      expect(interpolate("{{ vars.emptyVal | default('Default Value') }}", pipeContext)).toBe("Default Value")
    })

    it("evaluates condition expressions", () => {
      expect(evaluateExpression("${user.name} === Alice", context)).toBe(true)
      expect(evaluateExpression("{{maxLimit}} > 5", context)).toBe(true)
      expect(evaluateExpression("input.query contains ell", context)).toBe(true)
      expect(evaluateExpression("${currentRole} !== guest", context)).toBe(true)
    })
  })

  describe("Workflow Execution", () => {
    it("exposes structured HTTP request and response metadata to workflow nodes", () => {
      expect(toWorkflowHttpResult({
        ok: true,
        status: 200,
        body: '{"ticket":"T-1"}',
        request: { url: "https://api.example.test/tickets", method: "GET", headers: { authorization: "[REDACTED]" }, body: null },
        response: { status: 200, headers: { "content-type": "application/json" }, body: '{"ticket":"T-1"}', json: { ticket: "T-1" } },
      })).toEqual({
        request: { url: "https://api.example.test/tickets", method: "GET", headers: { authorization: "[REDACTED]" }, body: null },
        response: { status: 200, headers: { "content-type": "application/json" }, body: '{"ticket":"T-1"}', json: { ticket: "T-1" } },
      })
      expect(toWorkflowHttpResult({ ok: true, status: 200, body: "legacy" })).toBe("legacy")
    })

    it("executes start, variable-assigner, template, and end nodes in sequence", async () => {
      const definition: WorkflowDefinition = {
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
          { id: "start", position: { x: 0, y: 0 }, data: { kind: "start", label: "Start", prompt: "" } },
          { id: "assign", position: { x: 100, y: 0 }, data: { kind: "variable-assigner", label: "Set User", prompt: "", variableName: "userName", variableValue: "${input.name}" } },
          { id: "tpl", position: { x: 200, y: 0 }, data: { kind: "template", label: "Format Greeting", prompt: "", template: "Welcome {{userName}}!", outputKey: "greeting" } },
          { id: "end", position: { x: 300, y: 0 }, data: { kind: "end", label: "End", prompt: "", inputTemplate: "Result: ${greeting}" } },
        ],
        edges: [
          { id: "e1", source: "start", target: "assign" },
          { id: "e2", source: "assign", target: "tpl" },
          { id: "e3", source: "tpl", target: "end" },
        ],
      }

      const result = await executeWorkflowDefinition(definition, { name: "Bob" }, "manual")
      expect(result.traces).toHaveLength(4)
      expect(result.traces.every((t) => t.status === "success")).toBe(true)
      expect(result.output.userName).toBe("Bob")
      expect(result.output.greeting).toBe("Welcome Bob!")
    })

    it("maps every node's current raw result into its stable step output", async () => {
      const definition: WorkflowDefinition = {
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
          { id: "start", position: { x: 0, y: 0 }, data: { kind: "start", label: "Start", prompt: "" } },
          { id: "getTickets", position: { x: 100, y: 0 }, data: { kind: "template", label: "Get tickets", prompt: "", template: '{"tickets":["A-1"],"session":"s-1"}', templateOutputFormat: "json", outputKey: "ticketResult", outputSchemaJson: JSON.stringify({ type: "object", properties: { tickets: { type: "array", default: "${current.tickets}" }, session: { type: "string", default: "${current.session}" } } }) } },
          { id: "end", position: { x: 200, y: 0 }, data: { kind: "end", label: "End", prompt: "", inputTemplate: "${steps.getTickets.tickets[0]} / ${ticketResult.session}" } },
        ],
        edges: [
          { id: "start-getTickets", source: "start", target: "getTickets" },
          { id: "getTickets-end", source: "getTickets", target: "end" },
        ],
      }

      const result = await executeWorkflowDefinition(definition, {}, "manual")
      const steps = result.output.steps as Record<string, Record<string, unknown>>
      expect(steps.getTickets).toMatchObject({ tickets: ["A-1"], session: "s-1" })
      expect(result.output.ticketResult).toMatchObject({ tickets: ["A-1"], session: "s-1" })
      expect(result.output.current).toBe("A-1 / s-1")
    })

    it("supports running multiple workflows concurrently in parallel", async () => {
      const definition: WorkflowDefinition = {
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
          { id: "start", position: { x: 0, y: 0 }, data: { kind: "start", label: "Start", prompt: "" } },
          { id: "assign", position: { x: 100, y: 0 }, data: { kind: "variable-assigner", label: "Assign", prompt: "", variableName: "tag", variableValue: "${input.tag}" } },
          { id: "end", position: { x: 200, y: 0 }, data: { kind: "end", label: "End", prompt: "", inputTemplate: "Tag: ${tag}" } },
        ],
        edges: [
          { id: "e1", source: "start", target: "assign" },
          { id: "e2", source: "assign", target: "end" },
        ],
      }

      const [run1, run2] = await Promise.all([
        executeWorkflowDefinition(definition, { tag: "alpha" }, "manual"),
        executeWorkflowDefinition(definition, { tag: "beta" }, "manual"),
      ])

      expect(run1.output.tag).toBe("alpha")
      expect(run2.output.tag).toBe("beta")
    })

    it("executes if-else branching correctly and skips unchosen branch", async () => {
      const definition: WorkflowDefinition = {
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
          { id: "start", position: { x: 0, y: 0 }, data: { kind: "start", label: "Start", prompt: "" } },
          {
            id: "ifelse",
            position: { x: 100, y: 0 },
            data: {
              kind: "if-else",
              label: "Check Admin",
              prompt: "",
              branches: [
                { id: "b-admin", label: "Admin Branch", expression: "${input.role} === admin" },
                { id: "b-user", label: "User Branch", expression: "true" },
              ],
            },
          },
          { id: "admin-node", position: { x: 200, y: -50 }, data: { kind: "variable-assigner", label: "Admin Action", prompt: "", variableName: "message", variableValue: "Admin Access Granted" } },
          { id: "user-node", position: { x: 200, y: 50 }, data: { kind: "variable-assigner", label: "User Action", prompt: "", variableName: "message", variableValue: "Standard User Access" } },
          { id: "end", position: { x: 300, y: 0 }, data: { kind: "end", label: "End", prompt: "", inputTemplate: "${message}" } },
        ],
        edges: [
          { id: "e1", source: "start", target: "ifelse" },
          { id: "e2", source: "ifelse", sourceHandle: "b-admin", target: "admin-node" },
          { id: "e3", source: "ifelse", sourceHandle: "b-user", target: "user-node" },
          { id: "e4", source: "admin-node", target: "end" },
          { id: "e5", source: "user-node", target: "end" },
        ],
      }

      const resultAdmin = await executeWorkflowDefinition(definition, { role: "admin" }, "manual")
      expect(resultAdmin.output.message).toBe("Admin Access Granted")

      const resultUser = await executeWorkflowDefinition(definition, { role: "member" }, "manual")
      expect(resultUser.output.message).toBe("Standard User Access")
    })

    it("executes loop node over collection", async () => {
      const definition: WorkflowDefinition = {
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
          { id: "start", position: { x: 0, y: 0 }, data: { kind: "start", label: "Start", prompt: "" } },
          { id: "loop", position: { x: 100, y: 0 }, data: { kind: "loop", label: "Process Items", prompt: "", loopExpression: "$input.items", itemAlias: "item" } },
          { id: "end", position: { x: 200, y: 0 }, data: { kind: "end", label: "End", prompt: "" } },
        ],
        edges: [
          { id: "e1", source: "start", target: "loop" },
          { id: "e2", source: "loop", target: "end" },
        ],
      }

      const result = await executeWorkflowDefinition(definition, { items: ["apple", "banana", "cherry"] }, "manual")
      const loopStep = result.output.steps ? (result.output.steps as Record<string, { iterations: number; items: string[] }>).loop : undefined
      expect(loopStep?.iterations).toBe(3)
      expect(loopStep?.items).toEqual(["apple", "banana", "cherry"])
    })

    it("executes complex 6-node workflow with 5 node kinds (Order Pipeline)", async () => {
      const definition: WorkflowDefinition = {
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
          { id: "s1", position: { x: 0, y: 0 }, data: { kind: "start", label: "Start", prompt: "" } },
          { id: "a1", position: { x: 100, y: 0 }, data: { kind: "variable-assigner", label: "Set ID", prompt: "", variableName: "orderId", variableValue: "${input.id}" } },
          { id: "t1", position: { x: 200, y: 0 }, data: { kind: "template", label: "Format Msg", prompt: "", template: "Order {{orderId}} Received", outputKey: "msg" } },
          { id: "sc1", position: { x: 300, y: 0 }, data: { kind: "script", label: "Calc Tax", prompt: "", script: "return { tax: 15 }", outputKey: "taxRes" } },
          { id: "a2", position: { x: 400, y: 0 }, data: { kind: "variable-assigner", label: "Set Status", prompt: "", variableName: "status", variableValue: "APPROVED" } },
          { id: "e1", position: { x: 500, y: 0 }, data: { kind: "end", label: "End", prompt: "", inputTemplate: "${orderId}: ${status}" } }
        ],
        edges: [
          { id: "e1", source: "s1", target: "a1" },
          { id: "e2", source: "a1", target: "t1" },
          { id: "e3", source: "t1", target: "sc1" },
          { id: "e4", source: "sc1", target: "a2" },
          { id: "e5", source: "a2", target: "e1" }
        ]
      }

      const result = await executeWorkflowDefinition(definition, { id: "ORD-99" }, "dry-run")
      expect(result.traces).toHaveLength(6)
      expect(result.traces.find(t => t.nodeId === "s1")?.status).toBe("success")
      expect(result.traces.find(t => t.nodeId === "a1")?.status).toBe("success")
      expect(result.traces.find(t => t.nodeId === "sc1")?.status).toBe("skipped")
      expect(result.output.orderId).toBe("ORD-99")
      expect(result.output.status).toBe("APPROVED")
    })

    it("executes complex 7-node parallel fork/join workflow with 5 node kinds", async () => {
      const definition: WorkflowDefinition = {
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
          { id: "s1", position: { x: 0, y: 0 }, data: { kind: "start", label: "Start", prompt: "" } },
          { id: "f1", position: { x: 100, y: 0 }, data: { kind: "fork", label: "Fork", prompt: "", branchCount: 2 } },
          { id: "b1", position: { x: 200, y: -50 }, data: { kind: "script", label: "Script Thread", prompt: "", script: "return { score: 100 }", outputKey: "sc" } },
          { id: "b2", position: { x: 200, y: 50 }, data: { kind: "variable-assigner", label: "Assign Thread", prompt: "", variableName: "env", variableValue: "PROD" } },
          { id: "j1", position: { x: 300, y: 0 }, data: { kind: "join", label: "Join", prompt: "", joinStrategy: "wait-all" } },
          { id: "t1", position: { x: 400, y: 0 }, data: { kind: "template", label: "Summary", prompt: "", template: "Env: {{env}}", outputKey: "summary" } },
          { id: "e1", position: { x: 500, y: 0 }, data: { kind: "end", label: "End", prompt: "" } }
        ],
        edges: [
          { id: "e1", source: "s1", target: "f1" },
          { id: "e2", source: "f1", target: "b1" },
          { id: "e3", source: "f1", target: "b2" },
          { id: "e4", source: "b1", target: "j1" },
          { id: "e5", source: "b2", target: "j1" },
          { id: "e6", source: "j1", target: "t1" },
          { id: "e7", source: "t1", target: "e1" }
        ]
      }

      const result = await executeWorkflowDefinition(definition, {}, "dry-run")
      expect(result.traces).toHaveLength(7)
      expect(result.traces.find(t => t.nodeId === "f1")?.status).toBe("success")
      expect(result.traces.find(t => t.nodeId === "b2")?.status).toBe("success")
      expect(result.traces.find(t => t.nodeId === "b1")?.status).toBe("skipped")
      expect(result.output.env).toBe("PROD")
      expect(result.output.summary).toBe("Env: PROD")
    })
  })
})
