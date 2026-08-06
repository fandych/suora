import { useEffect, useState } from 'react'
import { useAppStore, saveSettingsToWorkspace } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { getElectron } from './shared'
import {
  SettingsOverview,
  SettingsSection,
  SettingsStat,
  SettingsToggleRow,
} from './panelUi'
import { Button as UiButton } from '@/components/shared/button'
import { Select as UiSelect, Input as UiInput } from '@/components/shared/form-controls'
import type { AppLocale, BubbleStyle, CodeFont, FontSize, ThemeMode } from '@/types'
import { type AccentColorId } from '@/theme/accentPresets'
import {
  ACCENT_SWATCH_STYLES,
  ThemePreview,
  AutoStartToggle,
  ProxySection,
  EmailSection,
} from './GeneralSettingsSections'
const LOCALE_VALUES: AppLocale[] = ['en', 'zh']

export function GeneralSettings() {
  const { t } = useI18n()
  const {
    theme,
    setTheme,
    locale,
    setLocale,
    workspacePath,
    setWorkspacePath,
    autoSave,
    setAutoSave,
    fontSize,
    setFontSize,
    codeFont,
    setCodeFont,
    bubbleStyle,
    setBubbleStyle,
    accentColor,
    setAccentColor,
    proxySettings,
    emailConfig,
  } = useAppStore()
  const [saved, setSaved] = useState(false)
  const accentOptions: ReadonlyArray<{ value: AccentColorId; label: string }> = [
    { value: 'strong-blue', label: t('settings.accentStrongBlue', 'Strong Blue') },
    { value: 'tango-pink', label: t('settings.accentTangoPink', 'Tango Pink') },
    { value: 'dark-tangerine', label: t('settings.accentDarkTangerine', 'Dark Tangerine') },
    { value: 'lemon-curry', label: t('settings.accentLemonCurry', 'Lemon Curry') },
    { value: 'persian-green', label: t('settings.accentPersianGreen', 'Persian Green') },
    { value: 'turquoise', label: t('settings.accentTurquoise', 'Turquoise') },
    { value: 'skyline-blue', label: t('settings.accentSkylineBlue', 'Skyline Blue') },
    { value: 'oceanic-teal', label: t('settings.accentOceanicTeal', 'Oceanic Teal') },
    { value: 'rose-taupe', label: t('settings.accentRoseTaupe', 'Rose Taupe') },
  ]
  const localeLabels: Record<AppLocale, string> = {
    en: t('settings.localeEnglish', 'English'),
    zh: t('settings.localeChinese', '中文'),
  }

  useEffect(() => {
    const electron = getElectron()
    if (!workspacePath && electron) {
      electron.invoke('system:getDefaultWorkspacePath').then((defaultPath) => {
        setWorkspacePath(defaultPath as string)
        void electron.invoke('system:ensureDirectory', defaultPath)
      })
    }
  }, [workspacePath, setWorkspacePath])

  const activeAccent = accentOptions.find((option) => option.value === accentColor)?.label || t('settings.accentStrongBlue', 'Strong Blue')
  const themeLabel = theme === 'dark'
    ? t('settings.dark', 'Dark')
    : theme === 'light'
      ? t('settings.light', 'Light')
      : t('settings.system', 'System')

  return (
    <div className="space-y-6">
      <SettingsOverview
        description={t('settings.generalWorkbenchDesc', 'Set the visual baseline, language, storage path, and outbound connectivity defaults that shape every other page in the app.')}
        statsClassName="grid gap-2 sm:grid-cols-2 xl:w-md xl:grid-cols-4"
        stats={(
          <>
            <SettingsStat label={t('settings.theme', 'Theme')} value={themeLabel} accent />
            <SettingsStat label={t('settings.language', 'Language')} value={localeLabels[locale]} />
            <SettingsStat label={t('settings.accentColor', 'Accent')} value={activeAccent} />
            <SettingsStat label={t('settings.email', 'Email')} value={emailConfig.enabled ? t('common.enabled', 'Enabled') : t('common.off', 'Off')} />
          </>
        )}
      />

      <SettingsSection
        eyebrow={t('settings.appearance', 'Appearance')}
        title={t('settings.interfaceTone', 'Interface Tone')}
        description={t('settings.interfaceToneDesc', 'Choose the app mood, highlight color, and reading defaults so every workspace starts from a consistent visual language.')}
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.95fr)]">
          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3">
            <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.theme', 'Theme')}</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(['dark', 'light', 'system'] as ThemeMode[]).map((mode) => (
                <UiButton
                  key={mode}
                  unstyled
                  type="button"
                  onClick={() => setTheme(mode)}
                  className={`flex flex-col items-stretch gap-3 rounded-[22px] border bg-surface-0/72 p-3 text-left text-sm font-medium text-text-secondary transition-all hover:border-accent/18 hover:bg-surface-0/88 ${theme === mode ? 'scale-[1.01] border-accent/40 text-text-primary shadow-[0_10px_24px_rgba(var(--t-accent-rgb),0.12)] ring-2 ring-accent/15' : 'border-border-subtle/55'}`}
                >
                  <ThemePreview mode={mode} />
                  <span className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2">
                      {mode === 'dark' ? <IconifyIcon name="ui-moon" size={14} color="currentColor" /> : mode === 'light' ? <IconifyIcon name="ui-sun" size={14} color="currentColor" /> : <IconifyIcon name="ui-computer" size={14} color="currentColor" />}
                      {mode === 'dark' ? t('settings.dark', 'Dark') : mode === 'light' ? t('settings.light', 'Light') : t('settings.system', 'System')}
                    </span>
                    {theme === mode && <IconifyIcon name="ui-check" size={14} color="currentColor" />}
                  </span>
                </UiButton>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3">
            <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.accentColor', 'Accent Color')}</label>
            <div className="flex flex-wrap gap-2.5">
              {accentOptions.map((option) => (
                <UiButton
                  key={option.value}
                  unstyled
                  type="button"
                  onClick={() => setAccentColor(option.value)}
                  title={option.label}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 bg-surface-0/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all ${accentColor === option.value ? `border-text-primary scale-110 shadow-lg ring-2 ring-offset-2 ring-offset-surface-0 ${ACCENT_SWATCH_STYLES[option.value].ring}` : 'border-border-subtle/35 hover:scale-105 hover:border-border-subtle/70'}`}
                  aria-label={t('settings.accentColorAria', 'Accent color: {name}').replace('{name}', option.label)}
                >
                  <span className={`block h-full w-full rounded-full ${ACCENT_SWATCH_STYLES[option.value].fill}`} aria-hidden="true" />
                  {accentColor === option.value && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute inset-0 m-auto">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </UiButton>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{t('settings.accentHint', 'This accent color is reused by navigation rails, stats, and form focus states across the workbench.')}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3">
            <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.fontSize', 'Font Size')}</label>
            <UiSelect
              aria-label={t('settings.fontSize', 'Font Size')}
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value as FontSize)}
              wrapperClassName="w-full"
            >
              <option value="small">{t('settings.fontSizeSmall', 'Small')}</option>
              <option value="medium">{t('settings.fontSizeMedium', 'Medium')}</option>
              <option value="large">{t('settings.fontSizeLarge', 'Large')}</option>
            </UiSelect>
          </div>

          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3">
            <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.codeFont', 'Code Font')}</label>
            <UiSelect
              aria-label={t('settings.codeFont', 'Code Font')}
              value={codeFont}
              onChange={(e) => setCodeFont(e.target.value as CodeFont)}
              wrapperClassName="w-full"
            >
              <option value="default">{t('settings.codeFontDefault', 'System Default')}</option>
              <option value="fira-code">Fira Code</option>
              <option value="jetbrains-mono">JetBrains Mono</option>
              <option value="source-code-pro">Source Code Pro</option>
              <option value="cascadia-code">Cascadia Code</option>
              <option value="consolas">Consolas</option>
            </UiSelect>
          </div>

          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3">
            <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.bubbleStyle', 'Bubble Style')}</label>
            <UiSelect
              aria-label={t('settings.bubbleStyle', 'Bubble Style')}
              value={bubbleStyle}
              onChange={(e) => setBubbleStyle(e.target.value as BubbleStyle)}
              wrapperClassName="w-full"
            >
              <option value="default">{t('settings.bubbleDefault', 'Default')}</option>
              <option value="minimal">{t('settings.bubbleMinimal', 'Minimal')}</option>
              <option value="bordered">{t('settings.bubbleBordered', 'Bordered')}</option>
              <option value="glassmorphism">{t('settings.bubbleGlass', 'Glass')}</option>
            </UiSelect>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.language', 'Language')}
        title={t('settings.regionAndLocalization', 'Region & Localization')}
        description={t('settings.regionAndLocalizationDesc', 'Choose the primary app language used by navigation, settings, and system messaging across the desktop shell.')}
      >
        <div className="max-w-md">
          <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.language', 'Language')}</label>
          <UiSelect
            aria-label={t('settings.language', 'Language')}
            value={locale}
            onChange={(e) => setLocale(e.target.value as AppLocale)}
            wrapperClassName="w-full"
          >
            {LOCALE_VALUES.map((value) => (
              <option key={value} value={value}>{localeLabels[value]}</option>
            ))}
          </UiSelect>
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.storageBehavior', 'Storage & Behavior')}
        title={t('settings.workspaceDefaults', 'Workspace Defaults')}
        description={t('settings.workspaceDefaultsDesc', 'Point Suora at the right workspace directory and decide how aggressively it saves and boots itself in the background.')}
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,1fr)]">
          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3 space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.workspaceDir', 'Workspace Directory')}</label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <UiInput
                  value={workspacePath}
                  onChange={(e) => setWorkspacePath(e.target.value)}
                  placeholder="~/.suora"
                  wrapperClassName="flex-1"
                />
                <UiButton
                  type="button"
                  onClick={() => {
                    const electron = getElectron()
                    if (workspacePath && electron) {
                      void electron.invoke('system:ensureDirectory', workspacePath)
                    }
                  }}
                  color="blue"
                >
                  {t('settings.apply', 'Apply')}
                </UiButton>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{t('settings.workspaceDirDesc', 'Agent memory, logs, plugin files, and pipeline snapshots are stored here.')}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SettingsToggleRow
                label={t('settings.autoSave', 'Auto-save Conversations')}
                description={t('settings.autoSaveDesc', 'Persist session updates to disk while you chat so workspaces survive restarts cleanly.')}
                checked={autoSave}
                onChange={() => setAutoSave(!autoSave)}
              />
              <AutoStartToggle />
            </div>
          </div>

          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3 grid gap-3 sm:grid-cols-2">
            <SettingsStat label={t('settings.theme', 'Theme')} value={themeLabel} accent />
            <SettingsStat label={t('settings.language', 'Language')} value={localeLabels[locale]} />
            <SettingsStat label={t('settings.proxy', 'Proxy')} value={proxySettings.enabled ? t('common.enabled', 'Enabled') : t('common.off', 'Off')} />
            <SettingsStat label={t('settings.autoSave', 'Auto-save')} value={autoSave ? t('common.enabled', 'Enabled') : t('common.off', 'Off')} />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.proxy', 'Proxy / Network')}
        title={t('settings.networkRouting', 'Network Routing')}
        description={t('settings.networkRoutingDesc', 'Define how outbound requests should travel when you work behind a local gateway, SOCKS tunnel, or company proxy.')}
      >
        <ProxySection />
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.email', 'Email')}
        title={t('settings.outboundIdentity', 'Outbound Identity')}
        description={t('settings.outboundIdentityDesc', 'Set the SMTP account used for reports, alerts, and future channel automations that need a verified sender.')}
      >
        <EmailSection />
      </SettingsSection>

      <SettingsSection
        eyebrow={t('common.actions', 'Actions')}
        title={t('settings.commitSettings', 'Commit Settings')}
        description={t('settings.commitSettingsDesc', 'Write the current preferences to the workspace so the same defaults come back on the next launch.')}
        action={saved ? <span className="inline-flex items-center gap-1.5 text-sm text-green-500"><IconifyIcon name="ui-check" size={14} color="currentColor" /> {t('settings.saved', 'Settings saved')}</span> : null}
      >
        <div className="flex flex-wrap gap-3">
          <UiButton
            type="button"
            onClick={async () => {
              const ok = await saveSettingsToWorkspace()
              if (!ok) return
              setSaved(true)
              setTimeout(() => setSaved(false), 2000)
            }}
            color="blue"
          >
            {saved ? t('settings.saved', 'Settings saved') : t('settings.save', 'Save')}
          </UiButton>
          <UiButton
            type="button"
            onClick={() => {
              const electron = getElectron()
              if (workspacePath && electron) {
                void electron.invoke('system:ensureDirectory', workspacePath)
              }
            }}
            outline
          >
            {t('settings.verifyWorkspace', 'Verify Workspace Path')}
          </UiButton>
        </div>
      </SettingsSection>
    </div>
  )
}
