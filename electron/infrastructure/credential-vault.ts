import { safeStorage } from "electron"

const ENCRYPTED_PREFIX = "enc:v1:"

export function protectCredential(value: string) {
  if (!value) return ""
  if (value.startsWith(ENCRYPTED_PREFIX)) return value
  if (!safeStorage.isEncryptionAvailable()) {
    return value
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
