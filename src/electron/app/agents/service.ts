import {
  createAgent,
  deleteAgent,
  getAgentSetting,
  getAgent,
  listAgents,
  saveAgentSetting,
  saveAgent,
} from "@/electron/app/agents/repository"
import type { AgentListOptions, AgentPayload, AgentSummary } from "@/types/agent"
import { builtinAgents } from "@/electron/app/agents/builtin"

function parseSettings(value: string | null) {
  try {
    const parsed = value ? (JSON.parse(value) as { disabledSystemAgentIds?: unknown }) : {}
    return new Set(
      Array.isArray(parsed.disabledSystemAgentIds)
        ? parsed.disabledSystemAgentIds.filter((id): id is string => typeof id === "string")
        : [],
    )
  } catch (error) {
    console.warn("Failed to parse agent settings. Falling back to an empty disabled set.", error)
    return new Set<string>()
  }
}

function hydrate(agent: AgentSummary, disabledIds: Set<string>): AgentSummary {
  const source = agent.kind === "custom" ? "custom" : "system"
  return { ...agent, source, isDisabled: source === "system" && disabledIds.has(agent.id) }
}

function hydratePayload(payload: AgentPayload, disabledIds: Set<string>): AgentPayload {
  return { ...payload, agent: payload.agent ? hydrate(payload.agent, disabledIds) : null }
}

export const agentService = {
  async list(options: AgentListOptions = {}) {
    const disabledIds = parseSettings(await getAgentSetting("agent_settings"))
    const stored = await listAgents()
    const all = [
      ...stored,
      ...builtinAgents
        .map(({ agent }: AgentPayload) => agent)
        .filter((agent: AgentSummary | null): agent is AgentSummary => Boolean(agent)),
    ]
    const unique = new Map(all.map((agent) => [agent.id, hydrate(agent, disabledIds)]))
    return [...unique.values()].filter((agent) => {
      if (options.source && agent.source !== options.source) return false
      if (options.title && !agent.title.toLocaleLowerCase().includes(options.title.toLocaleLowerCase())) return false
      if (options.isDisabled !== undefined && agent.isDisabled !== options.isDisabled) return false
      return true
    })
  },
  async get(agentId: string) {
    const disabledIds = parseSettings(await getAgentSetting("agent_settings"))
    const stored = (await getAgent(agentId)) as AgentPayload
    const system = builtinAgents.find((item: AgentPayload) => item.agent?.id === agentId)
    return hydratePayload(stored.agent ? stored : (system ?? { agent: null, versions: [] }), disabledIds)
  },
  create: () => createAgent(),
  save: (payload: Parameters<typeof saveAgent>[0]) => saveAgent(payload),
  remove: (agentId: string) => deleteAgent(agentId),
  getSettings: () => getAgentSetting("agent_settings"),
  saveSettings: (payload: unknown) => saveAgentSetting("agent_settings", payload),
}
