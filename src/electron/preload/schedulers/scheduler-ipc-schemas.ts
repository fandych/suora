import { z } from "zod"

export const schedulerIdSchema = z.string().trim().min(1).max(256)

export const schedulerSaveSchema = z.object({
  id: schedulerIdSchema,
  title: z.string().trim().max(512),
  description: z.string().max(64 * 1024),
  enabled: z.boolean(),
  schedule: z.string().trim().min(1).max(256),
  timeZone: z.string().trim().max(128),
  targetType: z.string().trim().max(128),
  targetId: z.string().max(256),
  targetName: z.string().max(512),
  missedRunPolicy: z.string().trim().max(64),
  retryLimit: z.number().int().min(0).max(20),
  retryBackoffSeconds: z.number().int().min(0).max(86400),
  inputPayloadJson: z.string().max(2 * 1024 * 1024),
})

export const schedulerEnabledSchema = z.object({
  id: schedulerIdSchema,
  enabled: z.boolean(),
})
