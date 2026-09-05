import type { FinishReason } from "ai"

export const DEFAULT_CHAT_AGENT_MAX_STEPS = 200
export const MIN_CHAT_AGENT_MAX_STEPS = 1
export const MAX_CHAT_AGENT_MAX_STEPS = 500

export function normalizeChatAgentMaxSteps(value: unknown) {
  const numericValue = Math.floor(Number(value))
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_CHAT_AGENT_MAX_STEPS
  }

  return Math.min(MAX_CHAT_AGENT_MAX_STEPS, Math.max(MIN_CHAT_AGENT_MAX_STEPS, numericValue))
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
  const { finishReason, stepCount, maxSteps, agentLabel } = options
  if (finishReason !== "tool-calls" || stepCount < maxSteps) {
    return null
  }

  return `${agentLabel} reached the tool-call step limit (${maxSteps}) before producing a final answer. Narrow the task or raise the step budget.`
}