export type PreferenceThemeMode = "system" | "light" | "dark"
export type PreferenceThemeAccent = "ocean" | "forest" | "amber" | "rose" | "slate"
export type PreferenceFontScale = "sm" | "md" | "lg"
export type PreferenceLanguage = "zh" | "en"
export type PreferenceCommandConfirmationMode = "daily" | "never" | "always"
export type PreferenceFileAccessPolicy = "allowlist" | "denylist"

export type PreferenceEnvironmentVariable = {
  key: string
  value: string
}

export type PreferenceSettings = {
  themeMode: PreferenceThemeMode
  themeAccent: PreferenceThemeAccent
  fontScale: PreferenceFontScale
  language: PreferenceLanguage
  workspaceName: string
  workspacePath: string
  autoSaveConversations: boolean
  autoStartEnabled: boolean
  defaultModelProviderId: string
  chatRequestTimeoutMs: number
  notes: string
  commandConfirmationMode: PreferenceCommandConfirmationMode
  fileAccessPolicy: PreferenceFileAccessPolicy
  fileAccessDirectories: string[]
  commandBlacklist: string[]
  commandAllowlist: string[]
  mailServiceEnabled: boolean
  mailServerHost: string
  mailServerPort: number
  mailServerUsername: string
  mailServerPassword: string
  mailServerFrom: string
  mailServerTls: boolean
  globalEnvironmentVariables: PreferenceEnvironmentVariable[]
  autoCheckUpdates: boolean
  ignoreSslErrors: boolean
}

export type FileAccessDecision = {
  allowed: boolean
  matchedRule: string | null
  normalizedPath: string
}

export const PREFERENCE_STORAGE_KEY = "suora:preference-settings"
export const COMMAND_CONFIRMATION_STORAGE_KEY = "suora:command-confirmation-last-date"

export const DEFAULT_PREFERENCES: PreferenceSettings = {
  themeMode: "system",
  themeAccent: "ocean",
  fontScale: "md",
  language: "zh",
  workspaceName: "SUORA Workspace",
  workspacePath: "",
  autoSaveConversations: true,
  autoStartEnabled: false,
  defaultModelProviderId: "provider-openai",
  chatRequestTimeoutMs: 0,
  notes: "",
  commandConfirmationMode: "daily",
  fileAccessPolicy: "denylist",
  fileAccessDirectories: [],
  commandBlacklist: [],
  commandAllowlist: ["git", "node", "npm", "npx", "pnpm", "yarn", "python", "python3", "rg", "tsc", "tsx", "vite", "vitest", "eslint", "bun"],
  mailServiceEnabled: false,
  mailServerHost: "",
  mailServerPort: 587,
  mailServerUsername: "",
  mailServerPassword: "",
  mailServerFrom: "",
  mailServerTls: true,
  globalEnvironmentVariables: [],
  autoCheckUpdates: true,
  ignoreSslErrors: false,
}

export const THEME_ACCENTS: Record<PreferenceThemeAccent, {
  primary: string
  primaryForeground: string
  accent: string
  sidebarPrimary: string
  ring: string
}> = {
  ocean: {
    primary: "oklch(0.57 0.18 246)",
    primaryForeground: "oklch(0.98 0.01 247)",
    accent: "oklch(0.57 0.18 246)",
    sidebarPrimary: "oklch(0.6 0.17 246)",
    ring: "oklch(0.71 0.09 242)",
  },
  forest: {
    primary: "oklch(0.62 0.16 156)",
    primaryForeground: "oklch(0.99 0.01 156)",
    accent: "oklch(0.62 0.16 156)",
    sidebarPrimary: "oklch(0.58 0.15 156)",
    ring: "oklch(0.75 0.08 160)",
  },
  amber: {
    primary: "oklch(0.72 0.16 78)",
    primaryForeground: "oklch(0.22 0.03 68)",
    accent: "oklch(0.72 0.16 78)",
    sidebarPrimary: "oklch(0.68 0.15 78)",
    ring: "oklch(0.8 0.08 78)",
  },
  rose: {
    primary: "oklch(0.64 0.19 18)",
    primaryForeground: "oklch(0.98 0.01 18)",
    accent: "oklch(0.64 0.19 18)",
    sidebarPrimary: "oklch(0.61 0.18 18)",
    ring: "oklch(0.76 0.08 18)",
  },
  slate: {
    primary: "oklch(0.49 0.05 244)",
    primaryForeground: "oklch(0.98 0.01 244)",
    accent: "oklch(0.49 0.05 244)",
    sidebarPrimary: "oklch(0.53 0.05 244)",
    ring: "oklch(0.69 0.03 244)",
  },
}

export const FONT_SCALE_MAP: Record<PreferenceFontScale, string> = {
  sm: "0.9375",
  md: "1",
  lg: "1.0625",
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeEnvironmentVariables(value: unknown): PreferenceEnvironmentVariable[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null
      }

      const key = typeof (item as { key?: unknown }).key === "string"
        ? (item as { key: string }).key.trim()
        : ""
      const variableValue = typeof (item as { value?: unknown }).value === "string"
        ? (item as { value: string }).value
        : ""

      if (!key) {
        return null
      }

      return { key, value: variableValue }
    })
    .filter((item): item is PreferenceEnvironmentVariable => Boolean(item))
}

export function createDefaultPreferenceSettings(): PreferenceSettings {
  return {
    ...DEFAULT_PREFERENCES,
    fileAccessDirectories: [...DEFAULT_PREFERENCES.fileAccessDirectories],
    commandBlacklist: [...DEFAULT_PREFERENCES.commandBlacklist],
    commandAllowlist: [...DEFAULT_PREFERENCES.commandAllowlist],
    globalEnvironmentVariables: DEFAULT_PREFERENCES.globalEnvironmentVariables.map((item) => ({ ...item })),
  }
}

export function sanitizePreferenceSettings(settings: Partial<PreferenceSettings> | null | undefined): PreferenceSettings {
  const next = {
    ...createDefaultPreferenceSettings(),
    ...(settings ?? {}),
  }

  return {
    ...next,
    themeMode: next.themeMode === "light" || next.themeMode === "dark" ? next.themeMode : "system",
    themeAccent: next.themeAccent && next.themeAccent in THEME_ACCENTS ? next.themeAccent : "ocean",
    fontScale: next.fontScale === "sm" || next.fontScale === "lg" ? next.fontScale : "md",
    language: next.language === "en" ? "en" : "zh",
    workspaceName: next.workspaceName.trim(),
    workspacePath: next.workspacePath.trim(),
    autoSaveConversations: Boolean(next.autoSaveConversations),
    autoStartEnabled: Boolean(next.autoStartEnabled),
    defaultModelProviderId: next.defaultModelProviderId.trim(),
    chatRequestTimeoutMs: Math.max(0, Number(next.chatRequestTimeoutMs) || 0),
    notes: next.notes,
    commandConfirmationMode: next.commandConfirmationMode === "never" || next.commandConfirmationMode === "always" ? next.commandConfirmationMode : "daily",
    fileAccessPolicy: next.fileAccessPolicy === "allowlist" ? "allowlist" : "denylist",
    fileAccessDirectories: normalizeStringArray(next.fileAccessDirectories),
    commandBlacklist: normalizeStringArray(next.commandBlacklist),
    commandAllowlist: normalizeStringArray(next.commandAllowlist),
    mailServiceEnabled: Boolean(next.mailServiceEnabled),
    mailServerHost: next.mailServerHost.trim(),
    mailServerPort: Math.max(1, Number(next.mailServerPort) || DEFAULT_PREFERENCES.mailServerPort),
    mailServerUsername: next.mailServerUsername.trim(),
    mailServerPassword: next.mailServerPassword,
    mailServerFrom: next.mailServerFrom.trim(),
    mailServerTls: Boolean(next.mailServerTls),
    globalEnvironmentVariables: normalizeEnvironmentVariables(next.globalEnvironmentVariables),
    autoCheckUpdates: Boolean(next.autoCheckUpdates),
    ignoreSslErrors: Boolean(next.ignoreSslErrors),
  }
}

export function resolvePreferenceSettings(raw: string | null | undefined) {
  if (!raw) {
    return createDefaultPreferenceSettings()
  }

  try {
    return sanitizePreferenceSettings(JSON.parse(raw) as Partial<PreferenceSettings>)
  } catch {
    return createDefaultPreferenceSettings()
  }
}

export function getTodayPreferenceDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function shouldConfirmWorkspaceCommand(mode: PreferenceCommandConfirmationMode, lastConfirmedDate: string | null | undefined, today = getTodayPreferenceDateKey()) {
  if (mode === "never") {
    return false
  }

  if (mode === "always") {
    return true
  }

  return lastConfirmedDate !== today
}

export function normalizeWorkspaceRelativePath(value: string | null | undefined) {
  const trimmed = (value ?? ".").trim().replace(/\\/g, "/")
  if (!trimmed || trimmed === "." || trimmed === "./") {
    return ""
  }

  return trimmed.replace(/^\.\//, "").replace(/^\//, "").replace(/\/+$/, "")
}

function pathMatchesRule(normalizedPath: string, rule: string) {
  const normalizedRule = normalizeWorkspaceRelativePath(rule)
  if (!normalizedRule) {
    return normalizedPath === ""
  }

  return normalizedPath === normalizedRule || normalizedPath.startsWith(`${normalizedRule}/`)
}

export function getFileAccessDecision(settings: Pick<PreferenceSettings, "fileAccessPolicy" | "fileAccessDirectories">, relativePath: string | null | undefined): FileAccessDecision {
  const normalizedPath = normalizeWorkspaceRelativePath(relativePath)
  const rules = normalizeStringArray(settings.fileAccessDirectories)
  const matchedRule = rules.find((rule) => pathMatchesRule(normalizedPath, rule)) ?? null

  if (rules.length === 0) {
    return { allowed: true, matchedRule, normalizedPath }
  }

  if (settings.fileAccessPolicy === "allowlist") {
    return { allowed: Boolean(matchedRule), matchedRule, normalizedPath }
  }

  return { allowed: !matchedRule, matchedRule, normalizedPath }
}

export function getCommandBlacklistMatch(settings: Pick<PreferenceSettings, "commandBlacklist">, command: string) {
  const normalizedCommand = command.trim().toLowerCase()
  const rules = normalizeStringArray(settings.commandBlacklist).map((item) => item.toLowerCase())
  return rules.find((item) => normalizedCommand.includes(item)) ?? null
}

export function validateSystemMailSettings(settings: Pick<PreferenceSettings, "mailServiceEnabled" | "mailServerHost" | "mailServerPort" | "mailServerUsername" | "mailServerPassword" | "mailServerFrom">) {
  if (!settings.mailServiceEnabled) {
    return ["Mail service is disabled."]
  }

  return [
    !settings.mailServerHost ? "SMTP host" : null,
    !settings.mailServerPort ? "SMTP port" : null,
    !settings.mailServerUsername ? "SMTP username" : null,
    !settings.mailServerPassword ? "SMTP password" : null,
    !settings.mailServerFrom ? "From address" : null,
  ].filter(Boolean) as string[]
}

export function hasValidSystemMailSettings(settings: Pick<PreferenceSettings, "mailServiceEnabled" | "mailServerHost" | "mailServerPort" | "mailServerUsername" | "mailServerPassword" | "mailServerFrom">) {
  return validateSystemMailSettings(settings).length === 0
}