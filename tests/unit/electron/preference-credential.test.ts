import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn(() => Buffer.from("encrypted")),
    decryptString: vi.fn(() => "smtp-secret"),
  },
}))

import { protectCredential, revealCredential } from "@electron/others/infrastructure/credential-vault"

describe("preference credential compatibility", () => {
  beforeEach(() => vi.clearAllMocks())

  it("round-trips an SMTP password without exposing the stored value", () => {
    const encrypted = protectCredential("smtp-secret")
    expect(encrypted).toMatch(/^enc:v1:/)
    expect(encrypted).not.toContain("smtp-secret")
    expect(revealCredential(encrypted)).toBe("smtp-secret")
  })

  it("keeps legacy preference passwords readable", () => {
    expect(revealCredential("legacy-smtp-secret")).toBe("legacy-smtp-secret")
  })
})
