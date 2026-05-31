import type { Agent, Model } from '@/types'

export type ChatControlCommand =
  | { type: 'clear'; raw: string }
  | { type: 'help'; raw: string }
  | { type: 'model'; raw: string; reference: string }
  | { type: 'agent'; raw: string; reference: string }

const MODEL_VERBS = ['use', 'user', 'switch', 'select', 'set'] as const

function isVerb(value: string, verbs: readonly string[]): boolean {
  const normalized = value.trim().toLowerCase()
  return verbs.includes(normalized as never)
}

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

  if (/^\/(?:help|\?)$/i.test(trimmed)) {
    return { type: 'help', raw: trimmed }
  }

  // Two shapes:
  //   /model <verb> <reference>   (verb is required to disambiguate)
  //   /model <reference>          (no verb — reference must not itself be a verb)
  const modelVerb = trimmed.match(/^\/model\s+(use|user|switch|select|set)\s+(.+)$/i)
  if (modelVerb?.[2]) {
    const reference = cleanReference(modelVerb[2])
    return reference ? { type: 'model', raw: trimmed, reference } : null
  }
  const modelBare = trimmed.match(/^\/model\s+(.+)$/i)
  if (modelBare?.[1]) {
    const raw = modelBare[1].trim()
    // Reject `/model use` (verb only) — the user probably forgot the name.
    if (isVerb(raw, MODEL_VERBS)) return null
    const reference = cleanReference(raw)
    return reference ? { type: 'model', raw: trimmed, reference } : null
  }

  const agentMatch = trimmed.match(/^\/agent\s+(use|switch|select|set)\s+(.+)$/i)
  if (agentMatch?.[2]) {
    const reference = cleanReference(agentMatch[2])
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
