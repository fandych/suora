import type { StateCreator } from 'zustand'
import { deleteSessionFromDisk, saveSessionToDisk } from '@/services/sessionFiles'
import type { AppStore } from '@/store/appStore'

export type SessionSlice = Pick<
  AppStore,
  | 'sessions'
  | 'activeSessionId'
  | 'openSessionTabs'
  | 'addSession'
  | 'updateSession'
  | 'removeSession'
  | 'setActiveSession'
  | 'openSessionTab'
  | 'closeSessionTab'
>

const sessionSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleSessionSave(get: () => AppStore, sessionId: string): void {
  const existingTimer = sessionSaveTimers.get(sessionId)
  if (existingTimer) clearTimeout(existingTimer)

  sessionSaveTimers.set(
    sessionId,
    setTimeout(() => {
      sessionSaveTimers.delete(sessionId)
      const { sessions, workspacePath, autoSave } = get()
      if (!workspacePath || !autoSave) return

      const session = sessions.find((entry) => entry.id === sessionId)
      if (session) saveSessionToDisk(workspacePath, session)
    }, 500),
  )
}

function cancelSessionSave(sessionId: string): void {
  const existingTimer = sessionSaveTimers.get(sessionId)
  if (!existingTimer) return

  clearTimeout(existingTimer)
  sessionSaveTimers.delete(sessionId)
}

export const createSessionSlice: StateCreator<AppStore, [], [], SessionSlice> = (set, get) => ({
  sessions: [],
  activeSessionId: null,
  openSessionTabs: [],
  addSession: (session) => {
    set((state) => ({
      sessions: [session, ...state.sessions],
      activeSessionId: session.id,
      openSessionTabs: state.openSessionTabs.includes(session.id)
        ? state.openSessionTabs
        : [...state.openSessionTabs, session.id],
    }))
    scheduleSessionSave(get, session.id)
  },
  updateSession: (id, data) => {
    set((state) => ({
      sessions: state.sessions.map((session) => (
        session.id === id ? { ...session, ...data, updatedAt: Date.now() } : session
      )),
    }))
    scheduleSessionSave(get, id)
  },
  removeSession: (id) => {
    cancelSessionSave(id)
    set((state) => {
      const remainingTabs = state.openSessionTabs.filter((tabId) => tabId !== id)
      const remainingSessions = state.sessions.filter((session) => session.id !== id)
      let nextActiveSessionId = state.activeSessionId

      if (state.activeSessionId === id) {
        const removedTabIndex = state.openSessionTabs.indexOf(id)
        nextActiveSessionId = remainingTabs[Math.min(removedTabIndex, remainingTabs.length - 1)]
          ?? (remainingSessions[0]?.id ?? null)
      }

      return {
        sessions: remainingSessions,
        openSessionTabs: remainingTabs,
        activeSessionId: nextActiveSessionId,
      }
    })

    const { workspacePath } = get()
    if (workspacePath) deleteSessionFromDisk(workspacePath, id)
  },
  setActiveSession: (id) => {
    set((state) => ({
      activeSessionId: id,
      openSessionTabs: id && !state.openSessionTabs.includes(id)
        ? [...state.openSessionTabs, id]
        : state.openSessionTabs,
    }))
  },
  openSessionTab: (id) => {
    set((state) => ({
      activeSessionId: id,
      openSessionTabs: state.openSessionTabs.includes(id)
        ? state.openSessionTabs
        : [...state.openSessionTabs, id],
    }))
  },
  closeSessionTab: (id) => {
    set((state) => {
      const remainingTabs = state.openSessionTabs.filter((tabId) => tabId !== id)
      let nextActiveSessionId = state.activeSessionId

      if (state.activeSessionId === id) {
        const removedTabIndex = state.openSessionTabs.indexOf(id)
        nextActiveSessionId = remainingTabs[Math.min(removedTabIndex, remainingTabs.length - 1)] ?? null
      }

      return {
        openSessionTabs: remainingTabs,
        activeSessionId: nextActiveSessionId,
      }
    })
  },
})
