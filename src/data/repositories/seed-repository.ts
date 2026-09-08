import { eq, inArray } from "drizzle-orm"

import { executePersistedMutation, getDatabaseContext } from "@/data/db/client"
import {
  agents,
  agentVersions,
  appMeta,
  integrationExecutions,
  integrations,
  integrationVersions,
  skills,
  skillVersions,
  workflowInvocations,
  workflows,
  workflowVersions,
} from "@/data/db/schema"

const SEED_VERSION = "2026-09-08-private-editor-agents-v1"
const LEGACY_AGENT_IDS = ["agent-crm-sync"]
const LEGACY_SKILL_IDS = ["skill-plan", "skill-agent-customization", "skill-brand-tone"]
const LEGACY_WORKFLOW_IDS = ["workflow-lead-intake", "workflow-weekly-report"]
const LEGACY_INTEGRATION_IDS = ["integration-webhook", "integration-github-mcp", "integration-cleanup-script"]

let seedPromise: Promise<void> | undefined

async function isSeeded() {
  const context = await getDatabaseContext()
  const result = (await context.db.select().from(appMeta).where(eq(appMeta.key, "seed_version")).all())[0]
  return result?.value === SEED_VERSION
}

async function deleteLegacyCatalog() {
  await executePersistedMutation(async ({ db }) => {
    await db.delete(integrationExecutions).where(inArray(integrationExecutions.integrationId, LEGACY_INTEGRATION_IDS))
    await db.delete(integrationVersions).where(inArray(integrationVersions.integrationId, LEGACY_INTEGRATION_IDS))
    await db.delete(integrations).where(inArray(integrations.id, LEGACY_INTEGRATION_IDS))

    await db.delete(workflowInvocations).where(inArray(workflowInvocations.workflowId, LEGACY_WORKFLOW_IDS))
    await db.delete(workflowVersions).where(inArray(workflowVersions.workflowId, LEGACY_WORKFLOW_IDS))
    await db.delete(workflows).where(inArray(workflows.id, LEGACY_WORKFLOW_IDS))

    await db.delete(skillVersions).where(inArray(skillVersions.skillId, LEGACY_SKILL_IDS))
    await db.delete(skills).where(inArray(skills.id, LEGACY_SKILL_IDS))

    await db.delete(agentVersions).where(inArray(agentVersions.agentId, LEGACY_AGENT_IDS))
    await db.delete(agents).where(inArray(agents.id, LEGACY_AGENT_IDS))

    await db.insert(appMeta)
      .values({ key: "seed_version", value: SEED_VERSION })
      .onConflictDoUpdate({ target: appMeta.key, set: { value: SEED_VERSION } })
      .run()
  })
}

/**
 * Migrates legacy demonstration catalog entries out of the local database.
 * New workspaces intentionally start without seeded workflows, skills,
 * integrations, or custom agents; system editor agents are overlay metadata.
 */
export function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      if (!await isSeeded()) {
        await deleteLegacyCatalog()
      }
    })()
  }

  return seedPromise
}
