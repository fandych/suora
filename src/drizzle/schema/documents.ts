import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
})

export const documentVersions = sqliteTable("document_versions", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  major: integer("major").notNull(),
  minor: integer("minor").notNull(),
  isRelease: integer("is_release", { mode: "boolean" }).notNull().default(false),
  structureJson: text("structure_json").notNull(),
  graphJson: text("graph_json").notNull(),
  settingsJson: text("settings_json").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
})
