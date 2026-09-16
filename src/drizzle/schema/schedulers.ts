import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const schedulers = sqliteTable("schedulers", {
  id: text("id").primaryKey(), title: text("title").notNull(), description: text("description").notNull().default(""), enabled: integer("enabled", { mode: "boolean" }).notNull().default(true), schedule: text("schedule").notNull(), timeZone: text("time_zone").notNull(), targetType: text("target_type").notNull(), targetId: text("target_id").notNull(), targetName: text("target_name").notNull(), missedRunPolicy: text("missed_run_policy").notNull(), retryLimit: integer("retry_limit").notNull(), retryBackoffSeconds: integer("retry_backoff_seconds").notNull(), inputPayloadJson: text("input_payload_json").notNull(), updatedAt: integer("updated_at", { mode: "number" }).notNull(),
})

export const schedulerRuns = sqliteTable("scheduler_runs", {
  id: text("id").primaryKey(), schedulerId: text("scheduler_id").notNull(), status: text("status").notNull(), inputJson: text("input_json").notNull(), outputJson: text("output_json").notNull(), startedAt: integer("started_at", { mode: "number" }).notNull(), finishedAt: integer("finished_at", { mode: "number" }),
})
