import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'

function formatKeyCombo(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  const key = e.key
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    parts.push(key.length === 1 ? key.toUpperCase() : key)
  }
  return parts.join(' + ')
}

export function ShortcutsSettings() {
  const { t } = useI18n()
  const { shortcuts, setShortcut, resetShortcuts } = useAppStore()
  const [recording, setRecording] = useState<string | null>(null)
  const [recordedKeys, setRecordedKeys] = useState<string>('')

  useEffect(() => {
    if (!recording) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const combo = formatKeyCombo(e)
      if (['Ctrl', 'Alt', 'Shift'].includes(combo)) return
      setRecordedKeys(combo)
      setShortcut(recording, combo)
      setRecording(null)
    }
    const cancel = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setRecording(null)
        setRecordedKeys('')
      }
    }
    window.addEventListener('keydown', handler)
    window.addEventListener('keydown', cancel)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('keydown', cancel)
    }
  }, [recording, setShortcut])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-text-muted">{t('settings.shortcutsDesc', 'Click a shortcut to record a new key binding. Press Escape to cancel.')}</p>
        <button
          onClick={resetShortcuts}
          className="text-[11px] text-text-muted hover:text-accent px-2 py-1 rounded-lg hover:bg-surface-3 transition-colors"
        >
          {t('settings.resetAll', 'Reset All')}
        </button>
      </div>
      {Object.entries(shortcuts).map(([action, shortcut]) => (
        <div key={action} className="flex items-center justify-between py-3 border-b border-border-subtle">
          <span className="text-sm text-text-secondary">{action}</span>
          <button
            onClick={() => { setRecording(action); setRecordedKeys('') }}
            className={`px-3 py-1.5 rounded-lg border text-xs font-[JetBrains_Mono,monospace] transition-all ${
              recording === action
                ? 'bg-accent/15 border-accent/50 text-accent animate-pulse'
                : 'bg-surface-2 border-border text-text-muted hover:border-accent/30 hover:text-text-secondary'
            }`}
          >
            {recording === action ? (recordedKeys || t('settings.pressKeys', 'Press keys...')) : shortcut}
          </button>
        </div>
      ))}
    </div>
  )
}
