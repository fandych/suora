import { createIntegration, deleteIntegration, getIntegrationDetail, listIntegrationSummaries, runIntegrationAndPersist, saveIntegrationDraft, setIntegrationEnabled } from "@/data/repositories/integration-repository"

export const integrationApplicationService = {
  create: createIntegration,
  delete: deleteIntegration,
  getDetail: getIntegrationDetail,
  list: listIntegrationSummaries,
  runAndPersist: runIntegrationAndPersist,
  saveDraft: saveIntegrationDraft,
  setEnabled: setIntegrationEnabled,
}
