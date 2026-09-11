import { and, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@electron/database/drizzle/client"
import { agentVersions, agents, appMeta, integrationExecutions, integrationVersions, integrations, skillVersions, skills, workflowInvocations, workflowVersions, workflows } from "@electron/database/drizzle/schema"

export async function getSeedVersion() { const [row] = await getDrizzleDatabase().select({ value: appMeta.value }).from(appMeta).where(eq(appMeta.key, "seed_version")).limit(1); return row?.value ?? null }
export async function cleanupSeedResources(input: { legacyAgentIds: string[]; legacySkillIds: string[]; legacyWorkflowIds: string[]; legacyIntegrationIds: string[] }) {
  const database = getDrizzleDatabase()
  for (const id of input.legacyIntegrationIds) { await database.delete(integrationExecutions).where(eq(integrationExecutions.integrationId, id)); await database.delete(integrationVersions).where(eq(integrationVersions.integrationId, id)); await database.delete(integrations).where(eq(integrations.id, id)) }
  for (const id of input.legacyWorkflowIds) { await database.delete(workflowInvocations).where(eq(workflowInvocations.workflowId, id)); await database.delete(workflowVersions).where(eq(workflowVersions.workflowId, id)); await database.delete(workflows).where(eq(workflows.id, id)) }
  for (const id of input.legacySkillIds) { await database.delete(skillVersions).where(eq(skillVersions.skillId, id)); await database.delete(skills).where(eq(skills.id, id)) }
  for (const id of input.legacyAgentIds) { await database.delete(agentVersions).where(eq(agentVersions.agentId, id)); await database.delete(agents).where(eq(agents.id, id)) }
}
export async function setSeedVersion(version: string) { const database = getDrizzleDatabase(); await database.insert(appMeta).values({ key: "seed_version", value: version }).onConflictDoUpdate({ target: appMeta.key, set: { value: version } }) }
export async function pingDrizzle() { const [row] = await getDrizzleDatabase().select({ value: appMeta.value }).from(appMeta).where(and(eq(appMeta.key, "seed_version"), eq(appMeta.value, appMeta.value)).limit(1)); return row ? { value: 1 } : { value: 1 } }
