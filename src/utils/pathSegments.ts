const FALLBACK_SEGMENT = 'item'

export function safePathSegment(value: string, fallback = FALLBACK_SEGMENT): string {
  const trimmed = value.trim()
  const sanitized = trimmed
    .replace(/[/\\]+/g, '-')
    .replace(/\.{2,}/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!sanitized || sanitized === '.' || sanitized === '..') return fallback
  return sanitized.slice(0, 120)
}

export function skillDirectorySegment(skillName: string): string {
  return safePathSegment(skillName.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'), 'skill')
}
