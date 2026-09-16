import { z } from "zod"

export const documentSaveSchema = z.object({
  id: z.string().trim().min(1).max(256),
  title: z.string().trim().max(512),
  summary: z.string().max(64 * 1024),
  enabled: z.boolean(),
  structureJson: z.string().max(16 * 1024 * 1024),
  graphJson: z.string().max(8 * 1024 * 1024),
  settingsJson: z.string().max(512 * 1024),
  selectedVersionId: z.string().trim().min(1).max(256).optional(),
  publish: z.boolean().optional(),
})

export const documentMetadataSchema = z.object({
  title: z.string().trim().min(1).max(512),
  summary: z.string().max(64 * 1024),
})
