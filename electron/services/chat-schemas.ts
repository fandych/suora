import { z } from "zod"

const chatToolActivitySchema = z.object({
  id: z.string().min(1),
  toolName: z.string().min(1),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.string().optional(),
  error: z.string().optional(),
  stopped: z.boolean().optional(),
})

const chatAttachmentSchema = z.object({
  id: z.string().min(1),
  sourceKey: z.string().min(1),
  name: z.string().min(1),
  mediaType: z.string().min(1),
  data: z.string().min(1),
  kind: z.enum(["image", "file"]),
  sizeBytes: z.number().finite().nonnegative().optional(),
})

export const chatMessagePartSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("text"),
    content: z.string(),
    isPending: z.boolean().optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("tool"),
    activity: chatToolActivitySchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("attachment"),
    attachment: chatAttachmentSchema,
  }),
])

const chatRuntimeModelSchema = z.object({
  providerId: z.string().min(1),
  providerType: z.string().min(1),
  modelId: z.string().min(1),
  baseUrl: z.string(),
  apiKey: z.string(),
  systemPrompt: z.string(),
})

const proxySettingsSchema = z.object({
  enabled: z.boolean(),
  type: z.enum(["http", "https", "socks5"]),
  host: z.string(),
  port: z.number().finite(),
  username: z.string().optional(),
  password: z.string().optional(),
  rejectUnauthorized: z.boolean().optional(),
  ignoreSslErrors: z.boolean().optional(),
})

const chatRuntimeSettingsPayloadSchema = z.object({
  model: chatRuntimeModelSchema,
  proxy: proxySettingsSchema,
  requestTimeoutMs: z.number().finite().nonnegative().optional(),
  maxSteps: z.number().finite().int().positive().optional(),
})

const storedChatSessionSchema = z.object({
  runtime: chatRuntimeSettingsPayloadSchema.partial().optional(),
  selectedAgentId: z.string().optional(),
})

const chatSettingsStoreSchema = z.object({
  defaultRuntime: chatRuntimeSettingsPayloadSchema.partial().optional(),
  defaultSelectedAgentId: z.string().optional(),
  drafts: z.record(z.string(), z.string()).optional(),
  chats: z.record(z.string(), storedChatSessionSchema).optional(),
})

const appendUserPayloadSchema = z.object({
  chatId: z.string().min(1),
  content: z.string(),
  parts: z.array(chatMessagePartSchema).optional(),
})

const appendAssistantPayloadSchema = z.object({
  chatId: z.string().min(1),
  content: z.string(),
  parts: z.array(chatMessagePartSchema).optional(),
})

const updateMessagePartsPayloadSchema = z.object({
  chatId: z.string().min(1),
  messageId: z.string().min(1),
  parts: z.array(chatMessagePartSchema),
})

const versionedPartsSchema = z.object({
  version: z.number().int().positive(),
  parts: z.array(chatMessagePartSchema),
})

const versionedChatSettingsStoreSchema = z.object({
  version: z.number().int().positive(),
  store: chatSettingsStoreSchema,
})

export const CHAT_MESSAGE_PARTS_VERSION = 2
export const CHAT_SETTINGS_STORE_VERSION = 2

type VersionedPartsEnvelope = z.infer<typeof versionedPartsSchema>
type VersionedChatSettingsEnvelope = z.infer<typeof versionedChatSettingsStoreSchema>

function migrateChatMessagePartsEnvelope(parsed: unknown): VersionedPartsEnvelope | null {
  if (Array.isArray(parsed)) {
    return {
      version: CHAT_MESSAGE_PARTS_VERSION,
      parts: z.array(chatMessagePartSchema).parse(parsed),
    }
  }

  const versioned = versionedPartsSchema.safeParse(parsed)
  if (!versioned.success) {
    return null
  }

  if (versioned.data.version === CHAT_MESSAGE_PARTS_VERSION) {
    return versioned.data
  }

  if (versioned.data.version === 1) {
    return {
      version: CHAT_MESSAGE_PARTS_VERSION,
      parts: versioned.data.parts,
    }
  }

  return null
}

function migrateChatSettingsStoreEnvelope(parsed: unknown): VersionedChatSettingsEnvelope | null {
  const versioned = versionedChatSettingsStoreSchema.safeParse(parsed)
  if (versioned.success) {
    if (versioned.data.version === CHAT_SETTINGS_STORE_VERSION) {
      return versioned.data
    }

    if (versioned.data.version === 1) {
      return {
        version: CHAT_SETTINGS_STORE_VERSION,
        store: versioned.data.store,
      }
    }
  }

  const legacyStore = chatSettingsStoreSchema.safeParse(parsed)
  if (legacyStore.success) {
    return { version: CHAT_SETTINGS_STORE_VERSION, store: legacyStore.data }
  }

  const legacyRuntime = chatRuntimeSettingsPayloadSchema.safeParse(parsed)
  if (legacyRuntime.success) {
    return {
      version: CHAT_SETTINGS_STORE_VERSION,
      store: {
        defaultRuntime: legacyRuntime.data,
        defaultSelectedAgentId: "agent-general-assistant",
        drafts: {},
        chats: {},
      },
    }
  }

  return null
}

export function parseStoredChatMessageParts(value?: string | null) {
  if (!value) {
    return []
  }

  try {
    return migrateChatMessagePartsEnvelope(JSON.parse(value))?.parts ?? []
  } catch {
    return []
  }
}

export function serializeChatMessageParts(parts: z.infer<typeof chatMessagePartSchema>[]) {
  return JSON.stringify({ version: CHAT_MESSAGE_PARTS_VERSION, parts })
}

export function parseAppendUserPayload(payload: unknown) {
  return appendUserPayloadSchema.parse(payload)
}

export function parseAppendAssistantPayload(payload: unknown) {
  return appendAssistantPayloadSchema.parse(payload)
}

export function parseUpdateMessagePartsPayload(payload: unknown) {
  return updateMessagePartsPayloadSchema.parse(payload)
}

export function parseChatSettingsSavePayload(payload: unknown) {
  const runtimeResult = chatRuntimeSettingsPayloadSchema.safeParse(payload)
  if (runtimeResult.success) {
    return runtimeResult.data
  }

  const versionedResult = versionedChatSettingsStoreSchema.safeParse(payload)
  if (versionedResult.success) {
    return versionedResult.data
  }

  return chatSettingsStoreSchema.parse(payload)
}

export function parseStoredChatSettingsStore(value?: string | null) {
  if (!value) {
    return null
  }

  try {
    return migrateChatSettingsStoreEnvelope(JSON.parse(value))
  } catch {
    return null
  }
}

export function serializeChatSettingsStore(store: z.infer<typeof chatSettingsStoreSchema>) {
  return JSON.stringify({ version: CHAT_SETTINGS_STORE_VERSION, store })
}