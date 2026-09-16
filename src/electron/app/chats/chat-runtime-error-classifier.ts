import type { ChatErrorKind } from "@/types/chat"

export function classifyChatRuntimeError(error: unknown): ChatErrorKind {
  const normalized = (error instanceof Error ? error.message : String(error)).toLowerCase()
  if (normalized.includes("step limit") || normalized.includes("tool-call step limit")) return "step-limit"
  if (normalized.includes("timed out") || normalized.includes("timeout")) return "timeout"
  if (["cannot access", "blocked", "not allowed", "outside the allowed"].some((value) => normalized.includes(value)))
    return "permission"
  if (normalized.includes("tool") || normalized.includes("integration")) return "tool"
  if (
    [
      "request",
      "response",
      "network",
      "econnreset",
      "connection reset",
      "socket hang up",
      "econnrefused",
      "fetch failed",
    ].some((value) => normalized.includes(value))
  )
    return "request"
  return "unknown"
}
