import { useState, useEffect } from 'react'
import { useAppStore, saveSettingsToWorkspace } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { getElectron } from './shared'
import type { ThemeMode, FontSize, CodeFont, BubbleStyle } from '@/types'

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

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-border/50">
      <IconifyIcon name={icon} size={16} color="currentColor" />
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
    </div>
  )
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
        <p className="text-xs text-text-muted mt-0.5">{desc}</p>
      </div>
      <button
        onClick={onChange}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-accent' : 'bg-surface-3'}`}
        aria-label={`Toggle ${label}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'left-5.5' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

function AutoStartToggle() {
  const { t } = useI18n()
  const [autoStart, setAutoStart] = useState(false)
  const [loading, setLoading] = useState(true)
  const electron = getElectron()

  useEffect(() => {
    if (!electron) { setLoading(false); return }
    electron.invoke('app:getAutoStart').then((result) => {
      const r = result as { enabled?: boolean }
      setAutoStart(r.enabled ?? false)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const toggle = async () => {
    if (!electron) return
    const newValue = !autoStart
    const result = await electron.invoke('app:setAutoStart', newValue) as { success?: boolean }
    if (result.success) setAutoStart(newValue)
  }

  if (!electron) return null

  return (
    <ToggleRow
      label={t('settings.launchOnStartup', 'Launch on system startup')}
      desc={t('settings.launchOnStartupDesc', 'Automatically start Suora when you log in.')}
      checked={autoStart}
      onChange={() => { if (!loading) toggle() }}
    />
  )
}

function ProxySection() {
  const { t } = useI18n()
  const { proxySettings, setProxySettings } = useAppStore()

  return (
    <div className="space-y-4">
      <SectionHeader icon="settings-proxy" title={t('settings.proxy', 'Proxy / Network')} />
      <ToggleRow
        label={t('settings.httpProxy', 'HTTP Proxy')}
        desc={t('settings.proxyDesc', 'Configure proxy for API requests')}
        checked={proxySettings.enabled}
        onChange={() => setProxySettings({ enabled: !proxySettings.enabled })}
      />
      {proxySettings.enabled && (
        <div className="space-y-3 pl-0.5">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">{t('settings.protocol', 'Protocol')}</label>
              <select
                value={proxySettings.type}
                onChange={(e) => setProxySettings({ type: e.target.value as 'http' | 'https' | 'socks5' })}
                aria-label="Proxy protocol"
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
                <option value="socks5">SOCKS5</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">{t('settings.host', 'Host')}</label>
              <input value={proxySettings.host} onChange={(e) => setProxySettings({ host: e.target.value })} placeholder="127.0.0.1"
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">{t('settings.port', 'Port')}</label>
              <input type="number" value={proxySettings.port || ''} onChange={(e) => setProxySettings({ port: parseInt(e.target.value) || 0 })} placeholder="7890"
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">{t('settings.usernameOptional', 'Username (optional)')}</label>
              <input value={proxySettings.username || ''} onChange={(e) => setProxySettings({ username: e.target.value })} aria-label="Proxy username"
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">{t('settings.passwordOptional', 'Password (optional)')}</label>
              <input type="password" value={proxySettings.password || ''} onChange={(e) => setProxySettings({ password: e.target.value })} aria-label="Proxy password"
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
          </div>
          {proxySettings.host && proxySettings.port > 0 && (
            <p className="text-xs text-text-muted">
              {t('settings.proxyUrl', 'Proxy URL')}: <code className="text-accent">{proxySettings.type}://{proxySettings.host}:{proxySettings.port}</code>
            </p>
          )}
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
      <SectionHeader icon="settings-email" title={t('settings.email', 'Email')} />
      <ToggleRow
        label={t('settings.enableEmail', 'Enable email sending')}
        desc={t('settings.emailDesc', 'Configure SMTP for sending notifications and reports from chat.')}
        checked={emailConfig.enabled}
        onChange={() => setEmailConfig({ enabled: !emailConfig.enabled })}
      />
      {emailConfig.enabled && (
        <div className="space-y-3 pl-0.5">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">{t('settings.smtpHost', 'SMTP Host')}</label>
              <input type="text" value={emailConfig.smtpHost} onChange={(e) => setEmailConfig({ smtpHost: e.target.value })} placeholder="smtp.gmail.com"
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">{t('settings.smtpPort', 'SMTP Port')}</label>
              <input type="number" value={emailConfig.smtpPort} onChange={(e) => setEmailConfig({ smtpPort: parseInt(e.target.value) || 587 })} title="SMTP Port"
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={emailConfig.secure} onChange={(e) => setEmailConfig({ secure: e.target.checked })} className="w-4 h-4 rounded border-border text-accent focus:ring-accent/30 bg-surface-2" title="Use TLS" />
                <span className="text-sm text-text-secondary">{t('settings.useTls', 'Use TLS')}</span>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">{t('settings.username', 'Username')}</label>
              <input type="text" value={emailConfig.username} onChange={(e) => setEmailConfig({ username: e.target.value })} placeholder="your@email.com"
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">{t('settings.password', 'Password / App Password')}</label>
              <input type="password" value={emailConfig.password} onChange={(e) => setEmailConfig({ password: e.target.value })} placeholder="••••••••"
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">{t('settings.fromName', 'From Name')}</label>
              <input type="text" value={emailConfig.fromName} onChange={(e) => setEmailConfig({ fromName: e.target.value })} placeholder="Suora"
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">{t('settings.fromAddress', 'From Address')}</label>
              <input type="email" value={emailConfig.fromAddress} onChange={(e) => setEmailConfig({ fromAddress: e.target.value })} placeholder="assistant@example.com"
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                setEmailTestStatus('testing')
                setEmailTestError('')
                try {
                  const electron = getElectron()
                  if (!electron) throw new Error('Electron not available')
                  const result = await electron.invoke('email:test', {
                    smtpHost: emailConfig.smtpHost, smtpPort: emailConfig.smtpPort, secure: emailConfig.secure,
                    username: emailConfig.username, password: emailConfig.password, fromName: emailConfig.fromName, fromAddress: emailConfig.fromAddress,
                  }) as { success: boolean; error?: string }
                  if (result.success) setEmailTestStatus('success')
                  else { setEmailTestStatus('error'); setEmailTestError(result.error || 'Connection failed') }
                } catch (err) {
                  setEmailTestStatus('error')
                  setEmailTestError(err instanceof Error ? err.message : String(err))
                }
              }}
              disabled={emailTestStatus === 'testing' || !emailConfig.smtpHost}
              className="rounded-lg bg-accent/15 border border-accent/30 px-3 py-1.5 text-xs text-accent font-medium hover:bg-accent/25 disabled:opacity-50 transition-colors"
            >
              {emailTestStatus === 'testing' ? t('settings.testing', 'Testing...') : t('settings.testConnection', 'Test Connection')}
            </button>
            {emailTestStatus === 'success' && <span className="text-xs text-green-500 inline-flex items-center gap-1"><IconifyIcon name="ui-check" size={12} color="currentColor" /> {t('settings.connectionSuccess', 'Connection successful')}</span>}
            {emailTestStatus === 'error' && <span className="text-xs text-red-500 inline-flex items-center gap-1"><IconifyIcon name="ui-cross" size={12} color="currentColor" /> {emailTestError}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export function GeneralSettings() {
  const { t } = useI18n()
  const {
    theme, setTheme,
    locale, setLocale,
    workspacePath, setWorkspacePath,
    autoSave, setAutoSave,
    fontSize, setFontSize,
    codeFont, setCodeFont,
    bubbleStyle, setBubbleStyle,
    accentColor, setAccentColor,
  } = useAppStore()
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const electron = getElectron()
    if (!workspacePath && electron) {
      electron.invoke('system:getDefaultWorkspacePath').then((defaultPath) => {
        setWorkspacePath(defaultPath as string)
        electron.invoke('system:ensureDirectory', defaultPath)
      })
    }
  }, [workspacePath, setWorkspacePath])

  return (
    <div className="space-y-8">
      {/* ─── Appearance ─── */}
      <section className="space-y-4">
        <SectionHeader icon="settings-appearance" title={t('settings.appearance', 'Appearance')} />
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('settings.theme', 'Theme')}</label>
            <div className="grid grid-cols-3 gap-2">
              {(['dark', 'light', 'system'] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTheme(mode)}
                  className={`px-3 py-2.5 rounded-xl text-sm border capitalize transition-all inline-flex items-center gap-1.5 ${
                    theme === mode
                      ? 'bg-accent/15 border-accent/30 text-accent font-semibold'
                      : 'bg-surface-2 border-border text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {mode === 'dark' ? <><IconifyIcon name="ui-moon" size={14} color="currentColor" /> {t('settings.dark', 'Dark')}</> : mode === 'light' ? <><IconifyIcon name="ui-sun" size={14} color="currentColor" /> {t('settings.light', 'Light')}</> : <><IconifyIcon name="ui-computer" size={14} color="currentColor" /> {t('settings.system', 'System')}</>}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('settings.accentColor', 'Accent Color')}</label>
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'default', color: '#C99A2E', label: 'Amber' },
                { value: 'sapphire', color: '#3B7DD8', label: 'Sapphire' },
                { value: 'emerald', color: '#2DA66E', label: 'Emerald' },
                { value: 'amethyst', color: '#8B5CF6', label: 'Amethyst' },
                { value: 'coral', color: '#E06848', label: 'Coral' },
                { value: 'rose', color: '#D44878', label: 'Rose' },
                { value: 'jade', color: '#1C9B8E', label: 'Jade' },
                { value: 'crimson', color: '#CC3340', label: 'Crimson' },
                { value: 'copper', color: '#C07840', label: 'Copper' },
                { value: 'arctic', color: '#4AA8D0', label: 'Arctic' },
                { value: 'slate', color: '#6B7B99', label: 'Slate' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAccentColor(opt.value)}
                  title={opt.label}
                  className={`relative w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                    accentColor === opt.value
                      ? `border-text-primary scale-110 shadow-lg ring-2 ring-offset-2 ring-offset-surface-0 ${ACCENT_SWATCH_STYLES[opt.value].ring}`
                      : 'border-transparent hover:scale-105'
                  }`}
                  aria-label={`Accent color: ${opt.label}`}
                >
                  <span className={`block w-full h-full rounded-full ${ACCENT_SWATCH_STYLES[opt.value].fill}`} aria-hidden="true" />
                  {accentColor === opt.value && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="absolute inset-0 m-auto pointer-events-none"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('settings.fontSize', 'Font Size')}</label>
            <select
              aria-label="Font size"
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value as FontSize)}
              className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="small">{t('settings.fontSizeSmall', 'Small')}</option>
              <option value="medium">{t('settings.fontSizeMedium', 'Medium')}</option>
              <option value="large">{t('settings.fontSizeLarge', 'Large')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('settings.codeFont', 'Code Font')}</label>
            <select
              aria-label="Code font"
              value={codeFont}
              onChange={(e) => setCodeFont(e.target.value as CodeFont)}
              className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="default">{t('settings.codeFontDefault', 'System Default')}</option>
              <option value="fira-code">Fira Code</option>
              <option value="jetbrains-mono">JetBrains Mono</option>
              <option value="source-code-pro">Source Code Pro</option>
              <option value="cascadia-code">Cascadia Code</option>
              <option value="consolas">Consolas</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('settings.bubbleStyle', 'Bubble Style')}</label>
            <select
              aria-label="Bubble style"
              value={bubbleStyle}
              onChange={(e) => setBubbleStyle(e.target.value as BubbleStyle)}
              className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="default">{t('settings.bubbleDefault', 'Default')}</option>
              <option value="minimal">{t('settings.bubbleMinimal', 'Minimal')}</option>
              <option value="bordered">{t('settings.bubbleBordered', 'Bordered')}</option>
              <option value="glassmorphism">{t('settings.bubbleGlass', 'Glass')}</option>
            </select>
          </div>
        </div>
      </section>

      {/* ─── Language & Region ─── */}
      <section className="space-y-4">
        <SectionHeader icon="settings-general" title={t('settings.language', 'Language')} />
        <div className="max-w-xs">
          <select
            aria-label="Language"
            value={locale}
            onChange={(e) => setLocale(e.target.value as import('@/types').AppLocale)}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="es">Español</option>
            <option value="pt">Português</option>
            <option value="ru">Русский</option>
            <option value="ar">العربية</option>
          </select>
        </div>
      </section>

      {/* ─── Storage & Behavior ─── */}
      <section className="space-y-4">
        <SectionHeader icon="settings-data" title={t('settings.storageBehavior', 'Storage & Behavior')} />
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('settings.workspaceDir', 'Workspace Directory')}</label>
          <div className="flex gap-2">
            <input
              value={workspacePath}
              onChange={(e) => setWorkspacePath(e.target.value)}
              placeholder="~/.suora"
              className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <button
              onClick={() => {
                const electron = getElectron()
                if (workspacePath && electron) {
                  electron.invoke('system:ensureDirectory', workspacePath)
                }
              }}
              className="px-3 py-2 rounded-xl bg-accent/15 text-accent text-sm font-medium hover:bg-accent/25 transition-colors border border-accent/30"
            >
              {t('settings.apply', 'Apply')}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-text-muted">{t('settings.workspaceDirDesc', 'Agent memory, logs, and plugin data are stored here.')}</p>
        </div>
        <div className="rounded-xl border border-border p-4 bg-surface-0/30 space-y-3">
          <ToggleRow
            label={t('settings.autoSave', 'Auto-save Conversations')}
            desc={t('settings.autoSaveDesc', 'Automatically save conversations to disk as you chat')}
            checked={autoSave}
            onChange={() => setAutoSave(!autoSave)}
          />
          <AutoStartToggle />
        </div>
      </section>

      {/* ─── Proxy / Network ─── */}
      <section className="rounded-xl border border-border p-5 bg-surface-0/30">
        <ProxySection />
      </section>

      {/* ─── Email ─── */}
      <section className="rounded-xl border border-border p-5 bg-surface-0/30">
        <EmailSection />
      </section>

      {/* ─── Save ─── */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => { saveSettingsToWorkspace(); setSaved(true); setTimeout(() => setSaved(false), 2000) }}
          className="rounded-lg bg-accent/15 border border-accent/30 px-4 py-2 text-sm text-accent font-medium hover:bg-accent/25 transition-colors inline-flex items-center gap-1.5"
        >
          {saved ? <><IconifyIcon name="ui-check" size={14} color="currentColor" /> {t('settings.saved', 'Settings saved')}</> : t('settings.save', 'Save')}
        </button>
        {saved && <span className="text-sm text-green-500 animate-fade-in">{t('settings.saved', 'Settings saved')}</span>}
      </div>
    </div>
  )
}
