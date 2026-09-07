import { describe, expect, it } from "vitest"

import { getExpressionIssues, getWorkflowExpressionSuggestions } from "@/views/workflows/components/workflow-expression-suggestions"

describe("workflow expression suggestions", () => {
  it("offers current fields and only transitive upstream step fields", () => {
    const nodes = [
      { id: "start", position: { x: 0, y: 0 }, data: { kind: "start" as const, label: "Start", prompt: "", inputSchemaJson: JSON.stringify({ properties: { request: { type: "object", properties: { id: { type: "string" } } } } }) } },
      { id: "getTickets", position: { x: 1, y: 0 }, data: { kind: "http" as const, label: "Get tickets", prompt: "", outputKey: "ticketsResult", outputSchemaJson: JSON.stringify({ properties: { tickets: { type: "array", items: { type: "object", properties: { id: { type: "string" } } } }, session: { type: "string" } } }) } },
      { id: "format", position: { x: 2, y: 0 }, data: { kind: "template" as const, label: "Format", prompt: "", outputSchemaJson: JSON.stringify({ properties: { title: { type: "string" } } }) } },
      { id: "unconnected", position: { x: 3, y: 0 }, data: { kind: "template" as const, label: "Unconnected", prompt: "" } },
    ]
    const edges = [
      { id: "start-getTickets", source: "start", target: "getTickets" },
      { id: "getTickets-format", source: "getTickets", target: "format" },
    ]

    const expressions = getWorkflowExpressionSuggestions(nodes, edges, "format", { includeCurrent: true }).map((suggestion) => suggestion.expression)

    expect(expressions).toContain("${current.title}")
    expect(expressions).toContain("${input.request.id}")
    expect(expressions).toContain("${steps.getTickets}")
    expect(expressions).toContain("${steps.getTickets.tickets}")
    expect(expressions).toContain("${steps.getTickets.tickets[0].id}")
    expect(expressions).toContain("${vars.ticketsResult}")
    expect(expressions).not.toContain("${steps.unconnected}")
  })

  it("diagnoses invalid step references without rejecting schema-less results", () => {
    const nodes = [
      { id: "start", position: { x: 0, y: 0 }, data: { kind: "start" as const, label: "Start", prompt: "", inputSchemaJson: JSON.stringify({ properties: { requestId: { type: "string" } } }) } },
      { id: "fetch", position: { x: 1, y: 0 }, data: { kind: "http" as const, label: "Fetch", prompt: "", outputSchemaJson: JSON.stringify({ properties: { ticket: { type: "string" } } }) } },
      { id: "target", position: { x: 2, y: 0 }, data: { kind: "template" as const, label: "Target", prompt: "" } },
      { id: "downstream", position: { x: 3, y: 0 }, data: { kind: "template" as const, label: "Downstream", prompt: "" } },
    ]
    const edges = [{ id: "fetch-target", source: "fetch", target: "target" }, { id: "target-downstream", source: "target", target: "downstream" }]

    expect(getExpressionIssues(nodes, edges, "target", "${steps.missing.id}", "Prompt")).toContain('Prompt: expression references unknown step "missing".')
    expect(getExpressionIssues(nodes, edges, "target", "${steps.downstream.id}", "Prompt")).toContain('Prompt: step "downstream" is not upstream of this node.')
    expect(getExpressionIssues(nodes, edges, "target", "${steps.fetch.missing}", "Prompt")).toContain('Prompt: "missing" is not declared by step "fetch".')
    expect(getExpressionIssues(nodes, edges, "target", "${input.request", "Prompt")).toContain('Prompt: unclosed "${" expression.')
    expect(getExpressionIssues(nodes, edges, "target", "{{steps.downstream.id}}", "Prompt")).toContain('Prompt: step "downstream" is not upstream of this node.')
    expect(getExpressionIssues(nodes, edges, "target", "$steps.fetch.missing", "Prompt")).toContain('Prompt: "missing" is not declared by step "fetch".')
    expect(getExpressionIssues(nodes, edges, "target", "{{input.request", "Prompt")).toContain('Prompt: unclosed "{{" expression.')
  })
})
