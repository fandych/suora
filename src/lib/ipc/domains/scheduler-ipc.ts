import type { SchedulerDetail, SchedulerRunRecord } from "@/data/domain/scheduler-models"
import { getProjectBridge } from "@/lib/ipc/bridge"

export const schedulerIpc = {
  list: async () => getProjectBridge().schedulers.list() as Promise<SchedulerDetail[]>,
  get: async (schedulerId: string) => getProjectBridge().schedulers.get(schedulerId) as Promise<SchedulerDetail | null>,
  create: async () => getProjectBridge().schedulers.create() as Promise<SchedulerDetail>,
  save: async (payload: { id: string; title: string; description: string; enabled: boolean; schedule: string; timeZone: string; targetType: string; targetId: string; targetName: string; missedRunPolicy: string; retryLimit: number; retryBackoffSeconds: number; inputPayloadJson: string }) => getProjectBridge().schedulers.save(payload) as Promise<SchedulerDetail>,
  setEnabled: async (payload: { id: string; enabled: boolean }) => getProjectBridge().schedulers.setEnabled(payload) as Promise<SchedulerDetail | null>,
  listRuns: async (schedulerId: string) => getProjectBridge().schedulers.listRuns(schedulerId) as Promise<SchedulerRunRecord[]>,
  delete: async (schedulerId: string) => getProjectBridge().schedulers.delete(schedulerId) as Promise<{ ok: boolean }>,
}
