import { describe, expect, it } from "vitest"

import {
  createDefaultPreferenceSettings,
  getCommandBlacklistMatch,
  getFileAccessDecision,
  resolvePreferenceSettings,
  shouldConfirmWorkspaceCommand,
  validateSystemMailSettings,
} from "@/data/domain/preference-settings"

describe("preference settings serialization", () => {
  it("sanitizes persisted JSON into a valid settings payload", () => {
    const resolved = resolvePreferenceSettings(JSON.stringify({
      themeMode: "dark",
      themeAccent: "forest",
      fontScale: "lg",
      language: "en",
      workspaceName: "  Ops Workspace  ",
      fileAccessDirectories: ["src", "", 123],
      commandAllowlist: ["git", " ", 123],
      commandBlacklist: ["rm -rf", " ", null],
      globalEnvironmentVariables: [{ key: " API_KEY ", value: "secret" }, { key: "", value: "ignored" }],
      ignoreSslErrors: true,
    }))

    expect(resolved.workspaceName).toBe("Ops Workspace")
    expect(resolved.themeMode).toBe("dark")
    expect(resolved.themeAccent).toBe("forest")
    expect(resolved.fontScale).toBe("lg")
    expect(resolved.language).toBe("en")
    expect(resolved.fileAccessDirectories).toEqual(["src"])
    expect(resolved.commandAllowlist).toEqual(["git"])
    expect(resolved.commandBlacklist).toEqual(["rm -rf"])
    expect(resolved.globalEnvironmentVariables).toEqual([{ key: "API_KEY", value: "secret" }])
    expect(resolved.ignoreSslErrors).toBe(true)
  })

  it("falls back to defaults for malformed JSON", () => {
    const resolved = resolvePreferenceSettings("not-json")
    expect(resolved).toEqual(createDefaultPreferenceSettings())
  })
})

describe("command confirmation policy", () => {
  it("prompts daily only when the stored confirmation date is stale", () => {
    expect(shouldConfirmWorkspaceCommand("daily", "2026-09-02", "2026-09-03")).toBe(true)
    expect(shouldConfirmWorkspaceCommand("daily", "2026-09-03", "2026-09-03")).toBe(false)
  })

  it("respects always and never modes", () => {
    expect(shouldConfirmWorkspaceCommand("always", "2026-09-03", "2026-09-03")).toBe(true)
    expect(shouldConfirmWorkspaceCommand("never", "2026-09-02", "2026-09-03")).toBe(false)
  })

  it("finds matching command blacklist tokens", () => {
    expect(getCommandBlacklistMatch({ commandBlacklist: ["shutdown", "rm -rf"] }, "pwsh -c shutdown /s /t 0")).toBe("shutdown")
    expect(getCommandBlacklistMatch({ commandBlacklist: ["shutdown"] }, "npm run build")).toBeNull()
  })
})

describe("file access policy", () => {
  it("allows only listed folders in allowlist mode", () => {
    const decision = getFileAccessDecision({ fileAccessPolicy: "allowlist", fileAccessDirectories: ["src", "docs"] }, "src/views/preference")
    const blocked = getFileAccessDecision({ fileAccessPolicy: "allowlist", fileAccessDirectories: ["src", "docs"] }, "electron/ipc")

    expect(decision.allowed).toBe(true)
    expect(decision.matchedRule).toBe("src")
    expect(blocked.allowed).toBe(false)
  })

  it("blocks listed folders in denylist mode and normalizes windows style paths", () => {
    const blocked = getFileAccessDecision({ fileAccessPolicy: "denylist", fileAccessDirectories: ["secrets", "tmp"] }, "secrets\\mail")
    const allowed = getFileAccessDecision({ fileAccessPolicy: "denylist", fileAccessDirectories: ["secrets", "tmp"] }, "src/views")

    expect(blocked.allowed).toBe(false)
    expect(blocked.normalizedPath).toBe("secrets/mail")
    expect(allowed.allowed).toBe(true)
  })
})

describe("mail validation", () => {
  it("reports missing required global SMTP fields when the mail service is enabled", () => {
    expect(validateSystemMailSettings({
      mailServiceEnabled: true,
      mailServerHost: "",
      mailServerPort: 587,
      mailServerUsername: "",
      mailServerPassword: "",
      mailServerFrom: "",
    })).toEqual(["SMTP host", "SMTP username", "SMTP password", "From address"])
  })

  it("accepts a complete global SMTP profile", () => {
    expect(validateSystemMailSettings({
      mailServiceEnabled: true,
      mailServerHost: "smtp.example.com",
      mailServerPort: 587,
      mailServerUsername: "mailer",
      mailServerPassword: "secret",
      mailServerFrom: "ops@example.com",
    })).toEqual([])
  })
})