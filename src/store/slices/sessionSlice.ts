import type { StateCreator } from 'zustand'
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

export const createSessionSlice: StateCreator<AppStore, [], [], SessionSlice> = (set) => ({
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
  },
  updateSession: (id, data) => {
    set((state) => ({
      sessions: state.sessions.map((session) => (
        session.id === id ? { ...session, ...data, updatedAt: Date.now() } : session
      )),
    }))
  },
  removeSession: (id) => {
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
