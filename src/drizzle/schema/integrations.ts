import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(), title: text("title").notNull(), kind: text("kind").notNull(), endpoint: text("endpoint").notNull().default(""), enabled: integer("enabled", { mode: "boolean" }).notNull().default(true), updatedAt: integer("updated_at", { mode: "number" }).notNull(),
})

export const integrationVersions = sqliteTable("integration_versions", {
  id: text("id").primaryKey(), integrationId: text("integration_id").notNull(), major: integer("major").notNull(), minor: integer("minor").notNull(), isRelease: integer("is_release", { mode: "boolean" }).notNull().default(false), configJson: text("config_json").notNull(), createdAt: integer("created_at", { mode: "number" }).notNull(),
})

export const integrationExecutions = sqliteTable("integration_executions", {
  id: text("id").primaryKey(), integrationId: text("integration_id").notNull(), versionId: text("version_id").notNull(), status: text("status").notNull(), inputJson: text("input_json").notNull(), outputJson: text("output_json").notNull(), createdAt: integer("created_at", { mode: "number" }).notNull(),
})
