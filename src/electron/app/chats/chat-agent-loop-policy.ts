import type { FinishReason } from "ai"

export const DEFAULT_CHAT_AGENT_MAX_STEPS = 200

export function normalizeChatAgentMaxSteps(value: unknown) {
  const numericValue = Math.floor(Number(value))
  return Number.isFinite(numericValue) ? Math.min(500, Math.max(1, numericValue)) : DEFAULT_CHAT_AGENT_MAX_STEPS
}

export function getResearchAgentMaxSteps(chatAgentMaxSteps: number) {
  return Math.max(8, Math.min(48, Math.floor(chatAgentMaxSteps / 4)))
}

export function getStepLimitErrorMessage(options: {
  finishReason: FinishReason
  stepCount: number
  maxSteps: number
  agentLabel: string
}) {
  if (options.finishReason !== "tool-calls" || options.stepCount < options.maxSteps) return null
  return `${options.agentLabel} reached the tool-call step limit (${options.maxSteps}) before producing a final answer. Narrow the task or raise the step budget.`
}
