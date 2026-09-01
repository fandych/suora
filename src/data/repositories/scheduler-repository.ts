import type { SchedulerDetail } from "@/data/domain/models"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { suoraIpc } from "@/lib/ipc"

export async function listSchedulers() {
  await ensureSeeded()
  return suoraIpc.schedulers.list() as Promise<SchedulerDetail[]>
}

export async function getScheduler(schedulerId: string) {
  await ensureSeeded()
  const item = await suoraIpc.schedulers.get(schedulerId) as SchedulerDetail | null
  if (!item) {
    throw new Error(`Scheduler ${schedulerId} was not found.`)
  }
  return item
}

export async function createScheduler() {
  await ensureSeeded()
  return suoraIpc.schedulers.create() as Promise<SchedulerDetail>
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

  return suoraIpc.schedulers.save({
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