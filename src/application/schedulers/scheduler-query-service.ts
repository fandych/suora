import { createScheduler, listSchedulers } from "@/data/repositories/scheduler-repository"
import { getWorkflowDetail } from "@/services/workflows/workflow-service"

export const schedulerQueryService = {
  create: createScheduler,
  list: listSchedulers,
  getWorkflowDetail,
}
