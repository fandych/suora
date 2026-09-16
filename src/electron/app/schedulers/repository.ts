import crypto from "node:crypto"
import { desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@/drizzle/db"
import { schedulerRuns, schedulers } from "@/drizzle/schema"

export async function listSchedulers() {
  return getDrizzleDatabase().select().from(schedulers).orderBy(desc(schedulers.updatedAt))
}

export async function getScheduler(id: string) {
  const [row] = await getDrizzleDatabase().select().from(schedulers).where(eq(schedulers.id, id)).limit(1)
  return row ?? null
}

export async function createScheduler() {
  const database = getDrizzleDatabase()
  const id = crypto.randomUUID()
  const now = Date.now()
  await database.insert(schedulers).values({
    id,
    title: "New scheduler",
    description: "",
    enabled: true,
    schedule: "0 9 * * *",
    timeZone: "Asia/Shanghai",
    targetType: "workflow",
    targetId: "",
    targetName: "",
    missedRunPolicy: "skip",
    retryLimit: 0,
    retryBackoffSeconds: 300,
    inputPayloadJson: "{}",
    updatedAt: now,
  })
  return getScheduler(id)
}

export async function saveScheduler(payload: {
  id: string
  title: string
  description: string
  enabled: boolean
  schedule: string
  timeZone: string
  targetType: string
  targetId: string
  targetName: string
  missedRunPolicy: string
  retryLimit: number
  retryBackoffSeconds: number
  inputPayloadJson: string
}) {
  await getDrizzleDatabase()
    .update(schedulers)
    .set({ ...payload, updatedAt: Date.now() })
    .where(eq(schedulers.id, payload.id))
  return getScheduler(payload.id)
}

export async function setSchedulerEnabled(id: string, enabled: boolean) {
  await getDrizzleDatabase().update(schedulers).set({ enabled, updatedAt: Date.now() }).where(eq(schedulers.id, id))
  return getScheduler(id)
}

export async function listSchedulerRuns(schedulerId: string) {
  return getDrizzleDatabase()
    .select()
    .from(schedulerRuns)
    .where(eq(schedulerRuns.schedulerId, schedulerId))
    .orderBy(desc(schedulerRuns.startedAt))
}

export async function deleteScheduler(id: string) {
  const database = getDrizzleDatabase()
  const existing = await getScheduler(id)
  await database.delete(schedulerRuns).where(eq(schedulerRuns.schedulerId, id))
  await database.delete(schedulers).where(eq(schedulers.id, id))
  return { ok: Boolean(existing) }
}
