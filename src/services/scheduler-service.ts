import type { SchedulerDetail, SchedulerRunRecord } from "@/types/scheduler"
import { requireAppBridge } from "@/services/bridge"

function assertValidJson(value: string) {
  const normalized = value.trim()
  if (!normalized) return "{}"
  JSON.parse(normalized)
  return normalized
}

function normalizeSavePayload(payload: SchedulerDetail) {
  if (!payload.title.trim()) throw new Error("Scheduler title is required.")
  if (!payload.schedule.trim()) throw new Error("Scheduler cron schedule is required.")
  if (!payload.timeZone.trim()) throw new Error("Scheduler time zone is required.")
  if (!payload.targetId.trim()) throw new Error("Scheduler target is required.")

  return {
    ...payload,
    title: payload.title.trim(),
    description: payload.description.trim(),
    schedule: payload.schedule.trim(),
    timeZone: payload.timeZone.trim(),
    targetId: payload.targetId.trim(),
    targetName: payload.targetName.trim(),
    retryLimit: Number.isFinite(payload.retryLimit) ? payload.retryLimit : 0,
    retryBackoffSeconds: Number.isFinite(payload.retryBackoffSeconds) ? payload.retryBackoffSeconds : 300,
    inputPayloadJson: assertValidJson(payload.inputPayloadJson),
  }
}

export const SchedulerApi = {
  listAll: () => requireAppBridge().schedulers.list() as Promise<SchedulerDetail[]>,
  get: (schedulerId: string) => requireAppBridge().schedulers.get(schedulerId) as Promise<SchedulerDetail | null>,
  create: () => requireAppBridge().schedulers.create() as Promise<SchedulerDetail>,
  save: (payload: SchedulerDetail) =>
    requireAppBridge().schedulers.save(normalizeSavePayload(payload)) as Promise<SchedulerDetail>,
  setEnabled: (payload: { id: string; enabled: boolean }) =>
    requireAppBridge().schedulers.setEnabled(payload) as Promise<SchedulerDetail | null>,
  listRuns: (schedulerId: string) => requireAppBridge().schedulers.listRuns(schedulerId) as Promise<SchedulerRunRecord[]>,
  remove: (schedulerId: string) => requireAppBridge().schedulers.delete(schedulerId),
}

export type { SchedulerDetail, SchedulerRunRecord }
