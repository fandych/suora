import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'

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

function SummaryStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-3xl border px-4 py-3 ${accent ? 'border-accent/18 bg-accent/10' : 'border-border-subtle/55 bg-surface-0/60'}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</div>
    </div>
  )
}

function buildShortcutMonogram(action: string) {
  return action
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function getShortcutDescription(action: string, t: (key: string, defaultValue?: string) => string) {
  switch (action) {
    case 'New Chat':
      return t('settings.shortcutNewChatDesc', 'Start a fresh conversation from anywhere in the app.')
    case 'Search':
      return t('settings.shortcutSearchDesc', 'Open the command palette and navigate without reaching for the mouse.')
    case 'Send Message':
      return t('settings.shortcutSendDesc', 'Submit the current prompt in chat or test conversations.')
    case 'New Line':
      return t('settings.shortcutNewLineDesc', 'Insert a line break without triggering send.')
    case 'Voice Input':
      return t('settings.shortcutVoiceDesc', 'Toggle speech-to-text capture for the active composer.')
    case 'Toggle Sidebar':
      return t('settings.shortcutSidebarDesc', 'Collapse or reopen the current left navigation rail.')
    case 'Close Panel':
      return t('settings.shortcutClosePanelDesc', 'Exit the active panel or cancel an in-progress capture.')
    default:
      return t('settings.shortcutGenericDesc', 'Trigger this desktop action from the keyboard.')
  }
}

export function ShortcutsSettings() {
  const { t } = useI18n()
  const { shortcuts, setShortcut, resetShortcuts } = useAppStore()
  const [recording, setRecording] = useState<string | null>(null)
  const [recordedKeys, setRecordedKeys] = useState<string>('')
  const shortcutEntries = Object.entries(shortcuts)

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
    <div className="space-y-6">
      <section className="rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)] xl:p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('settings.shortcuts', 'Shortcuts')}</div>
            <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{t('settings.keyboardBindings', 'Keyboard Bindings')}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-text-secondary/80">{t('settings.shortcutsDesc', 'Click a shortcut to record a new key binding. Press Escape to cancel.')}</p>
            {recording && <span className="mt-4 inline-flex rounded-full bg-accent/10 px-3 py-1 text-[11px] font-medium text-accent">{t('settings.recordingShortcut', 'Recording')}: {recording}</span>}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-[24rem] xl:grid-cols-1">
            <SummaryStat label={t('settings.bindings', 'Bindings')} value={String(shortcutEntries.length)} accent />
            <SummaryStat label={t('settings.recording', 'Recording')} value={recording || t('settings.idle', 'Idle')} />
            <button
              type="button"
              onClick={resetShortcuts}
              className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 px-4 py-3 text-left transition-colors hover:border-accent/20 hover:bg-accent/8"
            >
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.resetAll', 'Reset All')}</div>
              <div className="mt-2 text-sm font-semibold text-text-primary">{t('settings.restoreDefaults', 'Restore Defaults')}</div>
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)] xl:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('settings.commandMap', 'Command Map')}</div>
            <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{t('settings.activeBindings', 'Active Bindings')}</h3>
          </div>
          <div className="rounded-full bg-surface-0/70 px-3 py-1 text-[11px] text-text-secondary">{t('settings.escapeCancels', 'Escape cancels capture')}</div>
        </div>

        <div className="space-y-3">
          {shortcutEntries.map(([action, shortcut]) => {
            const isRecording = recording === action
            return (
              <div key={action} className={`rounded-3xl border px-4 py-4 transition-all ${isRecording ? 'border-accent/20 bg-accent/10 shadow-[0_10px_24px_rgba(var(--t-accent-rgb),0.06)]' : 'border-border-subtle/55 bg-surface-0/60'}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${isRecording ? 'border-accent/22 bg-accent/12 text-accent' : 'border-border-subtle/45 bg-surface-2/80 text-text-secondary'} text-xs font-semibold`}>
                      {buildShortcutMonogram(action)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold text-text-primary">{action}</div>
                      <p className="mt-1 text-[12px] leading-relaxed text-text-secondary/78">{getShortcutDescription(action, t)}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setRecording(action); setRecordedKeys('') }}
                    className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-[JetBrains_Mono,monospace] transition-all ${isRecording ? 'bg-accent/15 border-accent/50 text-accent animate-pulse' : 'bg-surface-2 border-border text-text-muted hover:border-accent/30 hover:text-text-secondary'}`}
                  >
                    <IconifyIcon name="settings-shortcuts" size={14} color="currentColor" />
                    {isRecording ? (recordedKeys || t('settings.pressKeys', 'Press keys...')) : shortcut}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
