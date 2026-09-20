import { create } from "zustand"
import type { DocumentDetail } from "@/types/document"
import { DocumentApi } from "@/services/document-service"

type DocumentDetailState = {
  documentId: string | null
  draft: DocumentDetail | null
  isLoading: boolean
  isSaving: boolean
  isDeleting: boolean
  error: Error | null
  load: (documentId: string, versionId?: string) => Promise<void>
  updateDraft: (draft: DocumentDetail) => void
  updatePages: (pages: DocumentDetail["pages"]) => void
  updateDocument: (patch: Partial<DocumentDetail["document"]>) => void
  updatePage: (pageId: string, patch: Partial<DocumentDetail["pages"][number]>) => void
  addPage: (page: DocumentDetail["pages"][number]) => void
  removePageTree: (pageId: string) => void
  save: () => Promise<DocumentDetail | null>
  remove: () => Promise<void>
  reload: () => Promise<void>
}

export const useDocumentDetailStore = create<DocumentDetailState>((set, get) => ({
  documentId: null,
  draft: null,
  isLoading: false,
  isSaving: false,
  isDeleting: false,
  error: null,
  load: async (documentId, versionId) => {
    set({ documentId, isLoading: true, error: null })
    try {
      const draft = await DocumentApi.get(documentId, versionId)
      if (get().documentId !== documentId) return
      set({ draft, isLoading: false })
    } catch (error) {
      if (get().documentId !== documentId) return
      set({ isLoading: false, error: error instanceof Error ? error : new Error(String(error)) })
    }
  },
  updateDraft: (draft) => set({ draft }),
  updatePages: (pages) => set((state) => (state.draft ? { draft: { ...state.draft, pages } } : state)),
  updateDocument: (patch) =>
    set((state) =>
      state.draft ? { draft: { ...state.draft, document: { ...state.draft.document, ...patch } } } : state,
    ),
  updatePage: (pageId, patch) =>
    set((state) =>
      state.draft
        ? {
            draft: {
              ...state.draft,
              pages: state.draft.pages.map((page) => (page.id === pageId ? { ...page, ...patch } : page)),
            },
          }
        : state,
    ),
  addPage: (page) =>
    set((state) => (state.draft ? { draft: { ...state.draft, pages: [...state.draft.pages, page] } } : state)),
  removePageTree: (pageId) =>
    set((state) => {
      if (!state.draft) return state
      const descendants = new Set<string>()
      const visit = (parentId: string) => {
        state.draft?.pages.forEach((page) => {
          if (page.parentId === parentId) {
            descendants.add(page.id)
            visit(page.id)
          }
        })
      }
      visit(pageId)
      return {
        draft: {
          ...state.draft,
          pages: state.draft.pages.filter((page) => page.id !== pageId && !descendants.has(page.id)),
        },
      }
    }),
  save: async () => {
    const draft = get().draft
    if (!draft) return null
    set({ isSaving: true, error: null })
    try {
      const saved = await DocumentApi.save({
        id: draft.document.id,
        title: draft.document.title,
        summary: draft.document.summary,
        enabled: draft.document.enabled,
        pages: draft.pages,
        graphEdges: draft.graphEdges,
        settings: draft.settings,
        selectedVersionId: draft.selectedVersion.id,
      })
      set({ draft: saved, isSaving: false })
      return saved
    } catch (error) {
      set({ isSaving: false, error: error instanceof Error ? error : new Error(String(error)) })
      return null
    }
  },
  remove: async () => {
    const documentId = get().documentId
    if (!documentId) return
    set({ isDeleting: true, error: null })
    try {
      await DocumentApi.remove(documentId)
      set({ draft: null, isDeleting: false })
    } catch (error) {
      set({ isDeleting: false, error: error instanceof Error ? error : new Error(String(error)) })
    }
  },
  reload: async () => {
    const { documentId, draft } = get()
    if (documentId) await get().load(documentId, draft?.selectedVersion.id)
  },
}))
