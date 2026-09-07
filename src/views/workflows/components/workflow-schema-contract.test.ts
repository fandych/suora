import { describe, expect, it } from "vitest"

import { readWorkflowSchemaParameters, writeWorkflowSchemaParameters } from "@/views/workflows/components/workflow-schema-contract"

describe("workflow schema contract", () => {
  it("preserves nested contracts and schema metadata while editing a root field", () => {
    const source = JSON.stringify({
      type: "object",
      additionalProperties: false,
      properties: {
        tickets: { type: "array", description: "Old", items: { type: "object", properties: { id: { type: "string", format: "uuid" } } } },
      },
      required: ["tickets"],
    })
    const parameters = readWorkflowSchemaParameters(source)
    parameters[0].description = "New"

    const result = JSON.parse(writeWorkflowSchemaParameters(source, parameters))
    expect(result.additionalProperties).toBe(false)
    expect(result.properties.tickets.description).toBe("New")
    expect(result.properties.tickets.items.properties.id.format).toBe("uuid")
    expect(result.required).toEqual(["tickets"])
  })
})
