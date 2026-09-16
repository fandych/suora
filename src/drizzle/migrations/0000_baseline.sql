CREATE TABLE `agent_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`major` integer NOT NULL,
	`minor` integer NOT NULL,
	`is_release` integer DEFAULT false NOT NULL,
	`config_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`platform` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'inactive' NOT NULL,
	`connection_mode` text DEFAULT 'webhook' NOT NULL,
	`webhook_path` text DEFAULT '' NOT NULL,
	`webhook_secret` text DEFAULT '' NOT NULL,
	`auto_reply` integer DEFAULT true NOT NULL,
	`reply_agent_id` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`last_message_at` integer,
	`message_count` integer DEFAULT 0 NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`runtime_json` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`parts_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chats` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`chatbot_id` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `document_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`major` integer NOT NULL,
	`minor` integer NOT NULL,
	`is_release` integer DEFAULT false NOT NULL,
	`structure_json` text NOT NULL,
	`graph_json` text NOT NULL,
	`settings_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `integration_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`integration_id` text NOT NULL,
	`version_id` text NOT NULL,
	`status` text NOT NULL,
	`input_json` text NOT NULL,
	`output_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `integration_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`integration_id` text NOT NULL,
	`major` integer NOT NULL,
	`minor` integer NOT NULL,
	`is_release` integer DEFAULT false NOT NULL,
	`config_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`endpoint` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`provider_type` text NOT NULL,
	`base_url` text NOT NULL,
	`api_key` text NOT NULL,
	`models_json` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scheduler_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`scheduler_id` text NOT NULL,
	`status` text NOT NULL,
	`input_json` text NOT NULL,
	`output_json` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer
);
--> statement-breakpoint
CREATE TABLE `schedulers` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`schedule` text NOT NULL,
	`time_zone` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`target_name` text NOT NULL,
	`missed_run_policy` text NOT NULL,
	`retry_limit` integer NOT NULL,
	`retry_backoff_seconds` integer NOT NULL,
	`input_payload_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skill_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`major` integer NOT NULL,
	`minor` integer NOT NULL,
	`is_release` integer DEFAULT false NOT NULL,
	`files_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`source` text DEFAULT 'custom' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workflow_invocations` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`version_id` text NOT NULL,
	`status` text NOT NULL,
	`trigger` text NOT NULL,
	`input_json` text,
	`output_json` text,
	`trace_json` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workflow_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`major` integer NOT NULL,
	`minor` integer NOT NULL,
	`is_release` integer DEFAULT false NOT NULL,
	`definition_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
