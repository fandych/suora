export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback
  }

  const normalized = value.trim()
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return fallback
  }

  try {
    return JSON.parse(normalized) as T
  } catch {
    return fallback
  }
}

export function parseObjectJson<T extends Record<string, unknown>>(value: string | null | undefined, fallback: T): T {
  const parsed = parseJson<unknown>(value, fallback)
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as T : fallback
}

export function parseArrayJson<T>(value: string | null | undefined, fallback: T[]): T[] {
  const parsed = parseJson<unknown>(value, fallback)
  return Array.isArray(parsed) ? parsed as T[] : fallback
}
