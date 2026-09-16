import { z } from "zod"
import { entityIdSchema } from "@/electron/preload/system/ipc-input-schemas"

export const workflowSaveSchema = z.object({
  id: entityIdSchema,
  title: z.string().trim().max(512),
  summary: z.string().max(64 * 1024),
  definitionJson: z.string().max(16 * 1024 * 1024),
  selectedVersionId: entityIdSchema.optional(),
  publish: z.boolean().optional(),
})

export const workflowInvocationSchema = z.object({
  workflowId: entityIdSchema,
  versionId: entityIdSchema,
  status: z.string().max(64),
  trigger: z.string().max(64),
  input: z.string().max(2 * 1024 * 1024),
  output: z.string().max(8 * 1024 * 1024),
  traceJson: z.string().max(16 * 1024 * 1024),
})
