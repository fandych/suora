import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  summary: text("summary").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
})

export const agentVersions = sqliteTable("agent_versions", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  major: integer("major").notNull(),
  minor: integer("minor").notNull(),
  isRelease: integer("is_release", { mode: "boolean" }).notNull().default(false),
  configJson: text("config_json").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
})
