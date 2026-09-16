import type { ChatErrorKind } from "@/types/chat"

export function getChatErrorPresentation(error: string, kind: ChatErrorKind) {
  const messages = {
    "step-limit": [
      "Step limit reached",
      "The chat hit its configured tool-call step limit before a final answer was produced.",
    ],
    timeout: ["Request timed out", "A model or tool request exceeded the configured timeout."],
    permission: ["Operation blocked", "The request was rejected by the current safety or scope policy."],
    tool: ["Tool execution failed", "A tool call failed before the assistant could finish the response."],
    request: ["Request failed", "The model request did not complete successfully."],
    unknown: ["Response failed", "The assistant stopped because of an unexpected runtime error."],
  } as const
  const [title, label] = messages[kind]
  return { title, label, detail: error }
}

export function getChatErrorToolName(kind: ChatErrorKind) {
  return {
    "step-limit": "Generation limit",
    timeout: "Request timeout",
    permission: "Safety policy",
    tool: "Tool execution",
    request: "Model request",
    unknown: "Runtime error",
  }[kind]
}
