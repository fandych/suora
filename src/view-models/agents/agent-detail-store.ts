import { create } from "zustand"
import type { AgentDetail } from "@/data/domain/models"
import { deleteAgent, getAgentDetail, saveAgentDraft, setSystemAgentDisabled } from "@/data/repositories/agent-repository"
import { listDocuments } from "@/data/repositories/document-repository"
import { listIntegrationSummaries } from "@/data/repositories/integration-repository"
import { listConfiguredModelProviders } from "@/data/repositories/model-config-repository"
import { listSkills } from "@/data/repositories/skill-repository"
import { listWorkflows } from "@/services/workflows/workflow-service"

function normalizeDraft(detail: AgentDetail): AgentDetail {
  return {
    ...detail,
    config: {
      ...detail.config,
      workflowIds: detail.config.workflowIds ?? [],
      documentIds: detail.config.documentIds ?? [],
    },
  }
}

type AgentDetailState = {
  agentId: string | null
  selectedVersionId?: string
  draft: AgentDetail | null
  providers: Awaited<ReturnType<typeof listConfiguredModelProviders>>
  skills: Awaited<ReturnType<typeof listSkills>>
  integrations: Awaited<ReturnType<typeof listIntegrationSummaries>>
  documents: Awaited<ReturnType<typeof listDocuments>>
  workflows: Awaited<ReturnType<typeof listWorkflows>>
  isLoading: boolean
  isSaving: boolean
  isUpdatingAvailability: boolean
  isDeleting: boolean
  error: Error | null
  load: (agentId: string, selectedVersionId?: string) => Promise<void>
  updateDraft: (draft: AgentDetail) => void
  save: () => Promise<AgentDetail | null>
  toggleBinding: (section: "workflows" | "integrations" | "skills" | "documents", itemId: string, checked: boolean) => Promise<AgentDetail | null>
  toggleAvailability: () => Promise<AgentDetail | null>
  remove: () => Promise<void>
  reload: () => Promise<void>
}

export const useAgentDetailStore = create<AgentDetailState>((set, get) => ({
  agentId: null,
  draft: null,
  providers: [],
  skills: [],
  integrations: [],
  documents: [],
  workflows: [],
  isLoading: false,
  isSaving: false,
  isUpdatingAvailability: false,
  isDeleting: false,
  error: null,
  load: async (agentId, selectedVersionId) => {
    set({ agentId, selectedVersionId, isLoading: true, error: null })
    try {
      const [detail, providers, skills, integrations, documents, workflows] = await Promise.all([
        getAgentDetail(agentId, selectedVersionId),
        listConfiguredModelProviders(),
        listSkills(),
        listIntegrationSummaries(),
        listDocuments(),
        listWorkflows(),
      ])
      if (!detail) throw new Error("Agent not found.")
      set({ draft: normalizeDraft(detail), providers, skills, integrations, documents, workflows, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error : new Error(String(error)) })
    }
  },
  updateDraft: (draft) => set({ draft: normalizeDraft(draft) }),
  save: async () => {
    const draft = get().draft
    if (!draft || draft.selectedVersion.isRelease) return null
    set({ isSaving: true, error: null })
    try {
      const saved = await saveAgentDraft(draft, false)
      set({ draft: normalizeDraft(saved), selectedVersionId: saved.selectedVersion.id, isSaving: false })
      return saved
    } catch (error) {
      set({ isSaving: false, error: error instanceof Error ? error : new Error(String(error)) })
      return null
    }
  },
  toggleBinding: async (section, itemId, checked) => {
    const draft = get().draft
    if (!draft || draft.selectedVersion.isRelease) return null
    const toggle = (items: string[]) => checked ? (items.includes(itemId) ? items : [...items, itemId]) : items.filter((id) => id !== itemId)
    const next = normalizeDraft({ ...draft, config: {
      ...draft.config,
      workflowIds: section === "workflows" ? toggle(draft.config.workflowIds ?? []) : draft.config.workflowIds,
      toolsetIds: section === "integrations" ? toggle(draft.config.toolsetIds) : draft.config.toolsetIds,
      skillIds: section === "skills" ? toggle(draft.config.skillIds) : draft.config.skillIds,
      documentIds: section === "documents" ? toggle(draft.config.documentIds ?? []) : draft.config.documentIds,
    } })
    set({ draft: next })
    return get().save()
  },
  toggleAvailability: async () => {
    const draft = get().draft
    if (!draft || draft.agent.source !== "system") return null
    set({ isUpdatingAvailability: true, error: null })
    try {
      await setSystemAgentDisabled(draft.agent.id, !draft.agent.isDisabled)
      const next = { ...draft, agent: { ...draft.agent, isDisabled: !draft.agent.isDisabled } }
      set({ draft: next, isUpdatingAvailability: false })
      return next
    } catch (error) {
      set({ isUpdatingAvailability: false, error: error instanceof Error ? error : new Error(String(error)) })
      return null
    }
  },
  remove: async () => {
    const draft = get().draft
    if (!draft || draft.agent.source !== "custom") return
    set({ isDeleting: true, error: null })
    try {
      await deleteAgent(draft.agent.id)
      set({ draft: null, isDeleting: false })
    } catch (error) {
      set({ isDeleting: false, error: error instanceof Error ? error : new Error(String(error)) })
    }
  },
  reload: async () => {
    const { agentId, selectedVersionId } = get()
    if (agentId) await get().load(agentId, selectedVersionId)
  },
}))
