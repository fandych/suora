export type ChatErrorKind = "step-limit" | "timeout" | "tool" | "permission" | "request" | "unknown"

export function detectChatErrorKind(error: string): ChatErrorKind {
  const normalized = error.toLowerCase()

  if (normalized.includes("step limit") || normalized.includes("tool-call step limit")) {
    return "step-limit"
  }

  if (normalized.includes("timed out") || normalized.includes("timeout")) {
    return "timeout"
  }

  if (normalized.includes("cannot access") || normalized.includes("blocked") || normalized.includes("not allowed") || normalized.includes("outside the allowed")) {
    return "permission"
  }

  if (normalized.includes("tool") || normalized.includes("integration")) {
    return "tool"
  }

  if (normalized.includes("request") || normalized.includes("response") || normalized.includes("network")) {
    return "request"
  }

  return "unknown"
}

export function getChatErrorPresentation(error: string, kind: ChatErrorKind) {
  switch (kind) {
    case "step-limit":
      return {
        title: "Step limit reached",
        label: "The chat hit its configured tool-call step limit before a final answer was produced.",
        detail: error,
      }
    case "timeout":
      return {
        title: "Request timed out",
        label: "A model or tool request exceeded the configured timeout.",
        detail: error,
      }
    case "permission":
      return {
        title: "Operation blocked",
        label: "The request was rejected by the current safety or scope policy.",
        detail: error,
      }
    case "tool":
      return {
        title: "Tool execution failed",
        label: "A tool call failed before the assistant could finish the response.",
        detail: error,
      }
    case "request":
      return {
        title: "Request failed",
        label: "The model request did not complete successfully.",
        detail: error,
      }
    default:
      return {
        title: "Response failed",
        label: "The assistant stopped because of an unexpected runtime error.",
        detail: error,
      }
  }
}

export function getChatErrorToolName(kind: ChatErrorKind) {
  switch (kind) {
    case "step-limit":
      return "Generation limit"
    case "timeout":
      return "Request timeout"
    case "permission":
      return "Safety policy"
    case "tool":
      return "Tool execution"
    case "request":
      return "Model request"
    default:
      return "Runtime error"
  }
}