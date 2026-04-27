const DEFAULT_MAX_SENSITIVE_TEXT_LENGTH = 600

export interface SanitizeSensitiveTextOptions {
  maxLength?: number
}

function redactPath(match: string): string {
  const parts = match.split(/[\\/]/).filter(Boolean)
  const basename = parts[parts.length - 1] || match
  return `<...>/${basename}`
}

export function sanitizeSensitiveText(
  raw: unknown,
  options: SanitizeSensitiveTextOptions = {},
): string {
  const maxLength = options.maxLength ?? DEFAULT_MAX_SENSITIVE_TEXT_LENGTH
  const text = typeof raw === 'string' ? raw : raw instanceof Error ? raw.message : String(raw ?? '')
  if (!text) return ''

  let cleaned = text
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, 'sk-***REDACTED***')
    .replace(/xai-[A-Za-z0-9_-]{20,}/g, 'xai-***REDACTED***')
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, 'AIza***REDACTED***')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._-]{20,}/gi, '$1***REDACTED***')
    .replace(/\b(api[_-]?key["']?\s*[:=]\s*["']?)[A-Za-z0-9_\-./=+]{12,}/gi, '$1***REDACTED***')
    .replace(/\b(authorization["']?\s*[:=]\s*["']?)[A-Za-z0-9._\-=+]{12,}/gi, '$1***REDACTED***')
    .replace(/\b((?:access|refresh|id)?[_-]?token["']?\s*[:=]\s*["']?)[A-Za-z0-9._\-=+]{16,}/gi, '$1***REDACTED***')
    .replace(/(\\\\[^\\/\s'"]+(?:\\[^\s'"]+)+|[A-Za-z]:\\[^\s'"]+|\/(?:home|Users|var|etc|root|tmp|opt|mnt)\/[^\s'"]+)/g, redactPath)

  if (maxLength > 0 && cleaned.length > maxLength) {
    cleaned = `${cleaned.slice(0, maxLength)} ...[+${cleaned.length - maxLength} chars]`
  }

  return cleaned
}

export function sanitizeToolError(raw: unknown, maxLength = DEFAULT_MAX_SENSITIVE_TEXT_LENGTH): string {
  return sanitizeSensitiveText(raw, { maxLength })
}
