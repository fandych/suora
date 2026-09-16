import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  source: text("source").notNull().default("custom"),
  summary: text("summary").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
})

export const skillVersions = sqliteTable("skill_versions", {
  id: text("id").primaryKey(),
  skillId: text("skill_id").notNull(),
  major: integer("major").notNull(),
  minor: integer("minor").notNull(),
  isRelease: integer("is_release", { mode: "boolean" }).notNull().default(false),
  filesJson: text("files_json").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
})
