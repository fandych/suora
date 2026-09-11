import { ipcMain } from "electron"
import { z } from "zod"
import { syncChannelCatalogWithDrizzle } from "@electron/database/drizzle/channel-catalog-repository"

const timestampSchema = z.union([z.number(), z.date()]).transform((value) => value instanceof Date ? value.getTime() : value)
const syncSchema = z.object({ renamed: z.array(z.object({ id: z.string().min(1).max(256), title: z.string().max(512) })).max(100), channels: z.array(z.object({ id: z.string().min(1).max(256), title: z.string().max(512), platform: z.string().max(128), enabled: z.boolean(), status: z.string().max(64), connectionMode: z.string().max(64), webhookPath: z.string().max(4096), webhookSecret: z.string().max(4096), autoReply: z.boolean(), replyAgentId: z.string().max(256), createdAt: timestampSchema, configJson: z.string().max(16 * 1024 * 1024), runtimeJson: z.string().max(16 * 1024 * 1024), updatedAt: timestampSchema })).max(100) })
export function registerDomainChannelCatalogIpc() { ipcMain.handle("database:syncChannelCatalog", (_event, value: unknown) => syncChannelCatalogWithDrizzle(syncSchema.parse(value))) }
