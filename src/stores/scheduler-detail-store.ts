import { create } from "zustand"
import type { SchedulerDetail, SchedulerRunRecord } from "@/types/scheduler"
import { SchedulerApi } from "@/services/scheduler-service"
import { AgentApi } from "@/services/agent-service"
import { WorkflowApi } from "@/services/workflow-service"

type SchedulerDetailState = {
  schedulerId: string | null
  draft: SchedulerDetail | null
  runs: SchedulerRunRecord[]
  workflows: Awaited<ReturnType<typeof WorkflowApi.listAll>>
  agents: Awaited<ReturnType<typeof AgentApi.listAvailable>>
  isLoading: boolean
  isSaving: boolean
  isDeleting: boolean
  error: Error | null
  load: (schedulerId: string) => Promise<void>
  updateDraft: (draft: SchedulerDetail) => void
  save: () => Promise<SchedulerDetail | null>
  toggleEnabled: () => Promise<SchedulerDetail | null>
  remove: () => Promise<void>
  reload: () => Promise<void>
}

export const useSchedulerDetailStore = create<SchedulerDetailState>((set, get) => ({
  schedulerId: null,
  draft: null,
  runs: [],
  workflows: [],
  agents: [],
  isLoading: false,
  isSaving: false,
  isDeleting: false,
  error: null,
  load: async (schedulerId) => {
    set({ schedulerId, isLoading: true, error: null })
    try {
      const [draft, runs, workflows, agents] = await Promise.all([
        SchedulerApi.get(schedulerId),
        SchedulerApi.listRuns(schedulerId),
        WorkflowApi.listAll(),
        AgentApi.listAvailable(),
      ])
      if (get().schedulerId !== schedulerId) return
      set({ draft, runs, workflows, agents, isLoading: false })
    } catch (error) {
      if (get().schedulerId !== schedulerId) return
      set({ isLoading: false, error: error instanceof Error ? error : new Error(String(error)) })
    }
  },
  updateDraft: (draft) => set({ draft }),
  save: async () => {
    const draft = get().draft
    if (!draft) return null
    set({ isSaving: true, error: null })
    try {
      const saved = await SchedulerApi.save(draft)
      set({ draft: saved, isSaving: false })
      return saved
    } catch (error) {
      set({ isSaving: false, error: error instanceof Error ? error : new Error(String(error)) })
      return null
    }
  },
  toggleEnabled: async () => {
    const draft = get().draft
    if (!draft) return null
    try {
      const saved = await SchedulerApi.setEnabled({ id: draft.id, enabled: !draft.enabled })
      if (saved) set({ draft: saved })
      return saved
    } catch (error) {
      set({ error: error instanceof Error ? error : new Error(String(error)) })
      return null
    }
  },
  remove: async () => {
    const draft = get().draft
    if (!draft) return
    set({ isDeleting: true, error: null })
    try {
      await SchedulerApi.remove(draft.id)
      set({ draft: null, isDeleting: false })
    } catch (error) {
      set({ isDeleting: false, error: error instanceof Error ? error : new Error(String(error)) })
    }
  },
  reload: async () => {
    const schedulerId = get().schedulerId
    if (schedulerId) await get().load(schedulerId)
  },
}))
