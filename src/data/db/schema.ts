import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  chatbotId: text("chatbot_id").notNull(),
  summary: text("summary").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  summary: text("summary").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const agentVersions = sqliteTable("agent_versions", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  major: integer("major").notNull(),
  minor: integer("minor").notNull(),
  isRelease: integer("is_release", { mode: "boolean" }).notNull().default(false),
  configJson: text("config_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const workflowVersions = sqliteTable("workflow_versions", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull(),
  major: integer("major").notNull(),
  minor: integer("minor").notNull(),
  isRelease: integer("is_release", { mode: "boolean" }).notNull().default(false),
  definitionJson: text("definition_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const workflowInvocations = sqliteTable("workflow_invocations", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull(),
  versionId: text("version_id").notNull(),
  status: text("status").notNull(),
  trigger: text("trigger").notNull(),
  inputJson: text("input_json").notNull(),
  outputJson: text("output_json").notNull(),
  traceJson: text("trace_json").notNull().default("[]"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  source: text("source").notNull().default("custom"),
  summary: text("summary").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const providers = sqliteTable("providers", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  providerType: text("provider_type").notNull(),
  baseUrl: text("base_url").notNull().default(""),
  apiKey: text("api_key").notNull().default(""),
  modelsJson: text("models_json").notNull().default("[]"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const skillVersions = sqliteTable("skill_versions", {
  id: text("id").primaryKey(),
  skillId: text("skill_id").notNull(),
  major: integer("major").notNull(),
  minor: integer("minor").notNull(),
  isRelease: integer("is_release", { mode: "boolean" }).notNull().default(false),
  filesJson: text("files_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  endpoint: text("endpoint").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const integrationVersions = sqliteTable("integration_versions", {
  id: text("id").primaryKey(),
  integrationId: text("integration_id").notNull(),
  major: integer("major").notNull(),
  minor: integer("minor").notNull(),
  isRelease: integer("is_release", { mode: "boolean" }).notNull().default(false),
  configJson: text("config_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const integrationExecutions = sqliteTable("integration_executions", {
  id: text("id").primaryKey(),
  integrationId: text("integration_id").notNull(),
  versionId: text("version_id").notNull(),
  status: text("status").notNull(),
  inputJson: text("input_json").notNull(),
  outputJson: text("output_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const schedulers = sqliteTable("schedulers", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  schedule: text("schedule").notNull().default(""),
  timeZone: text("time_zone").notNull().default("Asia/Shanghai"),
  targetType: text("target_type").notNull().default("workflow"),
  targetId: text("target_id").notNull().default(""),
  targetName: text("target_name").notNull().default(""),
  missedRunPolicy: text("missed_run_policy").notNull().default("skip"),
  retryLimit: integer("retry_limit").notNull().default(0),
  retryBackoffSeconds: integer("retry_backoff_seconds").notNull().default(300),
  inputPayloadJson: text("input_payload_json").notNull().default("{}"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const channels = sqliteTable("channels", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  platform: text("platform").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
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
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
})

export const schema = {
  chats,
  chatMessages,
  workflows,
  agents,
  agentVersions,
  workflowVersions,
  workflowInvocations,
  skills,
  providers,
  skillVersions,
  documents,
  integrations,
  integrationVersions,
  integrationExecutions,
  schedulers,
  channels,
  documentVersions,
  appMeta,
}