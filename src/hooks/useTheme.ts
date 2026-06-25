import { useEffect } from 'react'
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
  const fontSize = useAppStore((s) => s.fontSize)
  const codeFont = useAppStore((s) => s.codeFont)
  const accentColor = useAppStore((s) => s.accentColor)

  useEffect(() => {
    const root = document.documentElement

    const apply = (isDark: boolean) => {
      root.classList.toggle('light', !isDark)
    }

    if (theme === 'system') {
      if (typeof window.matchMedia !== 'function') {
        apply(false)
        return
      }

      let mq: MediaQueryList
      try {
        mq = window.matchMedia('(prefers-color-scheme: dark)')
      } catch {
        apply(false)
        return
      }

      apply(mq.matches)
      const handler = (e: MediaQueryListEvent) => apply(e.matches)

      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
      }

      if (typeof mq.addListener === 'function') {
        mq.addListener(handler)
        return () => mq.removeListener(handler)
      }

      return
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
    if (!isAccentPreset(accentColor)) {
      // 'default' — remove overrides, fall back to CSS-defined values
      ;['--t-accent', '--t-accent-hover', '--t-accent-glow', '--t-accent-soft', '--t-accent-secondary', '--t-accent-rgb'].forEach((p) =>
        root.style.removeProperty(p),
      )
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
