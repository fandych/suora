import { z } from "zod"
import { chatMessagePartSchema } from "@/electron/app/chats/chat-schemas"

const sourceTypeSchema = z.enum(["manual", "channel"]).optional()

export const chatSnapshotSchema = z.object({
  chat: z.object({
    id: z.string().min(1),
    title: z.string(),
    chatbotId: z.string(),
    summary: z.string(),
    updatedAt: z.number().finite(),
    sourceType: sourceTypeSchema,
    sourceRef: z.string().nullable().optional(),
  }),
  messages: z.array(
    z.object({
      id: z.string().min(1),
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
      createdAt: z.number().finite(),
      parts: z.array(chatMessagePartSchema).optional(),
    }),
  ),
  nextCursor: z
    .object({
      createdAt: z.number().finite().positive(),
      id: z.string().min(1),
    })
    .nullable()
    .optional(),
})

export const documentSnapshotSchema = z.object({
  document: z.object({
    id: z.string().min(1),
    title: z.string(),
    summary: z.string(),
    enabled: z.boolean(),
    updatedAt: z.number().finite(),
  }),
  versions: z.array(
    z.object({
      id: z.string().min(1),
      major: z.number().int(),
      minor: z.number().int(),
      isRelease: z.boolean(),
      createdAt: z.number().finite(),
      structureJson: z.string(),
      graphJson: z.string(),
      settingsJson: z.string(),
    }),
  ),
  selectedVersionId: z.string().nullable(),
})

export const workflowSnapshotSchema = z.object({
  workflow: z.object({
    id: z.string().min(1),
    title: z.string(),
    summary: z.string(),
    enabled: z.boolean(),
    updatedAt: z.number().finite(),
  }),
  versions: z.array(
    z.object({
      id: z.string().min(1),
      workflowId: z.string().min(1),
      major: z.number().int(),
      minor: z.number().int(),
      isRelease: z.boolean(),
      definitionJson: z.string(),
      createdAt: z.number().finite(),
    }),
  ),
  invocations: z.array(
    z.object({
      id: z.string().min(1),
      workflowId: z.string().min(1),
      versionId: z.string().min(1),
      status: z.string(),
      trigger: z.string(),
      inputJson: z.string(),
      outputJson: z.string(),
      traceJson: z.string(),
      createdAt: z.number().finite(),
    }),
  ),
})