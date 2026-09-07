import type { WorkflowInputParameter } from "@/data/domain/models"

export type WorkflowJsonSchema = {
  type?: string
  description?: string
  default?: unknown
  properties?: Record<string, WorkflowJsonSchema>
  items?: WorkflowJsonSchema
  required?: string[]
  [key: string]: unknown
}

export type WorkflowSchemaParameter = WorkflowInputParameter & {
  schema: WorkflowJsonSchema
}

const types = new Set<WorkflowInputParameter["type"]>(["string", "number", "boolean", "object", "array"])

export function parseWorkflowSchema(value?: string) {
  try {
    const schema = JSON.parse(value || "{}") as WorkflowJsonSchema
    return { schema: schema && typeof schema === "object" ? schema : {} as WorkflowJsonSchema, error: null }
  } catch {
    return { schema: {} as WorkflowJsonSchema, error: "Schema must be valid JSON." }
  }
}

export function readWorkflowSchemaParameters(value?: string): WorkflowSchemaParameter[] {
  const { schema } = parseWorkflowSchema(value)
  return Object.entries(schema.properties ?? {}).map(([name, property], index) => ({
    id: `${name}-${index}`,
    name,
    description: property.description ?? "",
    type: types.has(property.type as WorkflowInputParameter["type"]) ? property.type as WorkflowInputParameter["type"] : "string",
    defaultValue: property.default === undefined ? "" : typeof property.default === "string" ? property.default : JSON.stringify(property.default),
    required: schema.required?.includes(name) ?? false,
    schema: property,
  }))
}

function parseDefault(value: string, type: WorkflowInputParameter["type"]) {
  if (!value.trim()) return undefined
  if (type === "number" && !value.includes("${") && !value.includes("{{")) return Number(value)
  if (type === "boolean" && !value.includes("${") && !value.includes("{{")) return value === "true"
  return value
}

export function writeWorkflowSchemaParameters(value: string | undefined, parameters: WorkflowSchemaParameter[]) {
  const { schema } = parseWorkflowSchema(value)
  const properties = Object.fromEntries(parameters.map((parameter) => {
    const defaultValue = parseDefault(parameter.defaultValue, parameter.type)
    const nextSchema: WorkflowJsonSchema = {
      ...parameter.schema,
      type: parameter.type,
      description: parameter.description,
    }
    if (defaultValue === undefined) delete nextSchema.default
    else nextSchema.default = defaultValue
    return [parameter.name, nextSchema]
  }))
  return JSON.stringify({
    ...schema,
    type: schema.type ?? "object",
    properties,
    ...(parameters.some((parameter) => parameter.required) ? { required: parameters.filter((parameter) => parameter.required).map((parameter) => parameter.name) } : { required: undefined }),
  }, null, 2)
}

export function getNestedSchemaFragment(schema: WorkflowJsonSchema) {
  const fragment = { ...schema }
  delete fragment.type
  delete fragment.description
  delete fragment.default
  return Object.keys(fragment).length > 0 ? JSON.stringify(fragment, null, 2) : ""
}

export function mergeNestedSchemaFragment(schema: WorkflowJsonSchema, fragment: string) {
  if (!fragment.trim()) return { schema, error: null }
  try {
    const nested = JSON.parse(fragment) as WorkflowJsonSchema
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) throw new Error()
    return { schema: { ...schema, ...nested }, error: null }
  } catch {
    return { schema, error: "Nested contract must be a JSON object." }
  }
}
