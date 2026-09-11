import { deleteScheduler, getScheduler, listSchedulerRuns, listSchedulers, saveScheduler, setSchedulerEnabled } from "@/data/repositories/scheduler-repository"

export const schedulerApplicationService = {
  list: () => listSchedulers(),
  getDetail: (schedulerId: string) => getScheduler(schedulerId),
  listRuns: (schedulerId: string) => listSchedulerRuns(schedulerId),
  save: (scheduler: Parameters<typeof saveScheduler>[0]) => saveScheduler(scheduler),
  setEnabled: (schedulerId: string, enabled: boolean) => setSchedulerEnabled(schedulerId, enabled),
  remove: (schedulerId: string) => deleteScheduler(schedulerId),
}
