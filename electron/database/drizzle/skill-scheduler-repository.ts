import crypto from "node:crypto"
import { and, desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@electron/database/drizzle/client"
import { schedulerRuns, schedulers, skillVersions, skills } from "@electron/database/drizzle/schema"

const starterFiles = JSON.stringify([{ path: "SKILL.md", content: "---\nname: \"New skill\"\ndescription: \"Describe what this skill does.\"\n---\n", language: "md", kind: "file" }])

export async function listSkillsWithDrizzle() { return getDrizzleDatabase().select().from(skills).orderBy(desc(skills.updatedAt)) }
export async function getSkillWithDrizzle(skillId: string) {
  const database = getDrizzleDatabase()
  const [skill] = await database.select().from(skills).where(eq(skills.id, skillId)).limit(1)
  const versions = await database.select().from(skillVersions).where(eq(skillVersions.skillId, skillId)).orderBy(desc(skillVersions.major), desc(skillVersions.minor), desc(skillVersions.createdAt))
  return { skill: skill ?? null, versions }
}
export async function createSkillWithDrizzle() {
  const database = getDrizzleDatabase(); const id = crypto.randomUUID(); const now = Date.now()
  await database.insert(skills).values({ id, title: "New skill", source: "custom", summary: "", updatedAt: now })
  await database.insert(skillVersions).values({ id: crypto.randomUUID(), skillId: id, major: 1, minor: 0, isRelease: false, filesJson: starterFiles, createdAt: now })
  return getSkillWithDrizzle(id)
}
export async function saveSkillWithDrizzle(payload: { id: string; title: string; source?: string; summary: string; filesJson?: string; selectedVersionId?: string; publish?: boolean }) {
  const database = getDrizzleDatabase(); const now = Date.now(); const filesJson = payload.filesJson || starterFiles
  await database.update(skills).set({ title: payload.title, source: payload.source || "custom", summary: payload.summary, updatedAt: now }).where(eq(skills.id, payload.id))
  const [selected] = payload.selectedVersionId ? await database.select().from(skillVersions).where(and(eq(skillVersions.skillId, payload.id), eq(skillVersions.id, payload.selectedVersionId))).limit(1) : []
  const [latest] = await database.select().from(skillVersions).where(eq(skillVersions.skillId, payload.id)).orderBy(desc(skillVersions.major), desc(skillVersions.minor), desc(skillVersions.createdAt)).limit(1)
  if (!payload.publish && selected && !selected.isRelease) await database.update(skillVersions).set({ filesJson, createdAt: now }).where(eq(skillVersions.id, selected.id))
  else await database.insert(skillVersions).values({ id: crypto.randomUUID(), skillId: payload.id, major: !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major, minor: !latest || latest.isRelease ? 0 : latest.minor + 1, isRelease: Boolean(payload.publish), filesJson, createdAt: now })
  return getSkillWithDrizzle(payload.id)
}
export async function deleteSkillWithDrizzle(skillId: string) { const database = getDrizzleDatabase(); await database.delete(skillVersions).where(eq(skillVersions.skillId, skillId)); await database.delete(skills).where(eq(skills.id, skillId)); return { success: true } }

export async function listSchedulersWithDrizzle() { return getDrizzleDatabase().select().from(schedulers).orderBy(desc(schedulers.updatedAt)) }
export async function getSchedulerWithDrizzle(id: string) { const [row] = await getDrizzleDatabase().select().from(schedulers).where(eq(schedulers.id, id)).limit(1); return row ?? null }
export async function createSchedulerWithDrizzle() { const database = getDrizzleDatabase(); const id = crypto.randomUUID(); const now = Date.now(); await database.insert(schedulers).values({ id, title: "New scheduler", description: "", enabled: true, schedule: "0 9 * * *", timeZone: "Asia/Shanghai", targetType: "workflow", targetId: "", targetName: "", missedRunPolicy: "skip", retryLimit: 0, retryBackoffSeconds: 300, inputPayloadJson: "{}", updatedAt: now }); return getSchedulerWithDrizzle(id) }
export async function saveSchedulerWithDrizzle(payload: { id: string; title: string; description: string; enabled: boolean; schedule: string; timeZone: string; targetType: string; targetId: string; targetName: string; missedRunPolicy: string; retryLimit: number; retryBackoffSeconds: number; inputPayloadJson: string }) { const database = getDrizzleDatabase(); await database.update(schedulers).set({ ...payload, updatedAt: Date.now() }).where(eq(schedulers.id, payload.id)); return getSchedulerWithDrizzle(payload.id) }
export async function setSchedulerEnabledWithDrizzle(id: string, enabled: boolean) { const database = getDrizzleDatabase(); await database.update(schedulers).set({ enabled, updatedAt: Date.now() }).where(eq(schedulers.id, id)); return getSchedulerWithDrizzle(id) }
export async function listSchedulerRunsWithDrizzle(schedulerId: string) { return getDrizzleDatabase().select().from(schedulerRuns).where(eq(schedulerRuns.schedulerId, schedulerId)).orderBy(desc(schedulerRuns.startedAt)) }
export async function deleteSchedulerWithDrizzle(id: string) { const database = getDrizzleDatabase(); const existing = await getSchedulerWithDrizzle(id); await database.delete(schedulerRuns).where(eq(schedulerRuns.schedulerId, id)); await database.delete(schedulers).where(eq(schedulers.id, id)); return { ok: Boolean(existing) } }
