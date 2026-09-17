import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  source: text("source").notNull().default("custom"),
  summary: text("summary").notNull().default(""),
  filesJson: text("files_json").notNull().default("[]"),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
})

