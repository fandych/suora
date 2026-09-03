import { hasSuoraBridge, suoraIpc } from "@/lib/ipc"

export type PreferenceThemeMode = "system" | "light" | "dark"
export type PreferenceLanguage = "zh" | "en"

export type PreferenceSettings = {
  themeMode: PreferenceThemeMode
  language: PreferenceLanguage
  workspaceName: string
  workspacePath: string
  autoSaveConversations: boolean
  autoStartEnabled: boolean
  defaultModelProviderId: string
  chatRequestTimeoutMs: number
  notes: string
}

const DEFAULT_PREFERENCES: PreferenceSettings = {
  themeMode: "system",
  language: "zh",
  workspaceName: "SUORA Workspace",
  workspacePath: "",
  autoSaveConversations: true,
  autoStartEnabled: false,
  defaultModelProviderId: "provider-openai",
  chatRequestTimeoutMs: 0,
  notes: "",
}

const PREFERENCE_STORAGE_KEY = "suora:preference-settings"

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

export function applyPreferenceSettingsToDocument(settings: Pick<PreferenceSettings, "themeMode" | "language">) {
  if (typeof document === "undefined") {
    return
  }

  const root = document.documentElement
  const prefersDark = typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false
  const useDarkMode = settings.themeMode === "dark" || (settings.themeMode === "system" && prefersDark)

  root.classList.toggle("dark", useDarkMode)
  root.lang = settings.language === "zh" ? "zh-CN" : "en"
}

export async function getPreferenceSettings() {
  let raw: string | null = null
  if (hasSuoraBridge()) {
    try {
      raw = await suoraIpc.preferences.get() as string | null
    } catch {
      raw = readBrowserPreferences()
    }
  } else {
    raw = readBrowserPreferences()
  }

  if (!raw) {
    return DEFAULT_PREFERENCES
  }
  try {
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<PreferenceSettings>) }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export async function savePreferenceSettings(settings: PreferenceSettings) {
  const serialized = JSON.stringify(settings)
  if (hasSuoraBridge()) {
    try {
      await suoraIpc.preferences.save(serialized)
    } catch {
      writeBrowserPreferences(serialized)
    }
  } else {
    writeBrowserPreferences(serialized)
  }

  applyPreferenceSettingsToDocument(settings)

  return settings
}