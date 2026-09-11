/**
 * Seed cleanup IDs retained for compatibility with databases created before
 * the private editor seed migration. Remove after the minimum supported seed
 * version is strictly newer than `2026-09-08-private-editor-agents-v1`.
 */
export const LEGACY_AGENT_IDS = ["agent-crm-sync"]
export const LEGACY_SKILL_IDS = ["skill-plan", "skill-agent-customization", "skill-brand-tone"]
export const LEGACY_WORKFLOW_IDS = ["workflow-lead-intake", "workflow-weekly-report"]
export const LEGACY_INTEGRATION_IDS = ["integration-webhook", "integration-github-mcp", "integration-cleanup-script"]