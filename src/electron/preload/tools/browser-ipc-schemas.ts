import { z } from "zod"

const sessionId = z.string().trim().min(1).max(128).optional()
const selector = z.string().trim().min(1).max(4096)
export const browserNavigateSchema = z.object({
  sessionId,
  url: z.string().trim().url().max(8192).optional(),
  visible: z.boolean().optional(),
})
export const browserStateSchema = z.string().trim().min(1).max(128).optional()
export const browserPageSchema = z.object({
  sessionId,
  includeText: z.boolean().optional(),
  includeLinks: z.boolean().optional(),
})
export const browserClickSchema = z.object({ sessionId, selector })
export const browserFillSchema = z.object({ sessionId, selector, value: z.string().max(256 * 1024) })
export function parseBrowserInput<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value)
  if (!result.success) throw new Error("Invalid browser tool payload.")
  return result.data
}
