import { protectCredential, revealCredentialState } from "@/electron/infrastructure/credential-vault"
import { getAppMetaValue, setAppMetaValue } from "@/electron/app/system/system-repository"

export async function getPreferenceValue() {
  const value = await getAppMetaValue("preference_settings")
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (typeof parsed.mailServerPassword === "string") {
      const credential = revealCredentialState(parsed.mailServerPassword)
      parsed.mailServerPasswordConfigured = Boolean(credential.value)
      if (credential.legacyPlaintext && credential.value) {
        void setPreferenceValue(JSON.stringify({ ...parsed, mailServerPassword: credential.value }))
      }
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
