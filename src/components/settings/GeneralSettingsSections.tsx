import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { getElectron } from './shared'
import { SettingsToggleRow } from './panelUi'
import { Checkbox } from '@/components/shared/checkbox'
import { Button as UiButton } from '@/components/shared/button'
import { Input as UiInput, Select as UiSelect } from '@/components/shared/form-controls'
import type { ThemeMode } from '@/types'
import { ACCENT_PRESETS } from '@/theme/accentPresets'

export const ACCENT_SWATCH_STYLES = {
  default: { fill: 'bg-[#0024d3]', ring: 'ring-[#0024d3]/45' },
  'strong-blue': { fill: ACCENT_PRESETS['strong-blue'].swatchFill, ring: ACCENT_PRESETS['strong-blue'].swatchRing },
  'tango-pink': { fill: ACCENT_PRESETS['tango-pink'].swatchFill, ring: ACCENT_PRESETS['tango-pink'].swatchRing },
  'dark-tangerine': { fill: ACCENT_PRESETS['dark-tangerine'].swatchFill, ring: ACCENT_PRESETS['dark-tangerine'].swatchRing },
  'lemon-curry': { fill: ACCENT_PRESETS['lemon-curry'].swatchFill, ring: ACCENT_PRESETS['lemon-curry'].swatchRing },
  'persian-green': { fill: ACCENT_PRESETS['persian-green'].swatchFill, ring: ACCENT_PRESETS['persian-green'].swatchRing },
  turquoise: { fill: ACCENT_PRESETS.turquoise.swatchFill, ring: ACCENT_PRESETS.turquoise.swatchRing },
  'skyline-blue': { fill: ACCENT_PRESETS['skyline-blue'].swatchFill, ring: ACCENT_PRESETS['skyline-blue'].swatchRing },
  'oceanic-teal': { fill: ACCENT_PRESETS['oceanic-teal'].swatchFill, ring: ACCENT_PRESETS['oceanic-teal'].swatchRing },
  'rose-taupe': { fill: ACCENT_PRESETS['rose-taupe'].swatchFill, ring: ACCENT_PRESETS['rose-taupe'].swatchRing },
} as const

const THEME_OPTION_STYLES: Record<ThemeMode, string> = {
  dark: 'border-[#41454b] bg-[linear-gradient(155deg,#111827,#1f2937)]',
  light: 'border-[#cbced4] bg-[linear-gradient(155deg,#ffffff,#f0f1f3)]',
  system: 'border-border-subtle/65 bg-[linear-gradient(90deg,#111827_0%,#1f2937_49%,#f0f1f3_51%,#ffffff_100%)]',
}

export function ThemePreview({ mode }: { mode: ThemeMode }) {
  if (mode === 'system') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-[#41454b] bg-[linear-gradient(155deg,#111827,#1f2937)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f3f4f6]" />
            <span className="h-1.5 w-5 rounded-full bg-[#f3f4f6]/20" />
          </div>
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-[#f3f4f6]/16" />
            <div className="h-6 rounded-xl border border-white/8 bg-white/7" />
            <div className="h-3 w-7 rounded-full bg-accent/75" />
          </div>
        </div>
        <div className="rounded-md border border-[#cbced4] bg-[linear-gradient(155deg,#ffffff,#f0f1f3)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#111827]" />
            <span className="h-1.5 w-5 rounded-full bg-[#4b5563]/30" />
          </div>
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-[#4b5563]/18" />
            <div className="h-6 rounded-xl border border-[#cbced4] bg-[#ffffff]" />
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
        <span className={`h-1.5 w-1.5 rounded-full ${isDark ? 'bg-[#f3f4f6]' : 'bg-[#111827]'}`} />
        <span className={`h-1.5 w-7 rounded-full ${isDark ? 'bg-[#f3f4f6]/20' : 'bg-[#4b5563]/30'}`} />
      </div>
      <div className="grid grid-cols-[1.1fr_0.9fr] gap-2">
        <div className="space-y-1.5">
          <div className={`h-2 rounded-full ${isDark ? 'bg-[#f3f4f6]/16' : 'bg-[#4b5563]/18'}`} />
          <div className={`h-6 rounded-xl border ${isDark ? 'border-white/8 bg-white/7' : 'border-[#cbced4] bg-[#ffffff]'}`} />
          <div className="h-3 w-9 rounded-full bg-accent/75" />
        </div>
        <div className={`rounded-xl border p-2 ${isDark ? 'border-white/8 bg-black/14' : 'border-[#cbced4] bg-[#f0f1f3]'}`}>
          <div className={`h-full rounded-lg ${isDark ? 'bg-white/6' : 'bg-[#ffffff]'}`} />
        </div>
      </div>
    </div>
  )
}

export function AutoStartToggle() {
  const { t } = useI18n()
  const [autoStart, setAutoStart] = useState(false)
  const [loading, setLoading] = useState(true)
  const electron = getElectron()

  useEffect(() => {
    if (!electron) { setLoading(false); return }
    electron.invoke('app:getAutoStart')
      .then((result) => {
        const resolved = result as { enabled?: boolean }
        setAutoStart(resolved.enabled ?? false)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [electron])

  const toggle = async () => {
    if (!electron) return
    const next = !autoStart
    const result = await electron.invoke('app:setAutoStart', next) as { success?: boolean }
    if (result.success) setAutoStart(next)
  }

  if (!electron) return null
  return (
    <SettingsToggleRow
      label={t('settings.launchOnStartup', 'Launch on system startup')}
      description={t('settings.launchOnStartupDesc', 'Automatically start Suora when you log in.')}
      checked={autoStart}
      onChange={() => { if (!loading) void toggle() }}
    />
  )
}

export function ProxySection() {
  const { t } = useI18n()
  const { proxySettings, setProxySettings } = useAppStore()
  const electron = getElectron()

  useEffect(() => {
    if (!electron) return
    void electron.invoke('workspace:setProxySettings', proxySettings)
  }, [electron, proxySettings])

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
                <UiSelect value={proxySettings.type} onChange={(e) => setProxySettings({ type: e.target.value as 'http' | 'https' | 'socks5' })} aria-label={t('settings.protocol', 'Protocol')} wrapperClassName="w-full">
                  <option value="http">{t('settings.protocolHttp')}</option>
                  <option value="https">{t('settings.protocolHttps')}</option>
                  <option value="socks5">{t('settings.protocolSocks5')}</option>
                </UiSelect>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.host', 'Host')}</label>
                <UiInput value={proxySettings.host} onChange={(e) => setProxySettings({ host: e.target.value })} placeholder="127.0.0.1" wrapperClassName="w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.port', 'Port')}</label>
                <UiInput type="number" value={proxySettings.port || ''} onChange={(e) => setProxySettings({ port: parseInt(e.target.value, 10) || 0 })} placeholder="7890" wrapperClassName="w-full" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3 space-y-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted/55">{t('settings.credentials', 'Credentials')}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.usernameOptional', 'Username (optional)')}</label>
                <UiInput value={proxySettings.username || ''} onChange={(e) => setProxySettings({ username: e.target.value })} aria-label={t('settings.usernameOptional', 'Username (optional)')} wrapperClassName="w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.passwordOptional', 'Password (optional)')}</label>
                <UiInput type="password" value={proxySettings.password || ''} onChange={(e) => setProxySettings({ password: e.target.value })} aria-label={t('settings.passwordOptional', 'Password (optional)')} wrapperClassName="w-full" />
              </div>
            </div>
            {proxySettings.host && proxySettings.port > 0 ? (
              <div className="rounded-md border border-border-subtle bg-surface-2/55 p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('settings.proxyUrl', 'Proxy URL')}</div>
                <code className="mt-2 block wrap-break-word text-[12px] text-accent">{proxySettings.type}://{proxySettings.host}:{proxySettings.port}</code>
              </div>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{t('settings.proxyHint', 'Set host and port to preview the resolved endpoint.')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function EmailSection() {
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
                <UiInput type="text" value={emailConfig.smtpHost} onChange={(e) => setEmailConfig({ smtpHost: e.target.value })} placeholder="smtp.gmail.com" wrapperClassName="w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.smtpPort', 'SMTP Port')}</label>
                <UiInput type="number" value={emailConfig.smtpPort} onChange={(e) => setEmailConfig({ smtpPort: parseInt(e.target.value, 10) || 587 })} title={t('settings.smtpPort', 'SMTP Port')} wrapperClassName="w-full" />
              </div>
              <label className="rounded-md border border-border-subtle bg-surface-2/55 p-3 flex items-center gap-3 self-end cursor-pointer">
                <Checkbox checked={emailConfig.secure} onChange={(value) => setEmailConfig({ secure: value })} color="blue" />
                <span className="text-sm text-text-secondary">{t('settings.useTls', 'Use TLS')}</span>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.username', 'Username')}</label>
                <UiInput type="text" value={emailConfig.username} onChange={(e) => setEmailConfig({ username: e.target.value })} placeholder="your@email.com" wrapperClassName="w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.password', 'Password / App Password')}</label>
                <UiInput type="password" value={emailConfig.password} onChange={(e) => setEmailConfig({ password: e.target.value })} placeholder="••••••••" wrapperClassName="w-full" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface-0/45 p-3 space-y-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted/55">{t('settings.identity', 'Identity')}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.fromName', 'From Name')}</label>
                <UiInput type="text" value={emailConfig.fromName} onChange={(e) => setEmailConfig({ fromName: e.target.value })} placeholder="Suora" wrapperClassName="w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{t('settings.fromAddress', 'From Address')}</label>
                <UiInput type="email" value={emailConfig.fromAddress} onChange={(e) => setEmailConfig({ fromAddress: e.target.value })} placeholder="assistant@example.com" wrapperClassName="w-full" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <UiButton type="button" onClick={async () => {
                setEmailTestStatus('testing'); setEmailTestError('')
                try {
                  const electron = getElectron()
                  if (!electron) throw new Error(t('settings.electronUnavailable', 'Electron not available'))
                  const result = await electron.invoke('email:test', {
                    smtpHost: emailConfig.smtpHost, smtpPort: emailConfig.smtpPort,
                    secure: emailConfig.secure, username: emailConfig.username,
                    password: emailConfig.password, fromName: emailConfig.fromName,
                    fromAddress: emailConfig.fromAddress,
                  }) as { success: boolean; error?: string }
                  if (result.success) { setEmailTestStatus('success') }
                  else { setEmailTestStatus('error'); setEmailTestError(result.error || t('settings.connectionFailed', 'Connection failed')) }
                } catch (err) {
                  setEmailTestStatus('error')
                  setEmailTestError(err instanceof Error ? err.message : String(err))
                }
              }} disabled={emailTestStatus === 'testing' || !emailConfig.smtpHost} color="blue">
                {emailTestStatus === 'testing' ? t('settings.testing', 'Testing...') : t('settings.testConnection', 'Test Connection')}
              </UiButton>
              {emailTestStatus === 'success' && <span className="inline-flex items-center gap-1.5 text-xs text-green-500"><IconifyIcon name="ui-check" size={12} color="currentColor" />{t('settings.connectionSuccess', 'Connection successful')}</span>}
              {emailTestStatus === 'error' && <span className="inline-flex items-center gap-1.5 text-xs text-red-500"><IconifyIcon name="ui-cross" size={12} color="currentColor" />{emailTestError}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
