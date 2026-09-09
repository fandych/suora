import type { SchedulerDetail, SchedulerRunRecord } from "@/data/domain/models"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { projectIpc } from "@/lib/ipc"

export async function listSchedulers() {
  await ensureSeeded()
  return projectIpc.schedulers.list() as Promise<SchedulerDetail[]>
}

export async function getScheduler(schedulerId: string) {
  await ensureSeeded()
  const item = await projectIpc.schedulers.get(schedulerId) as SchedulerDetail | null
  if (!item) {
    throw new Error(`Scheduler ${schedulerId} was not found.`)
  }
  return item
}

export async function createScheduler() {
  await ensureSeeded()
  return projectIpc.schedulers.create() as Promise<SchedulerDetail>
}

export async function listSchedulerRuns(schedulerId: string) {
  await ensureSeeded()
  return projectIpc.schedulers.listRuns(schedulerId) as Promise<SchedulerRunRecord[]>
}

export async function setSchedulerEnabled(schedulerId: string, enabled: boolean) {
  await ensureSeeded()
  const scheduler = await projectIpc.schedulers.setEnabled({ id: schedulerId, enabled })
  if (!scheduler) throw new Error(`Scheduler ${schedulerId} was not found.`)
  return scheduler
}

export async function deleteScheduler(schedulerId: string) {
  await ensureSeeded()
  return projectIpc.schedulers.delete(schedulerId)
}

function assertValidJson(value: string) {
  const normalized = value.trim()

  if (!normalized) {
    return "{}"
  }

  JSON.parse(normalized)
  return normalized
}

export async function saveScheduler(payload: SchedulerDetail) {
  await ensureSeeded()
  if (!payload.title.trim()) {
    throw new Error("Scheduler title is required.")
  }
  if (!payload.schedule.trim()) {
    throw new Error("Scheduler cron schedule is required.")
  }
  if (!payload.timeZone.trim()) {
    throw new Error("Scheduler time zone is required.")
  }
  if (!payload.targetId.trim()) {
    throw new Error("Scheduler target is required.")
  }

  const inputPayloadJson = assertValidJson(payload.inputPayloadJson)

  return projectIpc.schedulers.save({
    ...payload,
    description: payload.description.trim(),
    schedule: payload.schedule.trim(),
    timeZone: payload.timeZone.trim(),
    targetId: payload.targetId.trim(),
    targetName: payload.targetName.trim(),
    missedRunPolicy: payload.missedRunPolicy,
    retryLimit: Number.isFinite(payload.retryLimit) ? payload.retryLimit : 0,
    retryBackoffSeconds: Number.isFinite(payload.retryBackoffSeconds) ? payload.retryBackoffSeconds : 300,
    inputPayloadJson,
  }) as Promise<SchedulerDetail>
}