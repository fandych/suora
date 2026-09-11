import { create } from "zustand"
import type { ProviderConfigRecord } from "@/data/domain/provider-agent-models"
import { modelApplicationService } from "@/application/models/model-application-service"

type ModelDetailState = {
  modelId: string | null
  draft: ProviderConfigRecord | null
  isLoading: boolean
  isSaving: boolean
  error: Error | null
  load: (modelId: string) => Promise<void>
  updateDraft: (draft: ProviderConfigRecord) => void
  save: () => Promise<ProviderConfigRecord | null>
  remove: () => Promise<void>
  reload: () => Promise<void>
}

export const useModelDetailStore = create<ModelDetailState>((set, get) => ({
  modelId: null,
  draft: null,
  isLoading: false,
  isSaving: false,
  error: null,
  load: async (modelId) => {
    set({ modelId, isLoading: true, error: null })
    try {
      const draft = await modelApplicationService.getDetail(modelId)
      set({ draft, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error : new Error(String(error)) })
    }
  },
  updateDraft: (draft) => set({ draft }),
  save: async () => {
    const draft = get().draft
    if (!draft) return null
    set({ isSaving: true, error: null })
    try {
      const saved = await modelApplicationService.save(draft)
      set({ draft: saved, isSaving: false })
      return saved
    } catch (error) {
      set({ isSaving: false, error: error instanceof Error ? error : new Error(String(error)) })
      return null
    }
  },
  remove: async () => {
    const draft = get().draft
    if (!draft) return
    set({ isSaving: true, error: null })
    try {
      await modelApplicationService.remove(draft.id)
      set({ draft: null, isSaving: false })
    } catch (error) {
      set({ isSaving: false, error: error instanceof Error ? error : new Error(String(error)) })
    }
  },
  reload: async () => {
    const modelId = get().modelId
    if (modelId) await get().load(modelId)
  },
}))
