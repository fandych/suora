import { create } from "zustand"
import type { SchedulerDetail, SchedulerRunRecord } from "@/data/domain/scheduler-models"
import { schedulerApplicationService } from "@/application/schedulers/scheduler-application-service"
import { agentQueryService } from "@/application/agents/agent-query-service"
import { workflowApplicationService } from "@/application/workflows/workflow-application-service"

type SchedulerDetailState = {
  schedulerId: string | null
  draft: SchedulerDetail | null
  runs: SchedulerRunRecord[]
  workflows: Awaited<ReturnType<typeof workflowApplicationService.list>>
  agents: Awaited<ReturnType<typeof agentQueryService.listAvailable>>
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
  schedulerId: null, draft: null, runs: [], workflows: [], agents: [], isLoading: false, isSaving: false, isDeleting: false, error: null,
  load: async (schedulerId) => {
    set({ schedulerId, isLoading: true, error: null })
    try {
      const [draft, runs, workflows, agents] = await Promise.all([schedulerApplicationService.getDetail(schedulerId), schedulerApplicationService.listRuns(schedulerId), workflowApplicationService.list(), agentQueryService.listAvailable()])
      set({ draft, runs, workflows, agents, isLoading: false })
    } catch (error) { set({ isLoading: false, error: error instanceof Error ? error : new Error(String(error)) }) }
  },
  updateDraft: (draft) => set({ draft }),
  save: async () => { const draft = get().draft; if (!draft) return null; set({ isSaving: true, error: null }); try { const saved = await schedulerApplicationService.save(draft); set({ draft: saved, isSaving: false }); return saved } catch (error) { set({ isSaving: false, error: error instanceof Error ? error : new Error(String(error)) }); return null } },
  toggleEnabled: async () => { const draft = get().draft; if (!draft) return null; try { const saved = await schedulerApplicationService.setEnabled(draft.id, !draft.enabled); if (saved) set({ draft: saved }); return saved } catch (error) { set({ error: error instanceof Error ? error : new Error(String(error)) }); return null } },
  remove: async () => { const draft = get().draft; if (!draft) return; set({ isDeleting: true, error: null }); try { await schedulerApplicationService.remove(draft.id); set({ draft: null, isDeleting: false }) } catch (error) { set({ isDeleting: false, error: error instanceof Error ? error : new Error(String(error)) }) } },
  reload: async () => { const schedulerId = get().schedulerId; if (schedulerId) await get().load(schedulerId) },
}))
