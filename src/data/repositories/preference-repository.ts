import { suoraIpc } from "@/lib/ipc"

export type PreferenceSettings = {
  workspaceName: string
  defaultModelProviderId: string
  notes: string
}

const DEFAULT_PREFERENCES: PreferenceSettings = {
  workspaceName: "SUORA Workspace",
  defaultModelProviderId: "provider-openai",
  notes: "",
}

export async function getPreferenceSettings() {
  const raw = await suoraIpc.preferences.get() as string | null
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
  await suoraIpc.preferences.save(JSON.stringify(settings))
  return settings
}