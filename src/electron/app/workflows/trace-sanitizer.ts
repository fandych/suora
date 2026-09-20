import type { WorkflowTraceSnapshot, WorkflowExecutionContext } from "@/types/workflow"

const sensitiveKey =
  /authorization|proxy-authorization|cookie|bearer|api[-_]?key|apikey|token|secret|password|passwd|credential|private[-_]?key|access[-_]?key/i

export function createWorkflowTraceSnapshot(context: WorkflowExecutionContext): WorkflowTraceSnapshot {
  const redactedPaths: string[] = []
  let truncated = false
  const sanitize = (value: unknown, path: string, depth = 0): unknown => {
    if (depth >= 8) {
      truncated = true
      return "[max depth reached]"
    }
    if (typeof value === "string") {
      if (value.length <= 16_384) return value
      truncated = true
      return `${value.slice(0, 16_384)}… [truncated]`
    }
    if (value === null || typeof value !== "object") return value
    if (Array.isArray(value))
      return value.slice(0, 100).map((item, index) => sanitize(item, `${path}[${index}]`, depth + 1))
    const result: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
      const childPath = path ? `${path}.${key}` : key
      if (sensitiveKey.test(key)) {
        result[key] = "[REDACTED]"
        redactedPaths.push(childPath)
      } else result[key] = sanitize(child, childPath, depth + 1)
    }
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
