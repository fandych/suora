import { useParams, useNavigate } from 'react-router-dom'
import { SidePanel } from '@/components/layout/SidePanel'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { useResizablePanel } from '@/hooks/useResizablePanel'
import { ICON_DATA, IconifyIcon } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import { useAppStore } from '@/store/appStore'
import { GeneralSettings } from './GeneralSettings'
import { SecuritySettings } from './SecuritySettings'
import { VoiceSettings } from './VoiceSettings'
import { ShortcutsSettings } from './ShortcutsSettings'
import { DataSettings } from './DataSettings'
import { LogsSettings } from './LogsSettings'
import { SystemSettings } from './SystemSettings'

const SETTING_SECTIONS = [
  { id: 'general', i18nKey: 'settings.general', fallback: 'General', icon: 'settings-general', descKey: 'settings.generalDesc', descFallback: 'Appearance, language, startup, and workspace defaults.' },
  { id: 'security', i18nKey: 'settings.security', fallback: 'Security', icon: 'settings-security', descKey: 'settings.securityDesc', descFallback: 'Keys, privacy, and safety defaults for the desktop workspace.' },
  { id: 'voice', i18nKey: 'settings.voice', fallback: 'Voice', icon: 'settings-voice', descKey: 'settings.voiceDesc', descFallback: 'Speech input, voice output, and audio behavior.' },
  { id: 'shortcuts', i18nKey: 'settings.shortcuts', fallback: 'Shortcuts', icon: 'settings-shortcuts', descKey: 'settings.shortcutsDescLong', descFallback: 'Keyboard bindings for chat, navigation, and panel control.' },
  { id: 'data', i18nKey: 'settings.data', fallback: 'Data', icon: 'settings-data', descKey: 'settings.dataDescLong', descFallback: 'Backups, imports, retention rules, and destructive cleanup actions.' },
  { id: 'logs', i18nKey: 'settings.logs', fallback: 'Logs', icon: 'settings-logs', descKey: 'settings.logsDesc', descFallback: 'Runtime diagnostics, log files, and crash evidence.' },
  { id: 'system', i18nKey: 'settings.system', fallback: 'System', icon: 'settings-performance', descKey: 'settings.systemDesc', descFallback: 'Onboarding, app health, and runtime performance metrics.' },
]

const SECTION_COMPONENTS: Record<string, React.ComponentType> = {
  general: GeneralSettings,
  security: SecuritySettings,
  voice: VoiceSettings,
  shortcuts: ShortcutsSettings,
  data: DataSettings,
  logs: LogsSettings,
  system: SystemSettings,
}

function SummaryStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-3xl border px-4 py-3 ${accent ? 'border-accent/18 bg-accent/10' : 'border-border-subtle/55 bg-surface-0/60'}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</div>
    </div>
  )
}

export function SettingsLayout() {
  const { t } = useI18n()
  const [panelWidth, setPanelWidth] = useResizablePanel('settings', 280)
  const { section } = useParams<{ section: string }>()
  const navigate = useNavigate()
  const { workspacePath } = useAppStore()
  const activeSection = section && SECTION_COMPONENTS[section] ? section : 'general'
  const ActiveComponent = SECTION_COMPONENTS[activeSection]
  const sectionMeta = SETTING_SECTIONS.find((s) => s.id === activeSection)
  const sectionIndex = Math.max(0, SETTING_SECTIONS.findIndex((s) => s.id === activeSection))

  return (
    <>
      <SidePanel title={t('settings.title', 'Settings')} width={panelWidth}>
        <div className="module-sidebar-stack px-3 pb-3 pt-1 space-y-3">
          <div className="rounded-3xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/92 to-surface-2/70 p-4 shadow-[0_14px_40px_rgba(var(--t-accent-rgb),0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/55">{t('settings.title', 'Settings')}</div>
                <div className="mt-1 text-[18px] font-semibold text-text-primary">{t('settings.controlCenter', 'Control Center')}</div>
                <p className="mt-1 text-[12px] leading-relaxed text-text-secondary/80">{t('settings.controlCenterHint', 'Tune the desktop experience, protect credentials, and keep local data under control.')}</p>
              </div>
              <div className="rounded-2xl border border-accent/15 bg-surface-0/70 px-3 py-2 text-right shadow-sm">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('common.total', 'Total')}</div>
                <div className="text-xl font-semibold text-text-primary tabular-nums">{SETTING_SECTIONS.length}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <SummaryStat label={t('settings.section', 'Section')} value={`${sectionIndex + 1}/${SETTING_SECTIONS.length}`} accent />
              <SummaryStat label={t('settings.active', 'Active')} value={t(sectionMeta?.i18nKey ?? '', sectionMeta?.fallback)} />
            </div>
          </div>

          <div className="space-y-2">
            {SETTING_SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/settings/${s.id}`)}
                className={`group w-full rounded-3xl border px-3.5 py-3 text-left transition-all duration-200 ${
                  activeSection === s.id
                    ? 'border-accent/20 bg-accent/10 text-text-primary shadow-[0_14px_34px_rgba(var(--t-accent-rgb),0.07)]'
                    : 'border-transparent bg-surface-1/20 text-text-secondary hover:bg-surface-3/55 hover:border-border-subtle/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-0/75 text-accent shadow-sm">
                    {ICON_DATA[s.icon] ? <IconifyIcon name={s.icon} size={16} /> : s.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-text-primary">{t(s.i18nKey, s.fallback)}</div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-text-secondary/78">{t(s.descKey, s.descFallback)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {workspacePath && (
            <div className="rounded-2xl border border-border-subtle/55 bg-surface-0/45 px-4 py-3 text-[11px] text-text-muted">
              <div>{workspacePath}</div>
            </div>
          )}
        </div>
      </SidePanel>
      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={224} maxWidth={360} />

      <div className="module-canvas flex-1 overflow-y-auto px-5 py-6 xl:px-8 xl:py-8">
        <div className="module-content mx-auto max-w-7xl space-y-6">
          <section className="rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-4xl border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]">
                  {sectionMeta?.icon && ICON_DATA[sectionMeta.icon] ? <IconifyIcon name={sectionMeta.icon} size={28} /> : <span className="text-xl font-semibold">{t(sectionMeta?.i18nKey ?? '', sectionMeta?.fallback).slice(0, 2)}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('settings.title', 'Settings')}</div>
                  <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-text-primary">{t(sectionMeta?.i18nKey ?? '', sectionMeta?.fallback)} {t('settings.title', 'Settings')}</h2>
                  <p className="mt-2 max-w-3xl text-[14px] leading-7 text-text-secondary/82">{t(sectionMeta?.descKey ?? '', sectionMeta?.descFallback)}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:w-[24rem] xl:grid-cols-1">
                <SummaryStat label={t('settings.section', 'Section')} value={`${sectionIndex + 1}/${SETTING_SECTIONS.length}`} accent />
                <SummaryStat label={t('settings.category', 'Category')} value={t('settings.preferences', 'Preferences')} />
                <SummaryStat label={t('settings.scope', 'Scope')} value={workspacePath ? t('settings.workspace', 'Workspace') : t('settings.local', 'Local')} />
              </div>
            </div>
          </section>

          <ActiveComponent />
        </div>
      </div>
    </>
  )
}
