import { z } from "zod"

export const entityIdSchema = z.string().trim().min(1).max(256)
export const agentListSchema = z
  .object({
    source: z.enum(["custom", "system"]).optional(),
    title: z.string().trim().max(512).optional(),
    isDisabled: z.boolean().optional(),
  })
  .optional()
export const mailPayloadSchema = z.object({
  to: z.string().trim().email().max(2048),
  subject: z.string().max(2048),
  content: z.string().max(2 * 1024 * 1024),
  html: z
    .string()
    .max(4 * 1024 * 1024)
    .optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string().max(255).optional(),
        content: z
          .string()
          .max(2 * 1024 * 1024)
          .optional(),
        dataBase64: z
          .string()
          .max(16 * 1024 * 1024)
          .optional(),
        path: z.string().max(4096).optional(),
        href: z.string().url().max(8192).optional(),
        contentType: z.string().max(256).optional(),
        cid: z.string().max(512).optional(),
        encoding: z.enum(["base64", "hex", "binary", "quoted-printable"]).optional(),
      }),
    )
    .max(20)
    .optional(),
})
export const providerCreateSchema = z.object({
  title: z.string().trim().max(512).optional(),
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
  providerType: z.string().trim().min(1).max(128),
  baseUrl: z.string().trim().max(8192),
  apiKey: z.string().max(16 * 1024),
  modelsJson: z.string().max(2 * 1024 * 1024),
  enabled: z.boolean(),
})
export const providerDiscoverySchema = z.object({
  providerType: z.string().trim().min(1).max(128),
  baseUrl: z.string().trim().max(8192),
  apiKey: z.string().max(16 * 1024),
})
export const versionedResourceSaveSchema = z.object({
  id: entityIdSchema,
  title: z.string().trim().max(512),
  kind: z.string().trim().max(128).optional(),
  source: z.string().trim().max(128).optional(),
  summary: z.string().max(64 * 1024),
  configJson: z
    .string()
    .max(8 * 1024 * 1024)
    .optional(),
  filesJson: z
    .string()
    .max(16 * 1024 * 1024)
    .optional(),
  selectedVersionId: entityIdSchema.optional(),
  publish: z.boolean().optional(),
})
export function parseIpcInput<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value)
  if (!result.success) throw new Error("Invalid IPC payload.")
  return result.data
}
