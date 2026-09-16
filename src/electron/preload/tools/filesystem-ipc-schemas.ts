import { z } from "zod"

export const relativePathSchema = z.string().trim().max(4096).default(".")
export const readPathSchema = z.string().trim().min(1).max(4096)
export const writeFileSchema = z.object({ path: readPathSchema, content: z.string().max(1024 * 1024) })
export const saveFileSchema = z.object({
  defaultName: z.string().trim().min(1).max(255),
  filters: z
    .array(z.object({ name: z.string().max(100), extensions: z.array(z.string().max(32)).max(20) }))
    .max(20)
    .optional(),
  dataBase64: z.string().max(16 * 1024 * 1024),
})
export function parseFilesystemInput<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value)
  if (!result.success) throw new Error("Invalid filesystem tool payload.")
  return result.data
}
