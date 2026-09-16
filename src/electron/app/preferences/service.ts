import { sanitizePreferenceSettings } from "@/electron/app/preferences/settings"
import { getPreferenceValue, setPreferenceValue } from "@/electron/app/preferences/repository"

export const preferenceService = {
  get: () => getPreferenceValue(),
  async save(value: string) {
    const parsed = JSON.parse(value) as unknown
    const settings = sanitizePreferenceSettings(
      parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined,
    )
    const serialized = JSON.stringify(settings)
    await setPreferenceValue(serialized)
    return serialized
  },
}
