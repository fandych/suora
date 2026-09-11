import crypto from "node:crypto"
import { desc, eq, and } from "drizzle-orm"
import { getDrizzleDatabase } from "@electron/database/drizzle/client"
import { workflowInvocations, workflowVersions, workflows } from "@electron/database/drizzle/schema"
import { createDefaultWorkflowDefinition, validateWorkflowDefinitionJson } from "@electron/others/services/workflow-definition"

export async function listWorkflowDefinitionsWithDrizzle() {
  return getDrizzleDatabase().select().from(workflows).orderBy(desc(workflows.updatedAt))
}

export async function getWorkflowDefinitionRowsWithDrizzle(workflowId: string) {
  const database = getDrizzleDatabase()
  const [workflow] = await database.select().from(workflows).where(eq(workflows.id, workflowId)).limit(1)
  const versions = await database.select().from(workflowVersions).where(eq(workflowVersions.workflowId, workflowId)).orderBy(desc(workflowVersions.major), desc(workflowVersions.minor), desc(workflowVersions.createdAt))
  const invocations = await database.select().from(workflowInvocations).where(eq(workflowInvocations.workflowId, workflowId)).orderBy(desc(workflowInvocations.createdAt))
  return { workflow: workflow ?? null, versions, invocations }
}

export async function createWorkflowDefinitionWithDrizzle() {
  const database = getDrizzleDatabase()
  const workflowId = crypto.randomUUID()
  const now = Date.now()
  await database.insert(workflows).values({ id: workflowId, title: "New workflow", summary: "", updatedAt: now })
  await database.insert(workflowVersions).values({ id: crypto.randomUUID(), workflowId, major: 1, minor: 0, isRelease: false, definitionJson: JSON.stringify(createDefaultWorkflowDefinition()), createdAt: now })
  return getWorkflowDefinitionRowsWithDrizzle(workflowId)
}

export async function deleteWorkflowDefinitionWithDrizzle(workflowId: string) {
  const database = getDrizzleDatabase()
  const existing = await database.select({ id: workflows.id }).from(workflows).where(eq(workflows.id, workflowId)).limit(1)
  await database.delete(workflowInvocations).where(eq(workflowInvocations.workflowId, workflowId))
  await database.delete(workflowVersions).where(eq(workflowVersions.workflowId, workflowId))
  await database.delete(workflows).where(eq(workflows.id, workflowId))
  return existing.length > 0
}

export async function saveWorkflowDefinitionWithDrizzle(payload: { id: string; title: string; summary: string; definitionJson: string; selectedVersionId?: string; publish?: boolean }) {
  validateWorkflowDefinitionJson(payload.definitionJson)
  const database = getDrizzleDatabase()
  const now = Date.now()
  const [latest] = await database.select().from(workflowVersions).where(eq(workflowVersions.workflowId, payload.id)).orderBy(desc(workflowVersions.major), desc(workflowVersions.minor), desc(workflowVersions.createdAt)).limit(1)
  const target = payload.selectedVersionId ? (await database.select().from(workflowVersions).where(and(eq(workflowVersions.workflowId, payload.id), eq(workflowVersions.id, payload.selectedVersionId))).limit(1))[0] : undefined
  const selected = target && !target.isRelease ? target : (await database.select().from(workflowVersions).where(and(eq(workflowVersions.workflowId, payload.id), eq(workflowVersions.isRelease, false))).orderBy(desc(workflowVersions.major), desc(workflowVersions.minor), desc(workflowVersions.createdAt)).limit(1))[0]
  await database.update(workflows).set({ title: payload.title, summary: payload.summary, updatedAt: now }).where(eq(workflows.id, payload.id))
  if (!payload.publish && selected) {
    await database.update(workflowVersions).set({ definitionJson: payload.definitionJson, createdAt: now }).where(eq(workflowVersions.id, selected.id))
  } else {
    await database.insert(workflowVersions).values({ id: crypto.randomUUID(), workflowId: payload.id, major: !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major, minor: !latest || latest.isRelease ? 0 : latest.minor + 1, isRelease: Boolean(payload.publish), definitionJson: payload.definitionJson, createdAt: now })
  }
  const [workflow] = await database.select().from(workflows).where(eq(workflows.id, payload.id)).limit(1)
  return workflow ?? null
}