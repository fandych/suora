import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'

const FONT_SIZE_MAP = {
  small: '13px',
  medium: '14px',
  large: '16px',
} as const

const CODE_FONT_MAP: Record<string, string> = {
  default: "'Menlo', 'Monaco', 'Courier New', monospace",
  'fira-code': "'Fira Code', 'Menlo', monospace",
  'jetbrains-mono': "'JetBrains Mono', 'Menlo', monospace",
  'source-code-pro': "'Source Code Pro', 'Menlo', monospace",
  'cascadia-code': "'Cascadia Code', 'Menlo', monospace",
  consolas: "'Consolas', 'Menlo', monospace",
}

const ACCENT_PRESETS: Record<string, { accent: string; hover: string; glow: string; soft: string; secondary: string; rgb: string }> = {
  // 'default' → use CSS-defined enterprise AI palette (no override)
  sapphire:  { accent: '#3B82F6', hover: '#60A5FA', glow: 'rgba(59,130,246,0.24)',  soft: 'rgba(59,130,246,0.10)',  secondary: '#93C5FD', rgb: '59,130,246' },
  emerald:   { accent: '#007F8F', hover: '#009DA8', glow: 'rgba(0,127,143,0.16)',   soft: 'rgba(0,127,143,0.085)',   secondary: '#B7791F', rgb: '0,127,143' },
  amethyst:  { accent: '#A855F7', hover: '#C084FC', glow: 'rgba(168,85,247,0.24)',  soft: 'rgba(168,85,247,0.10)',  secondary: '#D8B4FE', rgb: '168,85,247' },
  coral:     { accent: '#FB7252', hover: '#FF8A6D', glow: 'rgba(251,114,82,0.24)',  soft: 'rgba(251,114,82,0.10)',  secondary: '#FFA891', rgb: '251,114,82' },
  rose:      { accent: '#F43F85', hover: '#F65F9E', glow: 'rgba(244,63,133,0.24)',  soft: 'rgba(244,63,133,0.10)',  secondary: '#F9A8C8', rgb: '244,63,133' },
  jade:      { accent: '#14B8A6', hover: '#2DD4BF', glow: 'rgba(20,184,166,0.24)',  soft: 'rgba(20,184,166,0.10)',  secondary: '#5EEAD4', rgb: '20,184,166' },
  crimson:   { accent: '#EF4444', hover: '#F87171', glow: 'rgba(239,68,68,0.24)',   soft: 'rgba(239,68,68,0.10)',   secondary: '#FCA5A5', rgb: '239,68,68' },
  copper:    { accent: '#EA8C3A', hover: '#F6A056', glow: 'rgba(234,140,58,0.24)',  soft: 'rgba(234,140,58,0.10)',  secondary: '#F6B888', rgb: '234,140,58' },
  arctic:    { accent: '#22B8E6', hover: '#3ECEF9', glow: 'rgba(34,184,230,0.24)',  soft: 'rgba(34,184,230,0.10)',  secondary: '#7EDAF4', rgb: '34,184,230' },
  slate:     { accent: '#7A8DB2', hover: '#8DA0C7', glow: 'rgba(122,141,178,0.22)', soft: 'rgba(122,141,178,0.10)', secondary: '#AFBFD5', rgb: '122,141,178' },
}

export function useTheme() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const fontSize = useAppStore((s) => s.fontSize)
  const codeFont = useAppStore((s) => s.codeFont)
  const accentColor = useAppStore((s) => s.accentColor)

  useEffect(() => {
    const root = document.documentElement

    const apply = (isDark: boolean) => {
      root.classList.toggle('light', !isDark)
    }

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches)
      const handler = (e: MediaQueryListEvent) => apply(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }

    apply(theme === 'dark')
  }, [theme])

  // Apply font size to root element
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZE_MAP[fontSize] || FONT_SIZE_MAP.medium
  }, [fontSize])

  // Apply code font CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--font-code',
      CODE_FONT_MAP[codeFont] || CODE_FONT_MAP.default,
    )
  }, [codeFont])

  // Apply custom accent color
  useEffect(() => {
    const root = document.documentElement
    const preset = ACCENT_PRESETS[accentColor]
    if (!preset) {
      // 'default' — remove overrides, fall back to CSS-defined values
      ;['--t-accent', '--t-accent-hover', '--t-accent-glow', '--t-accent-soft', '--t-accent-secondary', '--t-accent-rgb'].forEach((p) =>
        root.style.removeProperty(p),
      )
      return
    }
    root.style.setProperty('--t-accent', preset.accent)
    root.style.setProperty('--t-accent-hover', preset.hover)
    root.style.setProperty('--t-accent-glow', preset.glow)
    root.style.setProperty('--t-accent-soft', preset.soft)
    root.style.setProperty('--t-accent-secondary', preset.secondary)
    root.style.setProperty('--t-accent-rgb', preset.rgb)
  }, [accentColor])

  return { theme, setTheme }
}
