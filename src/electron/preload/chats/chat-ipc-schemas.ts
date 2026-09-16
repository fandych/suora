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
