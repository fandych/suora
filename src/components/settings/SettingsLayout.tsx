import { useParams, useNavigate } from 'react-router-dom'
import { SidePanel } from '@/components/layout/SidePanel'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { useResizablePanel } from '@/hooks/useResizablePanel'
import { ICON_DATA, IconifyIcon } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import { GeneralSettings } from './GeneralSettings'
import { SecuritySettings } from './SecuritySettings'
import { VoiceSettings } from './VoiceSettings'
import { ShortcutsSettings } from './ShortcutsSettings'
import { DataSettings } from './DataSettings'
import { LogsSettings } from './LogsSettings'
import { SystemSettings } from './SystemSettings'

const SETTING_SECTIONS = [
  { id: 'general', i18nKey: 'settings.general', fallback: 'General', icon: 'settings-general' },
  { id: 'security', i18nKey: 'settings.security', fallback: 'Security', icon: 'settings-security' },
  { id: 'voice', i18nKey: 'settings.voice', fallback: 'Voice', icon: 'settings-voice' },
  { id: 'shortcuts', i18nKey: 'settings.shortcuts', fallback: 'Shortcuts', icon: 'settings-shortcuts' },
  { id: 'data', i18nKey: 'settings.data', fallback: 'Data', icon: 'settings-data' },
  { id: 'logs', i18nKey: 'settings.logs', fallback: 'Logs', icon: 'settings-logs' },
  { id: 'system', i18nKey: 'settings.system', fallback: 'System', icon: 'settings-performance' },
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

export function SettingsLayout() {
  const { t } = useI18n()
  const [panelWidth, setPanelWidth] = useResizablePanel('settings', 280)
  const { section } = useParams<{ section: string }>()
  const navigate = useNavigate()
  const activeSection = section && SECTION_COMPONENTS[section] ? section : 'general'
  const ActiveComponent = SECTION_COMPONENTS[activeSection]
  const sectionMeta = SETTING_SECTIONS.find((s) => s.id === activeSection)

  return (
    <>
      <SidePanel title={t('settings.title', 'Settings')} width={panelWidth}>
        <div className="p-2 space-y-0.5">
          {SETTING_SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/settings/${s.id}`)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-all duration-200 ${
                activeSection === s.id
                  ? 'bg-accent/10 text-text-primary shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.15)]'
                  : 'text-text-secondary hover:bg-surface-3/60 hover:text-text-primary'
              }`}
            >
              <span>{ICON_DATA[s.icon] ? <IconifyIcon name={s.icon} size={16} /> : s.icon}</span>
              <span>{t(s.i18nKey, s.fallback)}</span>
            </button>
          ))}
        </div>
      </SidePanel>
      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={200} maxWidth={480} />

      <div className="flex-1 p-8 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-8 text-text-primary">
          {t(sectionMeta?.i18nKey ?? '', sectionMeta?.fallback)} {t('settings.title', 'Settings')}
        </h2>
        <ActiveComponent />
      </div>
    </>
  )
}
