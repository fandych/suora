import type { Agent, Model } from '@/types'

export type ChatControlCommand =
  | { type: 'clear'; raw: string }
  | { type: 'model'; raw: string; reference: string }
  | { type: 'agent'; raw: string; reference: string }

function cleanReference(value: string): string {
  return value
    .trim()
    .replace(/^\$+/, '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/gu, '')
    .trim()
}

export function parseChatControlCommand(input: string): ChatControlCommand | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null

  if (/^\/clear(?:\s+context)?$/i.test(trimmed)) {
    return { type: 'clear', raw: trimmed }
  }

  // Support "user" as an alias for "use" because channel users may type
  // `/model user x` when asking to use a model.
  const modelMatch = trimmed.match(/^\/model(?:\s+(?:use|user|switch|select|set))?\s+(.+)$/i)
  if (modelMatch?.[1]) {
    const reference = cleanReference(modelMatch[1])
    return reference ? { type: 'model', raw: trimmed, reference } : null
  }

  const agentMatch = trimmed.match(/^\/agent\s+(?:use|switch|select|set)\s+(.+)$/i)
  if (agentMatch?.[1]) {
    const reference = cleanReference(agentMatch[1])
    return reference ? { type: 'agent', raw: trimmed, reference } : null
  }

  return null
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function matchesReference(item: { id: string; name: string }, reference: string): boolean {
  const normalizedReference = normalize(cleanReference(reference))
  return normalize(item.id) === normalizedReference || normalize(item.name) === normalizedReference
}

export function resolveModelControlReference(reference: string, models: Model[]): Model | null {
  return models.find((model) => model.enabled && matchesReference(model, reference)) ?? null
}

export function resolveAgentControlReference(reference: string, agents: Agent[]): Agent | null {
  return agents.find((agent) => agent.enabled !== false && matchesReference(agent, reference)) ?? null
}
