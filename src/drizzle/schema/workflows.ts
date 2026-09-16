import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
})

export const workflowVersions = sqliteTable("workflow_versions", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull(),
  major: integer("major").notNull(),
  minor: integer("minor").notNull(),
  isRelease: integer("is_release", { mode: "boolean" }).notNull().default(false),
  definitionJson: text("definition_json").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
})

export const workflowInvocations = sqliteTable("workflow_invocations", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull(),
  versionId: text("version_id").notNull(),
  status: text("status").notNull(),
  trigger: text("trigger").notNull(),
  inputJson: text("input_json"),
  outputJson: text("output_json"),
  traceJson: text("trace_json"),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
})
