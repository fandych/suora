import { create } from "zustand"

type SidebarState = {
  isCollapsed: boolean
  mobileOpen: boolean
  setCollapsed: (value: boolean) => void
  setMobileOpen: (value: boolean) => void
  toggleCollapsed: () => void
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isCollapsed: false,
  mobileOpen: false,
  setCollapsed: (isCollapsed) => set({ isCollapsed }),
  setMobileOpen: (mobileOpen) => set({ mobileOpen }),
  toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
}))