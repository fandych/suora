import { ipcMain } from "electron"
import { getDrizzleDatabase } from "@/drizzle/db"
import { appMeta } from "@/drizzle/schema"
import { eq } from "drizzle-orm"

async function pingDrizzle() {
  await getDrizzleDatabase()
    .select({ value: appMeta.value })
    .from(appMeta)
    .where(eq(appMeta.key, "app_version"))
    .limit(1)
  return { value: 1 }
}

export function registerDatabaseIpc() {
  ipcMain.handle("database:ping", () => pingDrizzle())
}
