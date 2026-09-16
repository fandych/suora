import type { PreferenceFontScale, PreferenceThemeAccent } from "@/types/preference"

export const THEME_ACCENTS: Record<
  PreferenceThemeAccent,
  { primary: string; primaryForeground: string; accent: string; sidebarPrimary: string; ring: string }
> = {
  ocean: {
    primary: "oklch(0.57 0.18 246)",
    primaryForeground: "oklch(0.98 0.01 247)",
    accent: "oklch(0.57 0.18 246)",
    sidebarPrimary: "oklch(0.6 0.17 246)",
    ring: "oklch(0.71 0.09 242)",
  },
  forest: {
    primary: "oklch(0.62 0.16 156)",
    primaryForeground: "oklch(0.99 0.01 156)",
    accent: "oklch(0.62 0.16 156)",
    sidebarPrimary: "oklch(0.58 0.15 156)",
    ring: "oklch(0.75 0.08 160)",
  },
  amber: {
    primary: "oklch(0.72 0.16 78)",
    primaryForeground: "oklch(0.22 0.03 68)",
    accent: "oklch(0.72 0.16 78)",
    sidebarPrimary: "oklch(0.68 0.15 78)",
    ring: "oklch(0.8 0.08 78)",
  },
  rose: {
    primary: "oklch(0.64 0.19 18)",
    primaryForeground: "oklch(0.98 0.01 18)",
    accent: "oklch(0.64 0.19 18)",
    sidebarPrimary: "oklch(0.61 0.18 18)",
    ring: "oklch(0.76 0.08 18)",
  },
  slate: {
    primary: "oklch(0.49 0.05 244)",
    primaryForeground: "oklch(0.98 0.01 244)",
    accent: "oklch(0.49 0.05 244)",
    sidebarPrimary: "oklch(0.53 0.05 244)",
    ring: "oklch(0.69 0.03 244)",
  },
}

export const FONT_SCALE_MAP: Record<PreferenceFontScale, string> = { sm: "0.9375", md: "1", lg: "1.0625" }
