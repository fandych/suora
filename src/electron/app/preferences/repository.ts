import { protectCredential, revealCredential } from "@/electron/infrastructure/credential-vault"
import { getAppMetaValue, setAppMetaValue } from "@/electron/app/system/system-repository"

export async function getPreferenceValue() {
  const value = await getAppMetaValue("preference_settings")
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (typeof parsed.mailServerPassword === "string") {
      parsed.mailServerPasswordConfigured = Boolean(revealCredential(parsed.mailServerPassword))
      parsed.mailServerPassword = ""
    }
    return JSON.stringify(parsed)
  } catch {
    return value
  }
}

export async function setPreferenceValue(value: string) {
  const parsed = JSON.parse(value) as Record<string, unknown>
  const currentValue = await getAppMetaValue("preference_settings")
  const current = currentValue ? (JSON.parse(currentValue) as Record<string, unknown>) : {}
  if (typeof parsed.mailServerPassword === "string") {
    parsed.mailServerPassword = parsed.mailServerPassword
      ? protectCredential(parsed.mailServerPassword)
      : typeof current.mailServerPassword === "string"
        ? current.mailServerPassword
        : ""
  }
  delete parsed.mailServerPasswordConfigured
  await setAppMetaValue("preference_settings", JSON.stringify(parsed))
}
