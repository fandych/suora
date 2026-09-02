export type ChatToolActivity = {
  id: string
  toolName: string
  input?: Record<string, unknown>
  output?: string
  error?: string
}

export type ChatMessagePart =
  | { id: string; type: "text"; content: string; isPending?: boolean }
  | { id: string; type: "tool"; activity: ChatToolActivity }