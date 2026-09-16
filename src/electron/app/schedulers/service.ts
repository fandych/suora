import { z } from "zod"
import {
  createScheduler,
  deleteScheduler,
  getScheduler,
  listSchedulerRuns,
  listSchedulers,
  saveScheduler,
  setSchedulerEnabled,
} from "@/electron/app/schedulers/repository"

const schedulerPayloadSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  schedule: z.string(),
  timeZone: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  targetName: z.string(),
  missedRunPolicy: z.string(),
  retryLimit: z.number(),
  retryBackoffSeconds: z.number(),
  inputPayloadJson: z.string(),
})

export const schedulerService = {
  list: () => listSchedulers(),
  get: (id: string) => getScheduler(id),
  create: () => createScheduler(),
  save: (payload: unknown) => saveScheduler(schedulerPayloadSchema.parse(payload)),
  setEnabled: (id: string, enabled: boolean) => setSchedulerEnabled(id, enabled),
  listRuns: (id: string) => listSchedulerRuns(id),
  remove: (id: string) => deleteScheduler(id),
}
