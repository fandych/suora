import { useEffect, useState } from 'react'
import { useAppStore, saveSettingsToWorkspace } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { getElectron } from './shared'
import {
  SettingsSection,
  SettingsStat,
  SettingsToggleRow,
  settingsCheckboxClass,
  settingsFieldCardClass,
  settingsHintClass,
  settingsInputClass,
  settingsLabelClass,
  settingsPrimaryButtonClass,
  settingsSecondaryButtonClass,
  settingsSelectClass,
  settingsSoftButtonClass,
  settingsSurfaceCardClass,
} from './panelUi'
import type { AppLocale, BubbleStyle, CodeFont, FontSize, ThemeMode } from '@/types'

const ACCENT_SWATCH_STYLES = {
  default: { fill: 'bg-[#C99A2E]', ring: 'ring-[#C99A2E]/45' },
  sapphire: { fill: 'bg-[#3B7DD8]', ring: 'ring-[#3B7DD8]/45' },
  emerald: { fill: 'bg-[#2DA66E]', ring: 'ring-[#2DA66E]/45' },
  amethyst: { fill: 'bg-[#8B5CF6]', ring: 'ring-[#8B5CF6]/45' },
  coral: { fill: 'bg-[#E06848]', ring: 'ring-[#E06848]/45' },
  rose: { fill: 'bg-[#D44878]', ring: 'ring-[#D44878]/45' },
  jade: { fill: 'bg-[#1C9B8E]', ring: 'ring-[#1C9B8E]/45' },
  crimson: { fill: 'bg-[#CC3340]', ring: 'ring-[#CC3340]/45' },
  copper: { fill: 'bg-[#C07840]', ring: 'ring-[#C07840]/45' },
  arctic: { fill: 'bg-[#4AA8D0]', ring: 'ring-[#4AA8D0]/45' },
  slate: { fill: 'bg-[#6B7B99]', ring: 'ring-[#6B7B99]/45' },
} as const

const ACCENT_OPTIONS = [
  { value: 'default', label: 'Amber' },
  { value: 'sapphire', label: 'Sapphire' },
  { value: 'emerald', label: 'Emerald' },
  { value: 'amethyst', label: 'Amethyst' },
  { value: 'coral', label: 'Coral' },
  { value: 'rose', label: 'Rose' },
  { value: 'jade', label: 'Jade' },
  { value: 'crimson', label: 'Crimson' },
  { value: 'copper', label: 'Copper' },
  { value: 'arctic', label: 'Arctic' },
  { value: 'slate', label: 'Slate' },
] as const

const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português',
  ru: 'Русский',
  ar: 'العربية',
}

function AutoStartToggle() {
  const { t } = useI18n()
  const [autoStart, setAutoStart] = useState(false)
  const [loading, setLoading] = useState(true)
  const electron = getElectron()

  useEffect(() => {
    if (!electron) {
      setLoading(false)
      return
    }

    electron
      .invoke('app:getAutoStart')
      .then((result) => {
        const resolved = result as { enabled?: boolean }
        setAutoStart(resolved.enabled ?? false)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [electron])

  const toggle = async () => {
    if (!electron) return
    const nextValue = !autoStart
    const result = await electron.invoke('app:setAutoStart', nextValue) as { success?: boolean }
    if (result.success) setAutoStart(nextValue)
  }

  if (!electron) return null

  return (
    <SettingsToggleRow
      label={t('settings.launchOnStartup', 'Launch on system startup')}
      description={t('settings.launchOnStartupDesc', 'Automatically start Suora when you log in.')}
      checked={autoStart}
      onChange={() => {
        if (!loading) {
          void toggle()
        }
      }}
    />
  )
}

function ProxySection() {
  const { t } = useI18n()
  const { proxySettings, setProxySettings } = useAppStore()

  return (
    <div className="space-y-4">
      <SettingsToggleRow
        label={t('settings.httpProxy', 'HTTP Proxy')}
        description={t('settings.proxyDesc', 'Configure a network tunnel for API requests, channel callbacks, and plugin traffic.')}
        checked={proxySettings.enabled}
        onChange={() => setProxySettings({ enabled: !proxySettings.enabled })}
      />

      {proxySettings.enabled && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.95fr)]">
          <div className={settingsFieldCardClass}>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted/55">{t('settings.endpoint', 'Endpoint')}</div>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className={settingsLabelClass}>{t('settings.protocol', 'Protocol')}</label>
                <select
                  value={proxySettings.type}
                  onChange={(e) => setProxySettings({ type: e.target.value as 'http' | 'https' | 'socks5' })}
                  aria-label="Proxy protocol"
                  className={settingsSelectClass}
                >
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="socks5">SOCKS5</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={settingsLabelClass}>{t('settings.host', 'Host')}</label>
                <input
                  value={proxySettings.host}
                  onChange={(e) => setProxySettings({ host: e.target.value })}
                  placeholder="127.0.0.1"
                  className={settingsInputClass}
                />
              </div>
              <div>
                <label className={settingsLabelClass}>{t('settings.port', 'Port')}</label>
                <input
                  type="number"
                  value={proxySettings.port || ''}
                  onChange={(e) => setProxySettings({ port: parseInt(e.target.value, 10) || 0 })}
                  placeholder="7890"
                  className={settingsInputClass}
                />
              </div>
            </div>
          </div>

          <div className={`${settingsFieldCardClass} space-y-4`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted/55">{t('settings.credentials', 'Credentials')}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={settingsLabelClass}>{t('settings.usernameOptional', 'Username (optional)')}</label>
                <input
                  value={proxySettings.username || ''}
                  onChange={(e) => setProxySettings({ username: e.target.value })}
                  aria-label="Proxy username"
                  className={settingsInputClass}
                />
              </div>
              <div>
                <label className={settingsLabelClass}>{t('settings.passwordOptional', 'Password (optional)')}</label>
                <input
                  type="password"
                  value={proxySettings.password || ''}
                  onChange={(e) => setProxySettings({ password: e.target.value })}
                  aria-label="Proxy password"
                  className={settingsInputClass}
                />
              </div>
            </div>

            {proxySettings.host && proxySettings.port > 0 ? (
              <div className={settingsSurfaceCardClass}>
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.proxyUrl', 'Proxy URL')}</div>
                <code className="mt-2 block wrap-break-word text-[12px] text-accent">{proxySettings.type}://{proxySettings.host}:{proxySettings.port}</code>
              </div>
            ) : (
              <p className={settingsHintClass}>{t('settings.proxyHint', 'Set host and port to preview the resolved endpoint and apply it consistently across the app.')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function EmailSection() {
  const { t } = useI18n()
  const { emailConfig, setEmailConfig } = useAppStore()
  const [emailTestStatus, setEmailTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [emailTestError, setEmailTestError] = useState('')

  return (
    <div className="space-y-4">
      <SettingsToggleRow
        label={t('settings.enableEmail', 'Enable email sending')}
        description={t('settings.emailDesc', 'Configure SMTP so chat workflows, reports, and notifications can send from a trusted mailbox.')}
        checked={emailConfig.enabled}
        onChange={() => setEmailConfig({ enabled: !emailConfig.enabled })}
      />

      {emailConfig.enabled && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,1fr)]">
          <div className={`${settingsFieldCardClass} space-y-4`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted/55">{t('settings.deliveryPath', 'Delivery Path')}</div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className={settingsLabelClass}>{t('settings.smtpHost', 'SMTP Host')}</label>
                <input
                  type="text"
                  value={emailConfig.smtpHost}
                  onChange={(e) => setEmailConfig({ smtpHost: e.target.value })}
                  placeholder="smtp.gmail.com"
                  className={settingsInputClass}
                />
              </div>
              <div>
                <label className={settingsLabelClass}>{t('settings.smtpPort', 'SMTP Port')}</label>
                <input
                  type="number"
                  value={emailConfig.smtpPort}
                  onChange={(e) => setEmailConfig({ smtpPort: parseInt(e.target.value, 10) || 587 })}
                  title="SMTP Port"
                  className={settingsInputClass}
                />
              </div>
              <label className={`${settingsSurfaceCardClass} flex items-center gap-3 self-end cursor-pointer`}>
                <input
                  type="checkbox"
                  checked={emailConfig.secure}
                  onChange={(e) => setEmailConfig({ secure: e.target.checked })}
                  className={settingsCheckboxClass}
                  title="Use TLS"
                />
                <span className="text-sm text-text-secondary">{t('settings.useTls', 'Use TLS')}</span>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={settingsLabelClass}>{t('settings.username', 'Username')}</label>
                <input
                  type="text"
                  value={emailConfig.username}
                  onChange={(e) => setEmailConfig({ username: e.target.value })}
                  placeholder="your@email.com"
                  className={settingsInputClass}
                />
              </div>
              <div>
                <label className={settingsLabelClass}>{t('settings.password', 'Password / App Password')}</label>
                <input
                  type="password"
                  value={emailConfig.password}
                  onChange={(e) => setEmailConfig({ password: e.target.value })}
                  placeholder="••••••••"
                  className={settingsInputClass}
                />
              </div>
            </div>
          </div>

          <div className={`${settingsFieldCardClass} space-y-4`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted/55">{t('settings.identity', 'Identity')}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={settingsLabelClass}>{t('settings.fromName', 'From Name')}</label>
                <input
                  type="text"
                  value={emailConfig.fromName}
                  onChange={(e) => setEmailConfig({ fromName: e.target.value })}
                  placeholder="Suora"
                  className={settingsInputClass}
                />
              </div>
              <div>
                <label className={settingsLabelClass}>{t('settings.fromAddress', 'From Address')}</label>
                <input
                  type="email"
                  value={emailConfig.fromAddress}
                  onChange={(e) => setEmailConfig({ fromAddress: e.target.value })}
                  placeholder="assistant@example.com"
                  className={settingsInputClass}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  setEmailTestStatus('testing')
                  setEmailTestError('')
                  try {
                    const electron = getElectron()
                    if (!electron) throw new Error('Electron not available')

                    const result = await electron.invoke('email:test', {
                      smtpHost: emailConfig.smtpHost,
                      smtpPort: emailConfig.smtpPort,
                      secure: emailConfig.secure,
                      username: emailConfig.username,
                      password: emailConfig.password,
                      fromName: emailConfig.fromName,
                      fromAddress: emailConfig.fromAddress,
                    }) as { success: boolean; error?: string }

                    if (result.success) {
                      setEmailTestStatus('success')
                    } else {
                      setEmailTestStatus('error')
                      setEmailTestError(result.error || 'Connection failed')
                    }
                  } catch (err) {
                    setEmailTestStatus('error')
                    setEmailTestError(err instanceof Error ? err.message : String(err))
                  }
                }}
                disabled={emailTestStatus === 'testing' || !emailConfig.smtpHost}
                className={settingsSoftButtonClass}
              >
                {emailTestStatus === 'testing' ? t('settings.testing', 'Testing...') : t('settings.testConnection', 'Test Connection')}
              </button>

              {emailTestStatus === 'success' && (
                <span className="inline-flex items-center gap-1.5 text-xs text-green-500">
                  <IconifyIcon name="ui-check" size={12} color="currentColor" />
                  {t('settings.connectionSuccess', 'Connection successful')}
                </span>
              )}

              {emailTestStatus === 'error' && (
                <span className="inline-flex items-center gap-1.5 text-xs text-red-500">
                  <IconifyIcon name="ui-cross" size={12} color="currentColor" />
                  {emailTestError}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

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

  useEffect(() => {
    const electron = getElectron()
    if (!workspacePath && electron) {
      electron.invoke('system:getDefaultWorkspacePath').then((defaultPath) => {
        setWorkspacePath(defaultPath as string)
        void electron.invoke('system:ensureDirectory', defaultPath)
      })
    }
  }, [workspacePath, setWorkspacePath])

  const activeAccent = ACCENT_OPTIONS.find((option) => option.value === accentColor)?.label || 'Amber'
  const themeLabel = theme === 'dark'
    ? t('settings.dark', 'Dark')
    : theme === 'light'
      ? t('settings.light', 'Light')
      : t('settings.system', 'System')

  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('settings.general', 'General')}</div>
            <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-text-primary">{t('settings.generalWorkbench', 'Workspace Defaults')}</h2>
            <p className="mt-2 text-[14px] leading-7 text-text-secondary/82">
              {t('settings.generalWorkbenchDesc', 'Set the visual baseline, language, storage path, and outbound connectivity defaults that shape every other page in the app.')}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-md xl:grid-cols-4">
            <SettingsStat label={t('settings.theme', 'Theme')} value={themeLabel} accent />
            <SettingsStat label={t('settings.language', 'Language')} value={LOCALE_LABELS[locale]} />
            <SettingsStat label={t('settings.accentColor', 'Accent')} value={activeAccent} />
            <SettingsStat label={t('settings.email', 'Email')} value={emailConfig.enabled ? t('common.enabled', 'Enabled') : t('common.off', 'Off')} />
          </div>
        </div>
      </section>

      <SettingsSection
        eyebrow={t('settings.appearance', 'Appearance')}
        title={t('settings.interfaceTone', 'Interface Tone')}
        description={t('settings.interfaceToneDesc', 'Choose the app mood, highlight color, and reading defaults so every workspace starts from a consistent visual language.')}
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.95fr)]">
          <div className={settingsFieldCardClass}>
            <label className={settingsLabelClass}>{t('settings.theme', 'Theme')}</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(['dark', 'light', 'system'] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTheme(mode)}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-all ${theme === mode ? 'border-accent/25 bg-accent/12 text-accent shadow-[0_10px_24px_rgba(var(--t-accent-rgb),0.08)]' : 'border-border-subtle/55 bg-surface-0/70 text-text-secondary hover:border-accent/18 hover:bg-surface-0/90'}`}
                >
                  {mode === 'dark' ? <IconifyIcon name="ui-moon" size={14} color="currentColor" /> : mode === 'light' ? <IconifyIcon name="ui-sun" size={14} color="currentColor" /> : <IconifyIcon name="ui-computer" size={14} color="currentColor" />}
                  {mode === 'dark' ? t('settings.dark', 'Dark') : mode === 'light' ? t('settings.light', 'Light') : t('settings.system', 'System')}
                </button>
              ))}
            </div>
          </div>

          <div className={settingsFieldCardClass}>
            <label className={settingsLabelClass}>{t('settings.accentColor', 'Accent Color')}</label>
            <div className="flex flex-wrap gap-2.5">
              {ACCENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAccentColor(option.value)}
                  title={option.label}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${accentColor === option.value ? `border-text-primary scale-110 shadow-lg ring-2 ring-offset-2 ring-offset-surface-0 ${ACCENT_SWATCH_STYLES[option.value].ring}` : 'border-transparent hover:scale-105'}`}
                  aria-label={`Accent color: ${option.label}`}
                >
                  <span className={`block h-full w-full rounded-full ${ACCENT_SWATCH_STYLES[option.value].fill}`} aria-hidden="true" />
                  {accentColor === option.value && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute inset-0 m-auto">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <p className={settingsHintClass}>{t('settings.accentHint', 'This accent color is reused by navigation rails, stats, and form focus states across the workbench.')}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className={settingsFieldCardClass}>
            <label className={settingsLabelClass}>{t('settings.fontSize', 'Font Size')}</label>
            <select
              aria-label="Font size"
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value as FontSize)}
              className={settingsSelectClass}
            >
              <option value="small">{t('settings.fontSizeSmall', 'Small')}</option>
              <option value="medium">{t('settings.fontSizeMedium', 'Medium')}</option>
              <option value="large">{t('settings.fontSizeLarge', 'Large')}</option>
            </select>
          </div>

          <div className={settingsFieldCardClass}>
            <label className={settingsLabelClass}>{t('settings.codeFont', 'Code Font')}</label>
            <select
              aria-label="Code font"
              value={codeFont}
              onChange={(e) => setCodeFont(e.target.value as CodeFont)}
              className={settingsSelectClass}
            >
              <option value="default">{t('settings.codeFontDefault', 'System Default')}</option>
              <option value="fira-code">Fira Code</option>
              <option value="jetbrains-mono">JetBrains Mono</option>
              <option value="source-code-pro">Source Code Pro</option>
              <option value="cascadia-code">Cascadia Code</option>
              <option value="consolas">Consolas</option>
            </select>
          </div>

          <div className={settingsFieldCardClass}>
            <label className={settingsLabelClass}>{t('settings.bubbleStyle', 'Bubble Style')}</label>
            <select
              aria-label="Bubble style"
              value={bubbleStyle}
              onChange={(e) => setBubbleStyle(e.target.value as BubbleStyle)}
              className={settingsSelectClass}
            >
              <option value="default">{t('settings.bubbleDefault', 'Default')}</option>
              <option value="minimal">{t('settings.bubbleMinimal', 'Minimal')}</option>
              <option value="bordered">{t('settings.bubbleBordered', 'Bordered')}</option>
              <option value="glassmorphism">{t('settings.bubbleGlass', 'Glass')}</option>
            </select>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.language', 'Language')}
        title={t('settings.regionAndLocalization', 'Region & Localization')}
        description={t('settings.regionAndLocalizationDesc', 'Choose the primary app language used by navigation, settings, and system messaging across the desktop shell.')}
      >
        <div className="max-w-md">
          <label className={settingsLabelClass}>{t('settings.language', 'Language')}</label>
          <select
            aria-label="Language"
            value={locale}
            onChange={(e) => setLocale(e.target.value as AppLocale)}
            className={settingsSelectClass}
          >
            {Object.entries(LOCALE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow={t('settings.storageBehavior', 'Storage & Behavior')}
        title={t('settings.workspaceDefaults', 'Workspace Defaults')}
        description={t('settings.workspaceDefaultsDesc', 'Point Suora at the right workspace directory and decide how aggressively it saves and boots itself in the background.')}
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,1fr)]">
          <div className={`${settingsFieldCardClass} space-y-4`}>
            <div>
              <label className={settingsLabelClass}>{t('settings.workspaceDir', 'Workspace Directory')}</label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={workspacePath}
                  onChange={(e) => setWorkspacePath(e.target.value)}
                  placeholder="~/.suora"
                  className={`${settingsInputClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const electron = getElectron()
                    if (workspacePath && electron) {
                      void electron.invoke('system:ensureDirectory', workspacePath)
                    }
                  }}
                  className={settingsSoftButtonClass}
                >
                  {t('settings.apply', 'Apply')}
                </button>
              </div>
              <p className={settingsHintClass}>{t('settings.workspaceDirDesc', 'Agent memory, logs, plugin files, and pipeline snapshots are stored here.')}</p>
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

          <div className={`${settingsFieldCardClass} grid gap-3 sm:grid-cols-2`}>
            <SettingsStat label={t('settings.theme', 'Theme')} value={themeLabel} accent />
            <SettingsStat label={t('settings.language', 'Language')} value={LOCALE_LABELS[locale]} />
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
          <button
            type="button"
            onClick={async () => {
              const ok = await saveSettingsToWorkspace()
              if (!ok) return
              setSaved(true)
              setTimeout(() => setSaved(false), 2000)
            }}
            className={settingsPrimaryButtonClass}
          >
            {saved ? t('settings.saved', 'Settings saved') : t('settings.save', 'Save')}
          </button>
          <button
            type="button"
            onClick={() => {
              const electron = getElectron()
              if (workspacePath && electron) {
                void electron.invoke('system:ensureDirectory', workspacePath)
              }
            }}
            className={settingsSecondaryButtonClass}
          >
            {t('settings.verifyWorkspace', 'Verify Workspace Path')}
          </button>
        </div>
      </SettingsSection>
    </div>
  )
}