import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
})

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

export const providers = sqliteTable("providers", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  providerType: text("provider_type").notNull(),
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key").notNull(),
  modelsJson: text("models_json").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
})

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

export const schedulers = sqliteTable("schedulers", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  schedule: text("schedule").notNull(),
  timeZone: text("time_zone").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  targetName: text("target_name").notNull(),
  missedRunPolicy: text("missed_run_policy").notNull(),
  retryLimit: integer("retry_limit").notNull(),
  retryBackoffSeconds: integer("retry_backoff_seconds").notNull(),
  inputPayloadJson: text("input_payload_json").notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
})

export const schedulerRuns = sqliteTable("scheduler_runs", {
  id: text("id").primaryKey(),
  schedulerId: text("scheduler_id").notNull(),
  status: text("status").notNull(),
  inputJson: text("input_json").notNull(),
  outputJson: text("output_json").notNull(),
  startedAt: integer("started_at", { mode: "number" }).notNull(),
  finishedAt: integer("finished_at", { mode: "number" }),
})

export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(), title: text("title").notNull(), chatbotId: text("chatbot_id").notNull(), summary: text("summary").notNull().default(""), sourceType: text("source_type").notNull().default("manual"), sourceRef: text("source_ref"), updatedAt: integer("updated_at", { mode: "number" }).notNull(),
})

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(), chatId: text("chat_id").notNull(), role: text("role").notNull(), content: text("content").notNull(), partsJson: text("parts_json").notNull().default("[]"), createdAt: integer("created_at", { mode: "number" }).notNull(),
})

export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(), title: text("title").notNull(), kind: text("kind").notNull(), endpoint: text("endpoint").notNull().default(""), enabled: integer("enabled", { mode: "boolean" }).notNull().default(true), updatedAt: integer("updated_at", { mode: "number" }).notNull(),
})
export const integrationVersions = sqliteTable("integration_versions", {
  id: text("id").primaryKey(), integrationId: text("integration_id").notNull(), major: integer("major").notNull(), minor: integer("minor").notNull(), isRelease: integer("is_release", { mode: "boolean" }).notNull().default(false), configJson: text("config_json").notNull(), createdAt: integer("created_at", { mode: "number" }).notNull(),
})
export const integrationExecutions = sqliteTable("integration_executions", {
  id: text("id").primaryKey(), integrationId: text("integration_id").notNull(), versionId: text("version_id").notNull(), status: text("status").notNull(), inputJson: text("input_json").notNull(), outputJson: text("output_json").notNull(), createdAt: integer("created_at", { mode: "number" }).notNull(),
})

export const channels = sqliteTable("channels", {
  id: text("id").primaryKey(), title: text("title").notNull(), platform: text("platform").notNull(), enabled: integer("enabled", { mode: "boolean" }).notNull().default(false), status: text("status").notNull().default("inactive"), connectionMode: text("connection_mode").notNull().default("webhook"), webhookPath: text("webhook_path").notNull().default(""), webhookSecret: text("webhook_secret").notNull().default(""), autoReply: integer("auto_reply", { mode: "boolean" }).notNull().default(true), replyAgentId: text("reply_agent_id").notNull().default(""), createdAt: integer("created_at", { mode: "number" }).notNull(), lastMessageAt: integer("last_message_at", { mode: "number" }), messageCount: integer("message_count").notNull().default(0), configJson: text("config_json").notNull().default("{}"), runtimeJson: text("runtime_json").notNull().default("{}"), updatedAt: integer("updated_at", { mode: "number" }).notNull(),
})

export const schema = { appMeta, workflows, workflowVersions, workflowInvocations, agents, agentVersions, documents, documentVersions, providers, skills, skillVersions, schedulers, schedulerRuns, chats, chatMessages, integrations, integrationVersions, integrationExecutions, channels }