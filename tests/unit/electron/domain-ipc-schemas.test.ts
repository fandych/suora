import { describe, expect, it } from "vitest"

import { mailPayloadSchema, parseIpcInput, providerSaveSchema } from "@/electron/preload/system/ipc-input-schemas"
import { documentSaveSchema } from "@/electron/preload/documents/document-ipc-schemas"

describe("domain IPC schemas", () => {
  it("accepts bounded provider payloads", () => {
    expect(
      parseIpcInput(providerSaveSchema, {
        id: "provider-1",
        title: "OpenAI",
        providerType: "openai",
        baseUrl: "https://api.example.com",
        apiKey: "key",
        modelsJson: "[]",
        enabled: true,
      }),
    ).toMatchObject({ id: "provider-1" })
  })

  it("rejects oversized document JSON", () => {
    expect(() =>
      parseIpcInput(documentSaveSchema, {
        id: "doc-1",
        title: "Doc",
        summary: "",
        enabled: true,
        structureJson: "x".repeat(16 * 1024 * 1024 + 1),
        graphJson: "{}",
        settingsJson: "{}",
      }),
    ).toThrow(/Invalid IPC payload/)
  })

  it("requires a valid recipient for mail", () => {
    expect(
      parseIpcInput(mailPayloadSchema, { to: "user@example.com", subject: "Hello", content: "Body" }),
    ).toMatchObject({ to: "user@example.com" })
    expect(() => parseIpcInput(mailPayloadSchema, { to: "not-an-email", subject: "Hello", content: "Body" })).toThrow(
      /Invalid IPC payload/,
    )
  })
})
