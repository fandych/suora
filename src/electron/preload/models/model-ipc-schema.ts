import { z } from "zod"
import { entityIdSchema } from "@/electron/preload/system/ipc-input-schemas"

export const providerCreateSchema = z.object({
  title: z.string().trim().max(512).optional(),
  description: z.string().max(4096).optional(),
  providerType: z.string().trim().min(1).max(128).optional(),
  baseUrl: z.string().trim().max(8192).optional(),
  apiKey: z
    .string()
    .max(16 * 1024)
    .optional(),
  modelsJson: z
    .string()
    .max(2 * 1024 * 1024)
    .optional(),
  enabled: z.boolean().optional(),
})
export const providerTypeSchema = z.string().trim().min(1).max(128)
export const providerSaveSchema = z.object({
  id: entityIdSchema,
  title: z.string().trim().max(512),
  description: z.string().max(4096),
  providerType: z.string().trim().min(1).max(128),
  baseUrl: z.string().trim().max(8192),
  apiKey: z.string().max(16 * 1024),
  apiKeyConfigured: z.boolean().optional(),
  modelsJson: z.string().max(2 * 1024 * 1024),
  enabled: z.boolean(),
})
export const providerDiscoverySchema = z.object({
  id: entityIdSchema.optional(),
  providerType: z.string().trim().min(1).max(128),
  baseUrl: z.string().trim().max(8192),
  apiKey: z.string().max(16 * 1024),
  apiKeyConfigured: z.boolean().optional(),
})
