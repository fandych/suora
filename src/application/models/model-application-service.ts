import { deleteModelProvider, getModelProvider, listModelProviders, saveModelProvider } from "@/data/repositories/model-config-repository"

export const modelApplicationService = {
  list: () => listModelProviders(),
  getDetail: (providerId: string) => getModelProvider(providerId),
  save: (provider: Parameters<typeof saveModelProvider>[0]) => saveModelProvider(provider),
  remove: (providerId: string) => deleteModelProvider(providerId),
}
