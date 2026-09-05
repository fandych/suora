import { describe, expect, it } from "vitest"

import { CHAT_MESSAGE_PARTS_VERSION, CHAT_SETTINGS_STORE_VERSION, parseVersionedChatMessageParts, parseVersionedChatSettingsStore, serializeVersionedChatMessageParts, serializeVersionedChatSettingsStore } from "@/services/chat-persistence-migrations"

describe("chat persistence migrations", () => {
  it("migrates legacy and version 1 message parts payloads to the current versioned reader", () => {
    const legacy = parseVersionedChatMessageParts(JSON.stringify([
      { id: "text-1", type: "text", content: "legacy" },
    ]))
    const version1 = parseVersionedChatMessageParts(JSON.stringify({
      version: 1,
      parts: [{ id: "text-1", type: "text", content: "v1" }],
    }))
    const version2 = parseVersionedChatMessageParts(serializeVersionedChatMessageParts([
      { id: "text-1", type: "text", content: "v2" },
    ]))

    expect(legacy[0]?.type === "text" ? legacy[0].content : null).toBe("legacy")
    expect(version1[0]?.type === "text" ? version1[0].content : null).toBe("v1")
    expect(version2[0]?.type === "text" ? version2[0].content : null).toBe("v2")
    expect(CHAT_MESSAGE_PARTS_VERSION).toBe(2)
  })

  it("migrates legacy, version 1, and version 2 chat settings stores", () => {
    const legacyRuntime = parseVersionedChatSettingsStore(JSON.stringify({
      model: {
        providerId: "provider-openai",
        providerType: "openai",
        modelId: "gpt-5",
        baseUrl: "",
        apiKey: "",
        systemPrompt: "legacy",
      },
      proxy: {
        enabled: false,
        type: "http",
        host: "",
        port: 0,
      },
    }))
    const version1Store = parseVersionedChatSettingsStore(JSON.stringify({
      version: 1,
      store: {
        drafts: { a: "b" },
        chats: {},
      },
    }))
    const version2Store = parseVersionedChatSettingsStore(serializeVersionedChatSettingsStore({
      drafts: { c: "d" },
      chats: {},
    }))

    expect(legacyRuntime?.version).toBe(CHAT_SETTINGS_STORE_VERSION)
    expect(version1Store?.version).toBe(CHAT_SETTINGS_STORE_VERSION)
    expect(version2Store?.version).toBe(CHAT_SETTINGS_STORE_VERSION)
    expect(CHAT_SETTINGS_STORE_VERSION).toBe(2)
  })
})
