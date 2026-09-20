import { safeStorage } from "electron"

const ENCRYPTED_PREFIX = "enc:v1:"
const UNAVAILABLE_MESSAGE = "OS secure storage is unavailable, so credentials cannot be stored safely."

export type RevealedCredentialState = {
  value: string
  legacyPlaintext: boolean
}

export function protectCredential(value: string) {
  if (!value) return ""
  if (value.startsWith(ENCRYPTED_PREFIX)) return value
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(UNAVAILABLE_MESSAGE)
  }
  return `${ENCRYPTED_PREFIX}${safeStorage.encryptString(value).toString("base64")}`
}

export function revealCredential(value: unknown) {
  if (typeof value !== "string" || !value) return ""
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Encrypted credentials cannot be read because OS secure storage is unavailable.")
  }
  try {
    return safeStorage.decryptString(Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64"))
  } catch {
    throw new Error("Stored credential could not be decrypted.")
  }
}

export function revealCredentialState(value: unknown): RevealedCredentialState {
  if (typeof value !== "string" || !value) return { value: "", legacyPlaintext: false }
  if (!value.startsWith(ENCRYPTED_PREFIX)) return { value, legacyPlaintext: true }
  return { value: revealCredential(value), legacyPlaintext: false }
}
