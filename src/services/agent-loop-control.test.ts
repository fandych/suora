import { describe, expect, it } from "vitest"

import { DEFAULT_CHAT_AGENT_MAX_STEPS, getResearchAgentMaxSteps, getStepLimitErrorMessage, normalizeChatAgentMaxSteps } from "@/services/agent-loop-control"

describe("agent loop control", () => {
  it("returns a diagnostic when the chat agent stops at the tool-call step budget", () => {
    expect(getStepLimitErrorMessage({
      finishReason: "tool-calls",
      stepCount: DEFAULT_CHAT_AGENT_MAX_STEPS,
      maxSteps: DEFAULT_CHAT_AGENT_MAX_STEPS,
      agentLabel: "The chat agent",
    })).toContain(`(${DEFAULT_CHAT_AGENT_MAX_STEPS})`)
  })

  it("returns null when the agent stops normally before the step budget", () => {
    expect(getStepLimitErrorMessage({
      finishReason: "stop",
      stepCount: getResearchAgentMaxSteps(DEFAULT_CHAT_AGENT_MAX_STEPS),
      maxSteps: getResearchAgentMaxSteps(DEFAULT_CHAT_AGENT_MAX_STEPS),
      agentLabel: "The research subagent",
    })).toBeNull()

    expect(getStepLimitErrorMessage({
      finishReason: "tool-calls",
      stepCount: getResearchAgentMaxSteps(DEFAULT_CHAT_AGENT_MAX_STEPS) - 1,
      maxSteps: getResearchAgentMaxSteps(DEFAULT_CHAT_AGENT_MAX_STEPS),
      agentLabel: "The research subagent",
    })).toBeNull()
  })

  it("normalizes configured chat max steps to a safe range", () => {
    expect(normalizeChatAgentMaxSteps(undefined)).toBe(DEFAULT_CHAT_AGENT_MAX_STEPS)
    expect(normalizeChatAgentMaxSteps(0)).toBe(1)
    expect(normalizeChatAgentMaxSteps(999)).toBe(500)
    expect(normalizeChatAgentMaxSteps(200.8)).toBe(200)
  })
})