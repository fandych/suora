import { z } from "zod"
import { entityIdSchema } from "@/electron/preload/system/ipc-input-schemas"
import { chatRuntimeModelSchema, chatRuntimeSettingsPayloadSchema, proxySettingsSchema } from "@/electron/app/chats/chat-schemas"

export const chatGetSchema = z.union([
  entityIdSchema,
  z.object({
    chatId: entityIdSchema,
    limit: z.number().finite().int().min(1).max(500).optional(),
    beforeCreatedAt: z.number().finite().int().positive().optional(),
  }),
])

export const chatEnsureSchema = z.object({
  chatId: entityIdSchema,
  title: z.string().trim().max(512),
  chatbotId: entityIdSchema,
  summary: z
    .string()
    .max(64 * 1024)
    .optional(),
  sourceType: z.enum(["manual", "channel"]).optional(),
  sourceRef: z.string().max(512).nullable().optional(),
})

export const chatSessionSettingsSchema = z.object({
  chatId: entityIdSchema.nullable().optional(),
  runtime: chatRuntimeSettingsPayloadSchema.extend({
    model: chatRuntimeModelSchema,
    proxy: proxySettingsSchema.extend({
      username: z.string().max(1_024).default(""),
      password: z.string().max(16_384).default(""),
      rejectUnauthorized: z.boolean().default(true),
      ignoreSslErrors: z.boolean().default(false),
    }),
    requestTimeoutMs: z.number().finite().min(0).max(300_000),
    maxSteps: z.number().finite().int().min(1).max(500),
  }),
  selectedAgentId: z.string().trim().max(256),
})
