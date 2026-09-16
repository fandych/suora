import { createProvider } from "@/electron/app/models/providers/model"
export const stepfunProvider = createProvider(
  "stepfun",
  "StepFun",
  "StepFun official model gateway. Use Refresh models to discover the current catalog.",
  "https://api.stepfun.com/v1",
  "https://platform.stepfun.com/docs",
)
