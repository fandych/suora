import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const providers = sqliteTable("providers", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  providerType: text("provider_type").notNull(),
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key").notNull(),
  modelsJson: text("models_json").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
})
