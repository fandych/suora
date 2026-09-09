export type {
  PreferenceCommandConfirmationMode,
  PreferenceEnvironmentVariable,
  PreferenceFileAccessPolicy,
  PreferenceFontScale,
  PreferenceLanguage,
  PreferenceSettings,
  PreferenceThemeAccent,
  PreferenceThemeMode,
} from "@/data/domain/preference-settings"
export {
  COMMAND_CONFIRMATION_STORAGE_KEY,
  createDefaultPreferenceSettings,
  getCommandBlacklistMatch,
  getFileAccessDecision,
  getTodayPreferenceDateKey,
  resolvePreferenceSettings,
  sanitizePreferenceSettings,
  shouldConfirmWorkspaceCommand,
  validateSystemMailSettings,
} from "@/data/domain/preference-settings"

import type { PreferenceSettings } from "@/data/domain/preference-settings"
import { FONT_SCALE_MAP, PREFERENCE_STORAGE_KEY, THEME_ACCENTS, resolvePreferenceSettings, sanitizePreferenceSettings } from "@/data/domain/preference-settings"
import { hasProjectBridge, projectIpc } from "@/lib/ipc"

function readBrowserPreferences() {
  if (typeof window === "undefined") {
    return null
  }

  return window.localStorage.getItem(PREFERENCE_STORAGE_KEY)
}

function writeBrowserPreferences(value: string) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(PREFERENCE_STORAGE_KEY, value)
}

export function applyPreferenceSettingsToDocument(settings: Pick<PreferenceSettings, "themeMode" | "themeAccent" | "fontScale" | "language">) {
  if (typeof document === "undefined") {
    return
  }

  const root = document.documentElement
  const prefersDark = typeof window !== "undefined" && typeof window.matchMedia === "function"
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

export async function getPreferenceSettings() {
  if (hasProjectBridge()) {
    try {
      return resolvePreferenceSettings(await projectIpc.preferences.get() as string | null)
    } catch {
      return resolvePreferenceSettings(readBrowserPreferences())
    }
  }

  return resolvePreferenceSettings(readBrowserPreferences())
}

export async function savePreferenceSettings(settings: PreferenceSettings) {
  const normalized = sanitizePreferenceSettings(settings)
  const serialized = JSON.stringify(normalized)
  if (hasProjectBridge()) {
    try {
      await projectIpc.preferences.save(serialized)
    } catch {
      writeBrowserPreferences(serialized)
    }
  } else {
    writeBrowserPreferences(serialized)
  }

  applyPreferenceSettingsToDocument(normalized)

  return normalized
}