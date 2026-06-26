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
import { Checkbox } from '@/components/catalyst-ui/checkbox'
import { Button as UiButton } from '@/components/catalyst-ui/button'
import { Input as UiInput, Select as UiSelect } from '@/components/catalyst-ui/form-controls'
import type { AppLocale, BubbleStyle, CodeFont, FontSize, ThemeMode } from '@/types'
import { ACCENT_PRESETS, type AccentColorId } from '@/theme/accentPresets'

const ACCENT_SWATCH_STYLES = {
  default: { fill: 'bg-[#0024D3]', ring: 'ring-[#0024D3]/45' },
  amber: { fill: ACCENT_PRESETS.amber.swatchFill, ring: ACCENT_PRESETS.amber.swatchRing },
  sapphire: { fill: ACCENT_PRESETS.sapphire.swatchFill, ring: ACCENT_PRESETS.sapphire.swatchRing },
  emerald: { fill: ACCENT_PRESETS.emerald.swatchFill, ring: ACCENT_PRESETS.emerald.swatchRing },
  amethyst: { fill: ACCENT_PRESETS.amethyst.swatchFill, ring: ACCENT_PRESETS.amethyst.swatchRing },
  coral: { fill: ACCENT_PRESETS.coral.swatchFill, ring: ACCENT_PRESETS.coral.swatchRing },
  rose: { fill: ACCENT_PRESETS.rose.swatchFill, ring: ACCENT_PRESETS.rose.swatchRing },
  jade: { fill: ACCENT_PRESETS.jade.swatchFill, ring: ACCENT_PRESETS.jade.swatchRing },
  crimson: { fill: ACCENT_PRESETS.crimson.swatchFill, ring: ACCENT_PRESETS.crimson.swatchRing },
  copper: { fill: ACCENT_PRESETS.copper.swatchFill, ring: ACCENT_PRESETS.copper.swatchRing },
  arctic: { fill: ACCENT_PRESETS.arctic.swatchFill, ring: ACCENT_PRESETS.arctic.swatchRing },
  slate: { fill: ACCENT_PRESETS.slate.swatchFill, ring: ACCENT_PRESETS.slate.swatchRing },
} as const

const THEME_OPTION_STYLES: Record<ThemeMode, string> = {
  dark: 'border-slate-700/80 bg-[linear-gradient(160deg,#08121d,#13253a)]',
  light: 'border-slate-300/90 bg-[linear-gradient(160deg,#ffffff,#e9f0f7)]',
  system: 'border-border-subtle/65 bg-[linear-gradient(90deg,#0b1622_0%,#0f2033_49%,#eef3f7_51%,#ffffff_100%)]',
}

function ThemePreview({ mode }: { mode: ThemeMode }) {
  if (mode === 'system') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[14px] border border-slate-700/70 bg-[linear-gradient(160deg,#08121d,#13253a)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-100/90" />
            <span className="h-1.5 w-5 rounded-full bg-slate-100/20" />
          </div>
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-slate-100/16" />
            <div className="h-6 rounded-xl border border-white/8 bg-white/7" />
            <div className="h-3 w-7 rounded-full bg-accent/75" />
          </div>
        </div>
        <div className="rounded-[14px] border border-slate-300/90 bg-[linear-gradient(160deg,#ffffff,#e9f0f7)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-700/80" />
            <span className="h-1.5 w-5 rounded-full bg-slate-500/30" />
          </div>
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-slate-400/18" />
            <div className="h-6 rounded-xl border border-slate-300/85 bg-white/95" />
            <div className="h-3 w-7 rounded-full bg-accent/75" />
          </div>
        </div>
      </div>
    )
  }

  const isDark = mode === 'dark'

  return (
    <div className={`rounded-[16px] border p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${THEME_OPTION_STYLES[mode]}`}>
      <div className="mb-2 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${isDark ? 'bg-slate-100/90' : 'bg-slate-700/80'}`} />
        <span className={`h-1.5 w-7 rounded-full ${isDark ? 'bg-slate-100/20' : 'bg-slate-500/30'}`} />
      </div>
      <div className="grid grid-cols-[1.1fr_0.9fr] gap-2">
        <div className="space-y-1.5">
          <div className={`h-2 rounded-full ${isDark ? 'bg-slate-100/16' : 'bg-slate-400/18'}`} />
          <div className={`h-6 rounded-xl border ${isDark ? 'border-white/8 bg-white/7' : 'border-slate-300/85 bg-white/95'}`} />
          <div className="h-3 w-9 rounded-full bg-accent/75" />
        </div>
        <div className={`rounded-xl border p-2 ${isDark ? 'border-white/8 bg-black/14' : 'border-slate-300/80 bg-slate-100/90'}`}>
          <div className={`h-full rounded-lg ${isDark ? 'bg-white/6' : 'bg-white/92'}`} />
        </div>
      </div>
    </div>
  )
}

const LOCALE_VALUES: AppLocale[] = ['en', 'zh']

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
          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted/55">{t('settings.endpoint', 'Endpoint')}</div>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.protocol', 'Protocol')}</label>
                <UiSelect
                  value={proxySettings.type}
                  onChange={(e) => setProxySettings({ type: e.target.value as 'http' | 'https' | 'socks5' })}
                  aria-label={t('settings.protocol', 'Protocol')}
                  wrapperClassName="w-full"
                >
                  <option value="http">{t('settings.protocolHttp')}</option>
                  <option value="https">{t('settings.protocolHttps')}</option>
                  <option value="socks5">{t('settings.protocolSocks5')}</option>
                </UiSelect>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.host', 'Host')}</label>
                <UiInput
                  value={proxySettings.host}
                  onChange={(e) => setProxySettings({ host: e.target.value })}
                  placeholder="127.0.0.1"
                  wrapperClassName="w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.port', 'Port')}</label>
                <UiInput
                  type="number"
                  value={proxySettings.port || ''}
                  onChange={(e) => setProxySettings({ port: parseInt(e.target.value, 10) || 0 })}
                  placeholder="7890"
                  wrapperClassName="w-full"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3 space-y-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted/55">{t('settings.credentials', 'Credentials')}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.usernameOptional', 'Username (optional)')}</label>
                <UiInput
                  value={proxySettings.username || ''}
                  onChange={(e) => setProxySettings({ username: e.target.value })}
                  aria-label={t('settings.usernameOptional', 'Username (optional)')}
                  wrapperClassName="w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.passwordOptional', 'Password (optional)')}</label>
                <UiInput
                  type="password"
                  value={proxySettings.password || ''}
                  onChange={(e) => setProxySettings({ password: e.target.value })}
                  aria-label={t('settings.passwordOptional', 'Password (optional)')}
                  wrapperClassName="w-full"
                />
              </div>
            </div>

            {proxySettings.host && proxySettings.port > 0 ? (
              <div className="rounded-md border border-border-subtle bg-surface-2/55 p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.proxyUrl', 'Proxy URL')}</div>
                <code className="mt-2 block wrap-break-word text-[12px] text-accent">{proxySettings.type}://{proxySettings.host}:{proxySettings.port}</code>
              </div>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{t('settings.proxyHint', 'Set host and port to preview the resolved endpoint and apply it consistently across the app.')}</p>
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
          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3 space-y-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted/55">{t('settings.deliveryPath', 'Delivery Path')}</div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.smtpHost', 'SMTP Host')}</label>
                <UiInput
                  type="text"
                  value={emailConfig.smtpHost}
                  onChange={(e) => setEmailConfig({ smtpHost: e.target.value })}
                  placeholder="smtp.gmail.com"
                  wrapperClassName="w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.smtpPort', 'SMTP Port')}</label>
                <UiInput
                  type="number"
                  value={emailConfig.smtpPort}
                  onChange={(e) => setEmailConfig({ smtpPort: parseInt(e.target.value, 10) || 587 })}
                  title={t('settings.smtpPort', 'SMTP Port')}
                  wrapperClassName="w-full"
                />
              </div>
              <label className="rounded-md border border-border-subtle bg-surface-2/55 p-3 flex items-center gap-3 self-end cursor-pointer">
                <Checkbox
                  checked={emailConfig.secure}
                  onChange={(value) => setEmailConfig({ secure: value })}
                  color="blue"
                />
                <span className="text-sm text-text-secondary">{t('settings.useTls', 'Use TLS')}</span>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.username', 'Username')}</label>
                <UiInput
                  type="text"
                  value={emailConfig.username}
                  onChange={(e) => setEmailConfig({ username: e.target.value })}
                  placeholder="your@email.com"
                  wrapperClassName="w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.password', 'Password / App Password')}</label>
                <UiInput
                  type="password"
                  value={emailConfig.password}
                  onChange={(e) => setEmailConfig({ password: e.target.value })}
                  placeholder="••••••••"
                  wrapperClassName="w-full"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3 space-y-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted/55">{t('settings.identity', 'Identity')}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.fromName', 'From Name')}</label>
                <UiInput
                  type="text"
                  value={emailConfig.fromName}
                  onChange={(e) => setEmailConfig({ fromName: e.target.value })}
                  placeholder="Suora"
                  wrapperClassName="w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.fromAddress', 'From Address')}</label>
                <UiInput
                  type="email"
                  value={emailConfig.fromAddress}
                  onChange={(e) => setEmailConfig({ fromAddress: e.target.value })}
                  placeholder="assistant@example.com"
                  wrapperClassName="w-full"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <UiButton
                type="button"
                onClick={async () => {
                  setEmailTestStatus('testing')
                  setEmailTestError('')
                  try {
                    const electron = getElectron()
                    if (!electron) throw new Error(t('settings.electronUnavailable', 'Electron not available'))

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
                      setEmailTestError(result.error || t('settings.connectionFailed', 'Connection failed'))
                    }
                  } catch (err) {
                    setEmailTestStatus('error')
                    setEmailTestError(err instanceof Error ? err.message : String(err))
                  }
                }}
                disabled={emailTestStatus === 'testing' || !emailConfig.smtpHost}
                color="blue"
              >
                {emailTestStatus === 'testing' ? t('settings.testing', 'Testing...') : t('settings.testConnection', 'Test Connection')}
              </UiButton>

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
  const accentOptions: ReadonlyArray<{ value: AccentColorId; label: string }> = [
    { value: 'default', label: t('settings.accentDefault', 'Workbench Blue') },
    { value: 'amber', label: t('settings.accentAmber', 'Amber') },
    { value: 'sapphire', label: t('settings.accentSapphire', 'Sapphire') },
    { value: 'emerald', label: t('settings.accentEmerald', 'Emerald') },
    { value: 'amethyst', label: t('settings.accentAmethyst', 'Amethyst') },
    { value: 'coral', label: t('settings.accentCoral', 'Coral') },
    { value: 'rose', label: t('settings.accentRose', 'Rose') },
    { value: 'jade', label: t('settings.accentJade', 'Jade') },
    { value: 'crimson', label: t('settings.accentCrimson', 'Crimson') },
    { value: 'copper', label: t('settings.accentCopper', 'Copper') },
    { value: 'arctic', label: t('settings.accentArctic', 'Arctic') },
    { value: 'slate', label: t('settings.accentSlate', 'Slate') },
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

  const activeAccent = accentOptions.find((option) => option.value === accentColor)?.label || t('settings.accentDefault', 'Workbench Blue')
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
