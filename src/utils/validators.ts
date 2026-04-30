// Lightweight runtime validators for data loaded from disk.
// These guard against corrupted or outdated JSON files that no longer match
// the expected TypeScript interfaces. Each validator returns a type predicate
// so the compiler narrows the value after a successful check.

import type { Agent, Session, PluginManifestV2 } from '@/types'

/**
 * Validates that an unknown value has the minimum shape of a Session.
 * Missing optional fields are tolerated — only the structural invariants
 * (id, messages array) are required.
 */
export function isValidSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<Session>
  return typeof v.id === 'string' && Array.isArray(v.messages)
}

/**
 * Validates that an unknown value has the minimum shape of an Agent.
 */
export function isValidAgent(value: unknown): value is Agent {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<Agent>
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.systemPrompt === 'string' &&
    typeof v.modelId === 'string'
  )
}

/**
 * Coerce a partially-valid Agent blob into a full Agent by supplying defaults
 * for any missing optional fields. Returns null if required fields are absent.
 */
export function coerceAgent(value: unknown): Agent | null {
  if (!isValidAgent(value)) return null
  const result: Agent = {
    ...(value as Agent),
  }
  // Supply defaults for required fields that may be missing in older files
  if (!Array.isArray(result.skills)) result.skills = []
  if (typeof result.enabled !== 'boolean') result.enabled = true
  if (!Array.isArray(result.memories)) result.memories = []
  if (typeof result.autoLearn !== 'boolean') result.autoLearn = false
  return result
}

/**
 * Validates the minimum shape of a PluginManifestV2.
 */
export function isValidPluginManifest(value: unknown): value is PluginManifestV2 {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<PluginManifestV2>
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.version === 'string'
  )
}
