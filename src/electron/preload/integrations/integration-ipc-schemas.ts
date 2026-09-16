import { z } from "zod"

export const integrationIdSchema = z.string().trim().min(1).max(256)
export const integrationExecuteSchema = z.object({
  integrationId: integrationIdSchema.optional(),
  kind: z.enum(["http", "scripts", "mcp"]),
  config: z.record(z.string(), z.unknown()),
  inputJson: z
    .string()
    .max(2 * 1024 * 1024)
    .optional(),
})
export const integrationSaveSchema = z.object({
  id: integrationIdSchema,
  title: z.string().trim().max(512),
  kind: z.string().trim().min(1).max(128),
  endpoint: z.string().max(8192),
  configJson: z.string().max(16 * 1024 * 1024),
  enabled: z.boolean().optional(),
  selectedVersionId: integrationIdSchema.optional(),
  publish: z.boolean().optional(),
})
export const integrationCreateSchema = z.object({
  kind: z.string().trim().min(1).max(128).optional(),
  title: z.string().trim().max(512).optional(),
  endpoint: z.string().max(8192).optional(),
  configJson: z
    .string()
    .max(16 * 1024 * 1024)
    .optional(),
})
export const integrationEnabledSchema = z.object({ id: integrationIdSchema, enabled: z.boolean() })
export const integrationExecutionRecordSchema = z.object({
  id: integrationIdSchema,
  versionId: integrationIdSchema,
  status: z.string().max(64),
  input: z.string().max(2 * 1024 * 1024),
  output: z.string().max(8 * 1024 * 1024),
})
