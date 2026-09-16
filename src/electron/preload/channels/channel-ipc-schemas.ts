import { z } from "zod"

const identifier = z.string().trim().min(1).max(256)
const message = z
  .string()
  .trim()
  .min(1)
  .max(256 * 1024)
const safeHttpUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol
      return protocol === "http:" || protocol === "https:"
    } catch {
      return false
    }
  }, "Only HTTP and HTTPS URLs are allowed.")

export const channelIdSchema = identifier
export const channelUrlSchema = safeHttpUrl
export const channelPreviewOptionsSchema = z.object({
  url: safeHttpUrl,
  waitMs: z.number().int().min(0).max(5_000).optional().default(0),
})

export const channelMessageSchema = z.object({
  channelId: identifier,
  chatId: identifier,
  content: message,
})

export const channelDebugMessageSchema = z.object({
  channelId: identifier,
  content: message,
})

export const wechatLoginStartSchema = z.object({
  channelId: identifier.optional(),
  force: z.boolean().optional().default(false),
})

export const wechatLoginWaitSchema = z.object({
  channelId: identifier.optional(),
  sessionKey: identifier.max(4096),
  verifyCode: z.string().trim().max(128).optional(),
  timeoutMs: z.number().int().min(1_000).max(120_000).optional().default(35_000),
})

export function parseChannelIpcInput<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new Error("Invalid channel IPC payload.")
  }
  return result.data
}
