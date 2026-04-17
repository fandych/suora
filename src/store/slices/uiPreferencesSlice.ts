import type { StateCreator } from 'zustand'
import type { BubbleStyle, CodeFont, FontSize, ThemeMode } from '@/types'
import type { AppStore } from '@/store/appStore'

export type UIPreferencesSlice = Pick<
  AppStore,
  | 'activeModule'
  | 'setActiveModule'
  | 'theme'
  | 'setTheme'
  | 'fontSize'
  | 'setFontSize'
  | 'codeFont'
  | 'setCodeFont'
  | 'bubbleStyle'
  | 'setBubbleStyle'
  | 'historyRetentionDays'
  | 'setHistoryRetentionDays'
  | 'autoSave'
  | 'setAutoSave'
  | 'accentColor'
  | 'setAccentColor'
  | 'shortcuts'
  | 'setShortcut'
  | 'resetShortcuts'
>

export const DEFAULT_SHORTCUTS: Record<string, string> = {
  'New Chat': 'Ctrl + N',
  Search: 'Ctrl + K',
  'Send Message': 'Enter',
  'New Line': 'Shift + Enter',
  'Voice Input': 'Ctrl + Shift + V',
  'Toggle Sidebar': 'Ctrl + B',
  'Close Panel': 'Escape',
}

export const createUIPreferencesSlice: StateCreator<AppStore, [], [], UIPreferencesSlice> = (set) => ({
  activeModule: 'chat',
  setActiveModule: (module) => set({ activeModule: module }),
  theme: 'dark' as ThemeMode,
  setTheme: (mode) => set({ theme: mode }),
  fontSize: 'medium' as FontSize,
  setFontSize: (size) => set({ fontSize: size }),
  codeFont: 'default' as CodeFont,
  setCodeFont: (font) => set({ codeFont: font }),
  bubbleStyle: 'default' as BubbleStyle,
  setBubbleStyle: (style) => set({ bubbleStyle: style }),
  historyRetentionDays: 0,
  setHistoryRetentionDays: (days) => set({ historyRetentionDays: days }),
  autoSave: true,
  setAutoSave: (enabled) => set({ autoSave: enabled }),
  accentColor: 'default',
  setAccentColor: (color) => set({ accentColor: color }),
  shortcuts: { ...DEFAULT_SHORTCUTS },
  setShortcut: (action, shortcut) => set((state) => ({
    shortcuts: { ...state.shortcuts, [action]: shortcut },
  })),
  resetShortcuts: () => set({ shortcuts: { ...DEFAULT_SHORTCUTS } }),
})
