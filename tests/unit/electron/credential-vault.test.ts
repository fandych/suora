import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(),
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
}))

import { protectCredential, revealCredential } from "@electron/others/infrastructure/credential-vault"
import { safeStorage } from "electron"

describe("credential vault", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    safeStorage.isEncryptionAvailable.mockReturnValue(true)
    safeStorage.encryptString.mockReturnValue(Buffer.from("encrypted"))
    safeStorage.decryptString.mockReturnValue("secret")
  })

  it("encrypts credentials when OS secure storage is available", () => {
    const stored = protectCredential("secret")
    expect(stored).toBe("enc:v1:ZW5jcnlwdGVk")
    expect(revealCredential(stored)).toBe("secret")
  })

  it("keeps legacy plaintext readable for migration", () => {
    expect(revealCredential("legacy-secret")).toBe("legacy-secret")
    expect(safeStorage.decryptString).not.toHaveBeenCalled()
  })

  it("falls back to plaintext when secure storage is unavailable", () => {
    safeStorage.isEncryptionAvailable.mockReturnValue(false)
    expect(protectCredential("secret")).toBe("secret")
    expect(() => revealCredential("enc:v1:ZW5jcnlwdGVk")).toThrow(/secure storage is unavailable/)
  })
})
