import { FONT_SCALE_MAP, THEME_ACCENTS } from "@/lib/preference-theme"
import type { PreferenceEnvironmentVariable, PreferenceSettings } from "@/types/preference"
import {
  checkForUpdates,
  getSystemDiagnostics,
  getSystemInfo,
  getUpdaterState,
} from "@/services/preference-system-status"

function applyToDocument(settings: Pick<PreferenceSettings, "themeMode" | "themeAccent" | "fontScale" | "language">) {
  if (typeof document === "undefined") return

  const root = document.documentElement
  const prefersDark =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  const useDarkMode = settings.themeMode === "dark" || (settings.themeMode === "system" && prefersDark)
  const accent = THEME_ACCENTS[settings.themeAccent] ?? THEME_ACCENTS.ocean
  const fontScale = FONT_SCALE_MAP[settings.fontScale] ?? FONT_SCALE_MAP.md

  root.classList.toggle("dark", useDarkMode)
  root.lang = settings.language === "zh" ? "zh-CN" : "en"
  root.dataset.themeAccent = settings.themeAccent
  root.style.setProperty("--app-font-scale", fontScale)
  root.style.setProperty("--primary", accent.primary)
  root.style.setProperty("--primary-foreground", accent.primaryForeground)
  root.style.setProperty("--accent", accent.accent)
  root.style.setProperty("--accent-foreground", accent.primaryForeground)
  root.style.setProperty("--sidebar-primary", accent.sidebarPrimary)
  root.style.setProperty("--sidebar-primary-foreground", accent.primaryForeground)
  root.style.setProperty("--ring", accent.ring)
}

export const PreferenceApi = {
  get: async () => {
    const value = (await window.app!.preferences.get()) as string | null
    return value ? (JSON.parse(value) as PreferenceSettings) : createRendererPreferenceDefaults()
  },
  save: async (settings: PreferenceSettings) => {
    const value = (await window.app!.preferences.save(JSON.stringify(settings))) as string
    const normalized = JSON.parse(value) as PreferenceSettings
    applyToDocument(normalized)
    return normalized
  },
  createDefault: createRendererPreferenceDefaults,
  applyToDocument,
  validateMail: validatePreferenceMailForm,
  getSystemInfo,
  getDiagnostics: getSystemDiagnostics,
  getUpdaterState,
  checkForUpdates,
  systemInfo: () => window.app!.system.info(),
  diagnostics: () => window.app!.system.diagnostics(),
  updaterState: () => window.app!.updater.getState(),
  checkUpdates: () => window.app!.updater.check(),
}

function createRendererPreferenceDefaults(): PreferenceSettings {
  return {
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
    commandAllowlist: [
      "git",
      "node",
      "npm",
      "npx",
      "pnpm",
      "yarn",
      "python",
      "python3",
      "rg",
      "tsc",
      "tsx",
      "vite",
      "vitest",
      "eslint",
      "bun",
    ],
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
}

function validatePreferenceMailForm(
  settings: Pick<
    PreferenceSettings,
    | "mailServiceEnabled"
    | "mailServerHost"
    | "mailServerPort"
    | "mailServerUsername"
    | "mailServerPassword"
    | "mailServerFrom"
  >,
) {
  if (!settings.mailServiceEnabled) return ["Mail service is disabled."]
  return [
    !settings.mailServerHost ? "SMTP host" : null,
    !settings.mailServerPort ? "SMTP port" : null,
    !settings.mailServerUsername ? "SMTP username" : null,
    !settings.mailServerPassword ? "SMTP password" : null,
    !settings.mailServerFrom ? "From address" : null,
  ].filter(Boolean) as string[]
}

export type { PreferenceEnvironmentVariable, PreferenceSettings }
export type {
  SystemDiagnosticsSnapshot,
  SystemInfoSnapshot,
  UpdateCheckResult,
  UpdaterStateSnapshot,
} from "@/types/preference"
