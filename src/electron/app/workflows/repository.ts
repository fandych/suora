import crypto from "node:crypto"
import { and, desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@/drizzle/db"
import { workflowInvocations, workflowVersions, workflows } from "@/drizzle/schema"
import { createDefaultWorkflowDefinition, validateWorkflowDefinitionJson } from "@/electron/app/workflows/definition"

export async function listWorkflowDefinitions() {
  return getDrizzleDatabase().select().from(workflows).orderBy(desc(workflows.updatedAt))
}

export async function getWorkflowDefinition(workflowId: string) {
  const database = getDrizzleDatabase()
  const [workflow] = await database.select().from(workflows).where(eq(workflows.id, workflowId)).limit(1)
  const versions = await database
    .select()
    .from(workflowVersions)
    .where(eq(workflowVersions.workflowId, workflowId))
    .orderBy(desc(workflowVersions.major), desc(workflowVersions.minor), desc(workflowVersions.createdAt))
  const invocations = await database
    .select()
    .from(workflowInvocations)
    .where(eq(workflowInvocations.workflowId, workflowId))
    .orderBy(desc(workflowInvocations.createdAt))
  return { workflow: workflow ?? null, versions, invocations }
}

export async function createWorkflowDefinition() {
  const database = getDrizzleDatabase()
  const workflowId = crypto.randomUUID()
  const now = Date.now()
  await database.insert(workflows).values({ id: workflowId, title: "New workflow", summary: "", updatedAt: now })
  await database.insert(workflowVersions).values({
    id: crypto.randomUUID(),
    workflowId,
    major: 1,
    minor: 0,
    isRelease: false,
    definitionJson: JSON.stringify(createDefaultWorkflowDefinition()),
    createdAt: now,
  })
  return getWorkflowDefinition(workflowId)
}

export async function saveWorkflowDefinition(payload: {
  id: string
  title: string
  summary: string
  definitionJson: string
  selectedVersionId?: string
  publish?: boolean
}) {
  validateWorkflowDefinitionJson(payload.definitionJson)
  const database = getDrizzleDatabase()
  const now = Date.now()
  const [latest] = await database
    .select()
    .from(workflowVersions)
    .where(eq(workflowVersions.workflowId, payload.id))
    .orderBy(desc(workflowVersions.major), desc(workflowVersions.minor), desc(workflowVersions.createdAt))
    .limit(1)
  const [target] = payload.selectedVersionId
    ? await database
        .select()
        .from(workflowVersions)
        .where(and(eq(workflowVersions.workflowId, payload.id), eq(workflowVersions.id, payload.selectedVersionId)))
        .limit(1)
    : []
  const [draft] = await database
    .select()
    .from(workflowVersions)
    .where(and(eq(workflowVersions.workflowId, payload.id), eq(workflowVersions.isRelease, false)))
    .orderBy(desc(workflowVersions.major), desc(workflowVersions.minor), desc(workflowVersions.createdAt))
    .limit(1)
  const selected = target && !target.isRelease ? target : draft
  await database
    .update(workflows)
    .set({ title: payload.title, summary: payload.summary, updatedAt: now })
    .where(eq(workflows.id, payload.id))
  if (!payload.publish && selected) {
    await database
      .update(workflowVersions)
      .set({ definitionJson: payload.definitionJson, createdAt: now })
      .where(eq(workflowVersions.id, selected.id))
  } else {
    await database.insert(workflowVersions).values({
      id: crypto.randomUUID(),
      workflowId: payload.id,
      major: !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major,
      minor: !latest || latest.isRelease ? 0 : latest.minor + 1,
      isRelease: Boolean(payload.publish),
      definitionJson: payload.definitionJson,
      createdAt: now,
    })
  }
  return getWorkflowDefinition(payload.id)
}

export async function deleteWorkflowDefinition(workflowId: string) {
  const database = getDrizzleDatabase()
  const existing = await database
    .select({ id: workflows.id })
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1)
  await database.delete(workflowInvocations).where(eq(workflowInvocations.workflowId, workflowId))
  await database.delete(workflowVersions).where(eq(workflowVersions.workflowId, workflowId))
  await database.delete(workflows).where(eq(workflows.id, workflowId))
  return existing.length > 0
}

export async function assertWorkflowVersion(workflowId: string, versionId: string) {
  const [row] = await getDrizzleDatabase()
    .select({ id: workflows.id })
    .from(workflows)
    .innerJoin(workflowVersions, eq(workflowVersions.workflowId, workflows.id))
    .where(and(eq(workflows.id, workflowId), eq(workflowVersions.id, versionId)))
    .limit(1)
  if (!row) throw new Error("Workflow or version not found")
}

export async function recordWorkflowInvocation(payload: {
  workflowId: string
  versionId: string
  status: string
  trigger: string
  input: string
  output: string
  traceJson: string
}) {
  await assertWorkflowVersion(payload.workflowId, payload.versionId)
  const id = crypto.randomUUID()
  const createdAt = Date.now()
  await getDrizzleDatabase().insert(workflowInvocations).values({
    id,
    workflowId: payload.workflowId,
    versionId: payload.versionId,
    status: payload.status,
    trigger: payload.trigger,
    inputJson: payload.input,
    outputJson: payload.output,
    traceJson: payload.traceJson,
    createdAt,
  })
  return {
    id,
    versionId: payload.versionId,
    status: payload.status,
    trigger: payload.trigger,
    input: payload.input,
    output: payload.output,
    traces: JSON.parse(payload.traceJson) as unknown[],
    createdAt,
  }
}
