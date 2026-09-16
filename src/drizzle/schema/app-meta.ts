import { sqliteTable, text } from "drizzle-orm/sqlite-core"

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
})
