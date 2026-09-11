import { create } from "zustand"
import type { SkillDetail } from "@/data/domain/models"
import { deleteSkill, getSkillDetail, saveSkillDraft } from "@/data/repositories/skill-repository"

type SkillDetailState = {
  skillId: string | null
  draft: SkillDetail | null
  isLoading: boolean
  isSaving: boolean
  isDeleting: boolean
  error: Error | null
  load: (skillId: string, versionId?: string) => Promise<void>
  updateDraft: (draft: SkillDetail) => void
  updateFiles: (files: SkillDetail["files"]) => void
  updateSkill: (patch: Partial<SkillDetail["skill"]>) => void
  updateFile: (path: string, patch: Partial<SkillDetail["files"][number]>) => void
  addFiles: (files: SkillDetail["files"]) => void
  removePathTree: (path: string) => void
  save: () => Promise<SkillDetail | null>
  remove: () => Promise<void>
  reload: () => Promise<void>
}

export const useSkillDetailStore = create<SkillDetailState>((set, get) => ({
  skillId: null,
  draft: null,
  isLoading: false,
  isSaving: false,
  isDeleting: false,
  error: null,
  load: async (skillId, versionId) => {
    set({ skillId, isLoading: true, error: null })
    try {
      const draft = await getSkillDetail(skillId, versionId)
      set({ draft, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error : new Error(String(error)) })
    }
  },
  updateDraft: (draft) => set({ draft }),
  updateFiles: (files) => set((state) => state.draft ? { draft: { ...state.draft, files } } : state),
  updateSkill: (patch) => set((state) => state.draft ? { draft: { ...state.draft, skill: { ...state.draft.skill, ...patch } } } : state),
  updateFile: (path, patch) => set((state) => state.draft ? { draft: { ...state.draft, files: state.draft.files.map((file) => file.path === path ? { ...file, ...patch } : file) } } : state),
  addFiles: (files) => set((state) => state.draft ? { draft: { ...state.draft, files: [...state.draft.files, ...files] } } : state),
  removePathTree: (path) => set((state) => state.draft ? { draft: { ...state.draft, files: state.draft.files.filter((file) => file.path !== path && !file.path.startsWith(`${path}/`)) } } : state),
  save: async () => {
    const draft = get().draft
    if (!draft) return null
    set({ isSaving: true, error: null })
    try {
      const saved = await saveSkillDraft(draft.skill.id, {
        title: draft.skill.title,
        source: draft.skill.source,
        summary: draft.skill.summary,
        files: draft.files,
        selectedVersionId: draft.selectedVersion.id,
      })
      set({ draft: { ...saved, files: saved.files }, isSaving: false })
      return { ...saved, files: saved.files }
    } catch (error) {
      set({ isSaving: false, error: error instanceof Error ? error : new Error(String(error)) })
      return null
    }
  },
  remove: async () => {
    const skillId = get().skillId
    if (!skillId) return
    set({ isDeleting: true, error: null })
    try {
      await deleteSkill(skillId)
      set({ draft: null, isDeleting: false })
    } catch (error) {
      set({ isDeleting: false, error: error instanceof Error ? error : new Error(String(error)) })
    }
  },
  reload: async () => {
    const { skillId, draft } = get()
    if (skillId) await get().load(skillId, draft?.selectedVersion.id)
  },
}))
