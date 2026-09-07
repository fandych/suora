import type { Edge, Node } from "@xyflow/react"

import type { WorkflowEdgeData, WorkflowNodeData } from "@/data/domain/models"

export type WorkflowExpressionSuggestion = {
  expression: string
  group: "Current result" | "Workflow input" | "Prior steps" | "Variables"
  description: string
}

type Schema = { description?: string; type?: string; properties?: Record<string, Schema>; items?: Schema }

export type ExpressionSuggestionOptions = {
  includeCurrent?: boolean
}

function getSchema(schemaJson: string | undefined) {
  try {
    return JSON.parse(schemaJson || "{}") as Schema
  } catch {
    return {}
  }
}

function getSchemaFields(schema: Schema, prefix = ""): Array<{ path: string; schema: Schema }> {
  const fields = Object.entries(schema.properties ?? {}).flatMap(([name, property]) => {
    const path = prefix ? `${prefix}.${name}` : name
    return [{ path, schema: property }, ...getSchemaFields(property, path)]
  })
  if (schema.items) fields.push(...getSchemaFields(schema.items, `${prefix}[0]`))
  return fields
}

export function getUpstreamNodeIds(edges: Edge<WorkflowEdgeData>[], selectedNodeId: string) {
  const upstream = new Set<string>()
  const pending = [selectedNodeId]
  while (pending.length > 0) {
    const target = pending.pop()!
    for (const edge of edges) {
      if (edge.target !== target || upstream.has(edge.source)) continue
      upstream.add(edge.source)
      pending.push(edge.source)
    }
  }
  return upstream
}

function getSchemaSuggestions(schemaJson: string | undefined, expressionPrefix: string, group: WorkflowExpressionSuggestion["group"], source: string) {
  return getSchemaFields(getSchema(schemaJson)).map(({ path, schema }) => ({
    expression: `\${${expressionPrefix}.${path}}`,
    group,
    description: `${schema.type ?? "Value"} · ${schema.description || source}`,
  }))
}

export function getWorkflowExpressionSuggestions(nodes: Node<WorkflowNodeData>[], edges: Edge<WorkflowEdgeData>[], selectedNodeId: string, options: ExpressionSuggestionOptions = {}): WorkflowExpressionSuggestion[] {
  const selectedNode = nodes.find((node) => node.id === selectedNodeId)
  const upstreamNodeIds = getUpstreamNodeIds(edges, selectedNodeId)
  const suggestions: WorkflowExpressionSuggestion[] = []

  if (options.includeCurrent) {
    suggestions.push({ expression: "${current}", group: "Current result", description: "The complete raw result of this node." })
    suggestions.push(...getSchemaSuggestions(selectedNode?.data.outputSchemaJson, "current", "Current result", "Declared by this node."))
  }

  const startNode = nodes.find((node) => node.data.kind === "start")
  suggestions.push(...getSchemaSuggestions(startNode?.data.inputSchemaJson, "input", "Workflow input", "Supplied when the workflow starts."))

  for (const node of nodes) {
    if (!upstreamNodeIds.has(node.id)) continue
    suggestions.push({ expression: `\${steps.${node.id}}`, group: "Prior steps", description: `Complete result from ${node.id}.` })
    suggestions.push(...getSchemaSuggestions(node.data.outputSchemaJson, `steps.${node.id}`, "Prior steps", `From ${node.id}.`))
    if (node.data.outputKey) suggestions.push({ expression: `\${vars.${node.data.outputKey}}`, group: "Variables", description: `Result alias from ${node.id}.` })
    if (node.data.kind === "variable-assigner" && node.data.variableName) suggestions.push({ expression: `\${vars.${node.data.variableName}}`, group: "Variables", description: `Variable assigned by ${node.id}.` })
  }

  return suggestions
}

function hasDeclaredPath(schemaJson: string | undefined, path: string) {
  const fields = getSchemaFields(getSchema(schemaJson)).map((field) => field.path)
  return fields.length === 0 || fields.some((field) => field === path || field.startsWith(`${path}.`) || path.startsWith(`${field}.`) || field.startsWith(`${path}[`))
}

export function getExpressionIssues(nodes: Node<WorkflowNodeData>[], edges: Edge<WorkflowEdgeData>[], nodeId: string, value: string | undefined, fieldLabel: string, allowCurrent = false) {
  if (!value) return []
  const issues: string[] = []
  if (/\$\{[^}]*$/.test(value)) issues.push(`${fieldLabel}: unclosed "\${" expression.`)
  if (/\{\{[^}]*$/.test(value)) issues.push(`${fieldLabel}: unclosed "{{" expression.`)
  const upstreamNodeIds = getUpstreamNodeIds(edges, nodeId)
  const inputNode = nodes.find((node) => node.data.kind === "start")
  const expressions = [
    ...value.matchAll(/\$\{\s*([^}|\s]+)[^}]*\}/g).map((match) => match[1]),
    ...value.matchAll(/\{\{\s*([^}|\s]+)[^}]*\}\}/g).map((match) => match[1]),
    ...value.matchAll(/(?<![\w${])\$([a-zA-Z_][\w.]*)/g).map((match) => match[1]),
  ]
  for (const rawExpression of expressions) {
    const expression = rawExpression.replace(/^\$/, "")
    const parts = expression.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean)
    if (parts[0] === "steps") {
      const target = nodes.find((node) => node.id === parts[1])
      if (!target) issues.push(`${fieldLabel}: expression references unknown step "${parts[1] ?? ""}".`)
      else if (!upstreamNodeIds.has(target.id)) issues.push(`${fieldLabel}: step "${target.id}" is not upstream of this node.`)
      else if (parts.length > 2 && !hasDeclaredPath(target.data.outputSchemaJson, parts.slice(2).join("."))) issues.push(`${fieldLabel}: "${parts.slice(2).join(".")}" is not declared by step "${target.id}".`)
    } else if (parts[0] === "input" && parts.length > 1 && !hasDeclaredPath(inputNode?.data.inputSchemaJson, parts.slice(1).join("."))) {
      issues.push(`${fieldLabel}: "${parts.slice(1).join(".")}" is not declared by workflow input.`)
    } else if (parts[0] === "current" && !allowCurrent) {
      issues.push(`${fieldLabel}: current is only available in this node's output mapping.`)
    }
  }
  return [...new Set(issues)]
}
