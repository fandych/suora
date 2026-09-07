export type WorkflowVariableContext = Record<string, unknown> & {
  input: unknown
  vars: Record<string, unknown>
  steps: Record<string, unknown>
  current?: unknown
}

type OutputSchema = {
  default?: unknown
  properties?: Record<string, OutputSchema>
}

function navigateObject(obj: unknown, parts: string[]): unknown {
  let curr: unknown = obj
  for (const part of parts) {
    if (curr === null || curr === undefined || typeof curr !== "object") return undefined
    curr = (curr as Record<string, unknown>)[part]
  }
  return curr
}

function applyPipeFilters(val: unknown, pipes: string[]): unknown {
  let curr = val
  for (const pipe of pipes) {
    const trimmed = pipe.trim()
    if (!trimmed) continue
    if (trimmed === "upper" || trimmed === "uppercase") curr = String(curr ?? "").toUpperCase()
    else if (trimmed === "lower" || trimmed === "lowercase") curr = String(curr ?? "").toLowerCase()
    else if (trimmed === "trim") curr = String(curr ?? "").trim()
    else if (trimmed === "json") curr = JSON.stringify(curr)
    else if (trimmed.startsWith("default(")) {
      const match = trimmed.match(/^default\(\s*(['"]?)(.*?)\1\s*\)$/)
      if (curr === undefined || curr === null || curr === "") curr = match ? match[2] : ""
    }
  }
  return curr
}

export function readPath(context: WorkflowVariableContext, expression: string): unknown {
  if (!expression || typeof expression !== "string") return undefined
  let rawPath = expression.trim()
  rawPath = rawPath.replace(/^\{\{\s*|\s*\}\}$/g, "").replace(/^\$\{\s*|\s*\}$/g, "")
  if (!rawPath) return undefined

  const pipeParts = rawPath.split("|").map((part) => part.trim())
  const parts = pipeParts[0].replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean)
  if (parts.length === 0) return applyPipeFilters(undefined, pipeParts.slice(1))

  let val: unknown
  const first = parts[0]
  if (first === "input" || first === "$input") val = navigateObject(context.input, parts.slice(1))
  else if (first === "vars" || first === "$vars") val = navigateObject(context.vars, parts.slice(1))
  else if (first === "steps" || first === "$steps") val = navigateObject(context.steps, parts.slice(1))
  else if (first === "context" || first === "$context") val = navigateObject(context, parts.slice(1))
  else {
    val = navigateObject(context, parts)
    if (val === undefined) val = navigateObject(context.vars, parts)
    if (val === undefined) val = navigateObject(context.steps, parts)
    if (val === undefined) val = navigateObject(context.input, parts)
  }
  return applyPipeFilters(val, pipeParts.slice(1))
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

export function interpolate(value: string | undefined | null, context: WorkflowVariableContext): string {
  if (!value) return ""
  return value
    .replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expression) => formatValue(readPath(context, expression)))
    .replace(/\$\{([^}]+)\}/g, (_match, expression) => formatValue(readPath(context, expression)))
    .replace(/(^|[^a-zA-Z0-9_$])\$([a-zA-Z_][\w.]*)/g, (match, prefix, expression) => {
      const result = readPath(context, expression)
      return result === undefined ? match : `${prefix}${formatValue(result)}`
    })
}

function resolveOutputValue(value: unknown, context: WorkflowVariableContext): unknown {
  if (typeof value !== "string") return value
  const expression = value.trim().match(/^(?:\{\{\s*([^}]+)\s*\}\}|\$\{\s*([^}]+)\s*\}|\$([a-zA-Z_][\w.]*))$/)
  if (expression) {
    const resolved = readPath(context, expression[1] ?? expression[2] ?? expression[3])
    if (resolved !== undefined) return resolved
  }
  return interpolate(value, context)
}

export function mapNodeOutput(outputSchemaJson: string | undefined, context: WorkflowVariableContext): Record<string, unknown> | undefined {
  const mapProperties = (schema: OutputSchema): Record<string, unknown> | undefined => {
    const entries = Object.entries(schema.properties ?? {})
    if (entries.length === 0) return undefined
    return Object.fromEntries(entries.flatMap(([name, property]) => {
      const nested = mapProperties(property)
      if (nested) return [[name, nested]]
      if (property.default !== undefined) return [[name, resolveOutputValue(property.default, context)]]
      return []
    }))
  }
  try {
    const schema = JSON.parse(outputSchemaJson || "{}") as OutputSchema
    return mapProperties(schema)
  } catch {
    return undefined
  }
}

export function combineNodeOutput(rawOutput: unknown, mappedOutput: Record<string, unknown> | undefined): unknown {
  if (!mappedOutput) return rawOutput
  if (rawOutput !== null && typeof rawOutput === "object" && !Array.isArray(rawOutput)) return { ...rawOutput as Record<string, unknown>, ...mappedOutput }
  return { value: rawOutput, ...mappedOutput }
}
