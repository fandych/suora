import { z } from "zod"
import { entityIdSchema } from "@/electron/preload/system/ipc-input-schemas"

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

const chatRuntimeModelSchema = z.object({
  providerId: z.string().min(1).max(256),
  providerType: z.string().min(1).max(128),
  modelId: z.string().min(1).max(256),
  baseUrl: z.string().max(2_048),
  apiKey: z.string().max(16_384),
  systemPrompt: z.string().max(64 * 1024),
})

const chatRuntimeProxySchema = z.object({
  enabled: z.boolean(),
  type: z.enum(["http", "https", "socks5"]),
  host: z.string().max(512),
  port: z.number().finite().min(0).max(65_535),
  username: z.string().max(1_024).optional(),
  password: z.string().max(16_384).optional(),
  rejectUnauthorized: z.boolean().optional(),
  ignoreSslErrors: z.boolean().optional(),
})

export const chatSessionSettingsSchema = z.object({
  chatId: entityIdSchema.nullable().optional(),
  runtime: z.object({
    model: chatRuntimeModelSchema,
    proxy: chatRuntimeProxySchema,
    requestTimeoutMs: z.number().finite().min(0).max(300_000),
    maxSteps: z.number().finite().int().min(1).max(100),
  }),
  selectedAgentId: z.string().trim().max(256),
})
