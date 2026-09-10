import { describe, expect, it, vi } from "vitest"

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((value: string) => Buffer.from(`encrypted:${value}`)),
    decryptString: vi.fn((value: Buffer) => value.toString().replace("encrypted:", "")),
  },
}))

import { preserveConfiguredChannelCredentials, protectChannelCredentials, redactChannelCredentials, revealChannelCredentials } from "@electron/channels/channel-credential-serialization"

describe("channel credential serialization", () => {
  it("protects only email password fields", () => {
    const protectedConfig = protectChannelCredentials({
      emailImapPassword: "imap-secret",
      emailSmtpPassword: "smtp-secret",
      webhookSecret: "webhook-secret",
      telegramBotToken: "telegram-token",
      feishuAppSecret: "feishu-secret",
      customAuthValue: "custom-secret",
      customPlatformName: "Custom platform",
    })

    expect(protectedConfig.emailImapPassword).toMatch(/^enc:v1:/)
    expect(protectedConfig.emailSmtpPassword).toMatch(/^enc:v1:/)
    expect(protectedConfig.webhookSecret).toMatch(/^enc:v1:/)
    expect(protectedConfig.telegramBotToken).toMatch(/^enc:v1:/)
    expect(protectedConfig.feishuAppSecret).toMatch(/^enc:v1:/)
    expect(protectedConfig.customAuthValue).toMatch(/^enc:v1:/)
    expect(protectedConfig.customPlatformName).toBe("Custom platform")
  })

  it("reveals legacy and encrypted email passwords", () => {
    const revealed = revealChannelCredentials({
      emailImapPassword: "legacy-imap",
      emailSmtpPassword: "enc:v1:ZW5jcnlwdGVkOnN0b3JlZA==",
    })

    expect(revealed.emailImapPassword).toBe("legacy-imap")
    expect(revealed.emailSmtpPassword).toBe("stored")
  })

  it("redacts secrets while preserving configured state", () => {
    const redacted = redactChannelCredentials({ telegramBotToken: "telegram-secret", title: "Telegram" })
    expect(redacted.telegramBotToken).toBe("")
    expect(redacted.telegramBotTokenConfigured).toBe(true)
    expect(redacted.title).toBe("Telegram")
  })

  it("preserves an existing secret when a redacted form is saved", () => {
    const merged = preserveConfiguredChannelCredentials(
      { telegramBotToken: "", title: "Telegram" },
      { telegramBotToken: "existing-secret" },
    )
    expect(merged.telegramBotToken).toBe("existing-secret")
  })
})
