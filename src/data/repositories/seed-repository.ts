import { getProjectBridge } from "@/lib/ipc"

const SEED_VERSION = "2026-09-08-private-editor-agents-v1"
const LEGACY_AGENT_IDS = ["agent-crm-sync"]
const LEGACY_SKILL_IDS = ["skill-plan", "skill-agent-customization", "skill-brand-tone"]
const LEGACY_WORKFLOW_IDS = ["workflow-lead-intake", "workflow-weekly-report"]
const LEGACY_INTEGRATION_IDS = ["integration-webhook", "integration-github-mcp", "integration-cleanup-script"]

let seedPromise: Promise<void> | undefined

async function isSeeded() {
  const result = await getProjectBridge().database.ensureSeeded({ version: SEED_VERSION, legacyAgentIds: LEGACY_AGENT_IDS, legacySkillIds: LEGACY_SKILL_IDS, legacyWorkflowIds: LEGACY_WORKFLOW_IDS, legacyIntegrationIds: LEGACY_INTEGRATION_IDS }) as { seeded: boolean }
  return result.seeded
}

/**
 * Migrates legacy demonstration catalog entries out of the local database.
 * New workspaces intentionally start without seeded workflows, skills,
 * integrations, or custom agents; system editor agents are overlay metadata.
 */
export function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      await isSeeded()
    })()
  }

  return seedPromise
}
