import type { ExecutionContext } from "@/data/repositories/workflow-execution-engine"
import type { WorkflowTraceSnapshot } from "@/data/domain/models"

const sensitiveKey = /authorization|proxy-authorization|cookie|api[-_]?key|token|secret|password|passwd|credential|private_key/i
const maxStringLength = 16_384
const maxEntries = 100
const maxDepth = 8

export function createWorkflowTraceSnapshot(context: ExecutionContext): WorkflowTraceSnapshot {
  const redactedPaths: string[] = []
  let truncated = false
  const sanitize = (value: unknown, path: string, depth = 0): unknown => {
    if (depth >= maxDepth) { truncated = true; return "[max depth reached]" }
    if (typeof value === "string") {
      if (value.length <= maxStringLength) return value
      truncated = true
      return `${value.slice(0, maxStringLength)}… [truncated]`
    }
    if (value === null || typeof value !== "object") return value
    if (Array.isArray(value)) {
      const items = value.slice(0, maxEntries).map((item, index) => sanitize(item, `${path}[${index}]`, depth + 1))
      if (value.length > maxEntries) { truncated = true; items.push(`[${value.length - maxEntries} items omitted]`) }
      return items
    }
    const entries = Object.entries(value as Record<string, unknown>)
    const result: Record<string, unknown> = {}
    for (const [key, child] of entries.slice(0, maxEntries)) {
      const childPath = path ? `${path}.${key}` : key
      if (sensitiveKey.test(key)) { result[key] = "[REDACTED]"; redactedPaths.push(childPath) }
      else result[key] = sanitize(child, childPath, depth + 1)
    }
    if (entries.length > maxEntries) { truncated = true; result["[omitted]"] = `${entries.length - maxEntries} keys omitted` }
    return result
  }

  return {
    schemaVersion: 1,
    input: sanitize(context.input, "input"),
    current: sanitize(context.current, "current"),
    vars: sanitize(context.vars, "vars") as Record<string, unknown>,
    steps: sanitize(context.steps, "steps") as Record<string, unknown>,
    truncated,
    redactedPaths,
  }
}
