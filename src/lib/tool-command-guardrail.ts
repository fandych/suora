const COMMAND_CONFIRMATION_STORAGE_KEY = "suora:command-confirmation-last-date"

export type PreferenceCommandConfirmationMode = "daily" | "never" | "always"

export type PreferenceEnvironmentVariable = {
  key: string
  value: string
}

export type ToolPreferenceSettings = {
  commandConfirmationMode?: PreferenceCommandConfirmationMode
  globalEnvironmentVariables?: PreferenceEnvironmentVariable[]
}

export function shouldConfirmWorkspaceCommand(mode: PreferenceCommandConfirmationMode) {
  if (mode === "never") return false
  if (mode === "always") return true
  if (typeof window === "undefined") return false

  const today = new Date().toISOString().slice(0, 10)
  return window.localStorage.getItem(COMMAND_CONFIRMATION_STORAGE_KEY) !== today
}

export function markWorkspaceCommandConfirmed(mode: PreferenceCommandConfirmationMode) {
  if (mode !== "daily" || typeof window === "undefined") return
  window.localStorage.setItem(COMMAND_CONFIRMATION_STORAGE_KEY, new Date().toISOString().slice(0, 10))
}

export function buildCommandEnvironment(settings: ToolPreferenceSettings) {
  return Object.fromEntries(
    (settings.globalEnvironmentVariables ?? [])
      .filter((item) => item && typeof item.key === "string" && item.key.trim())
      .map((item) => [item.key.trim(), typeof item.value === "string" ? item.value : ""]),
  )
}