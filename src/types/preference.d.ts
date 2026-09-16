export type PreferenceThemeMode = "system" | "light" | "dark"
export type PreferenceThemeAccent = "ocean" | "forest" | "amber" | "rose" | "slate"
export type PreferenceFontScale = "sm" | "md" | "lg"
export type PreferenceLanguage = "zh" | "en"
export type PreferenceCommandConfirmationMode = "daily" | "never" | "always"
export type PreferenceFileAccessPolicy = "allowlist" | "denylist"

export type PreferenceEnvironmentVariable = { key: string; value: string }

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

export type FileAccessDecision = { allowed: boolean; matchedRule: string | null; normalizedPath: string }

export type SystemInfoSnapshot = {
  isDev: boolean
  platform: string
  version: string
  productName: string
  electronVersion: string
  chromeVersion: string
  nodeVersion: string
}

export type EnvironmentToolStatus = {
  id: "nodejs" | "npm" | "python"
  label: string
  command: string
  installed: boolean
  version: string | null
  path: string | null
  error: string | null
}

export type SystemDiagnosticsSnapshot = {
  environment: EnvironmentToolStatus[]
  runtime: {
    timestamp: number
    processMemoryMb: number
    heapUsedMb: number
    totalMemoryGb: number
    freeMemoryGb: number
    uptimeSeconds: number
    cpuCount: number
    loadAverage: [number, number, number]
    pid: number
  }
}

export type UpdaterStateSnapshot = { enabled: boolean; channel: string }
export type UpdateCheckResult = unknown
