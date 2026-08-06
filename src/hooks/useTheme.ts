import { useEffect } from 'react'
import { useTheme as useNextTheme } from 'next-themes'
import { useAppStore } from '@/store/appStore'
import { ACCENT_PRESETS, isAccentPreset } from '@/theme/accentPresets'

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

export function useTheme() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const { setTheme: applyTheme } = useNextTheme()
  const fontSize = useAppStore((s) => s.fontSize)
  const codeFont = useAppStore((s) => s.codeFont)
  const accentColor = useAppStore((s) => s.accentColor)

  useEffect(() => {
    applyTheme(theme)
  }, [applyTheme, theme])

  useEffect(() => {
    if (theme !== 'system') return

    const root = document.documentElement
    if (typeof window.matchMedia !== 'function') {
      root.classList.remove('dark')
      root.classList.add('light')
      return
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
    root.classList.toggle('light', !prefersDark)
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
    if (!isAccentPreset(accentColor)) {
      root.style.setProperty('--t-accent', '#0024D3')
      root.style.setProperty('--t-accent-hover', '#2346DF')
      root.style.setProperty('--t-accent-glow', 'rgba(0, 36, 211, 0.22)')
      root.style.setProperty('--t-accent-soft', 'rgba(0, 36, 211, 0.10)')
      root.style.setProperty('--t-accent-secondary', '#6D85FF')
      root.style.setProperty('--t-accent-rgb', '0, 36, 211')
      return
    }
    const preset = ACCENT_PRESETS[accentColor]
    root.style.setProperty('--t-accent', preset.accent)
    root.style.setProperty('--t-accent-hover', preset.hover)
    root.style.setProperty('--t-accent-glow', preset.glow)
    root.style.setProperty('--t-accent-soft', preset.soft)
    root.style.setProperty('--t-accent-secondary', preset.secondary)
    root.style.setProperty('--t-accent-rgb', preset.rgb)
  }, [accentColor])

  return { theme, setTheme }
}
