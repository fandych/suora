import { useState, useRef, useEffect, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import { openCommandPalette } from '@/components/CommandPalette'
import logoSvg from '../../../resources/logo.svg'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
const CMD_SHORTCUT_LABEL = isMac ? '⌘K' : 'Ctrl K'

const navItems = [
  { path: '/chat', i18nKey: 'nav.chat', fallbackLabel: 'Chat', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  )},
  { path: '/pipeline', i18nKey: 'nav.pipeline', fallbackLabel: 'Pipeline', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="6" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="18" r="2"/><path d="M6.7 7.2 10.3 10.8"/><path d="M13.7 13.2 17.3 16.8"/><path d="M7 6h5"/></svg>
  )},
  { path: '/timer', i18nKey: 'nav.timer', fallbackLabel: 'Timer', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  )},
  { path: '/channels', i18nKey: 'nav.channels', fallbackLabel: 'Channels', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
  )},
  { path: '/agents', i18nKey: 'nav.agents', fallbackLabel: 'Agents', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z"/></svg>
  )},
  { path: '/skills', i18nKey: 'nav.skills', fallbackLabel: 'Skills', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
  )},
  { path: '/models', i18nKey: 'nav.models', fallbackLabel: 'Models', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
  )},
  { path: '/mcp', i18nKey: 'nav.mcp', fallbackLabel: 'MCP Servers', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"/><circle cx="12" cy="12" r="3"/></svg>
  )},
]

const settingsIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
)

function formatRelativeTime(ts: number, locale = 'en') {
  const diffSeconds = Math.round((ts - Date.now()) / 1000)
  const absSeconds = Math.abs(diffSeconds)
  const relativeFormatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (absSeconds < 45) return relativeFormatter.format(0, 'second')
  if (absSeconds < 3600) return relativeFormatter.format(Math.round(diffSeconds / 60), 'minute')
  if (absSeconds < 86400) return relativeFormatter.format(Math.round(diffSeconds / 3600), 'hour')
  if (absSeconds < 604800) return relativeFormatter.format(Math.round(diffSeconds / 86400), 'day')

  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(ts)
}

export function NavBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useI18n()

  return (
    <nav aria-label="Main navigation" className="w-20 h-full bg-surface-1/60 backdrop-blur-xl flex flex-col items-center py-5 border-r border-border-subtle/60 shrink-0 relative z-20">
      {/* Logo */}
      <button
        type="button"
        onClick={() => navigate('/chat')}
        aria-label={`SUORA · 朔枢 — ${t('nav.goToChat', 'Go to Chat')}`}
        className="w-13 h-13 rounded-[18px] bg-linear-to-br from-accent/20 to-accent/5 flex items-center justify-center mb-8 hover:scale-105 hover:shadow-[0_0_20px_rgba(var(--t-accent-rgb),0.25)] transition-all duration-300 overflow-hidden border border-accent/15"
      >
        <img src={logoSvg} alt="SUORA" width={40} height={40} className="w-10 h-10" />
      </button>

      {/* Nav Items */}
      <div role="list" aria-label="Navigation items" className="flex-1 flex flex-col gap-2.5">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path)
          const label = t(item.i18nKey, item.fallbackLabel)
          return (
            <button
              type="button"
              key={item.path}
              role="listitem"
              onClick={() => navigate(item.path)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              title={label}
              className={`group relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                isActive
                  ? 'nav-item-active text-accent'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-3/40'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-0.5 w-[2.5px] h-5 rounded-r-full bg-accent shadow-[0_0_6px_rgba(var(--t-accent-rgb),0.4)]" />
              )}
              <span className="flex scale-110">{item.icon}</span>
              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-3.5 py-2 rounded-[10px] bg-surface-3/95 backdrop-blur-sm text-text-primary text-[12px] font-medium opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150 whitespace-nowrap z-50 shadow-xl border border-border-subtle/80 translate-x-1 group-hover:translate-x-0 group-focus-within:translate-x-0">
                {label}
              </div>
            </button>
          )
        })}
      </div>

      {/* Notification Bell */}
      <NotificationBell />

      {/* Offline indicator */}
      <OfflineIndicator />

      {/* Command palette launcher — discoverable entry point for Ctrl/⌘+K */}
      <button
        type="button"
        onClick={() => openCommandPalette()}
        aria-label={`${t('nav.commandPalette', 'Command palette')} (${CMD_SHORTCUT_LABEL})`}
        aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
        title={`${t('nav.commandPalette', 'Command palette')} · ${CMD_SHORTCUT_LABEL}`}
        className="group relative w-12 h-12 rounded-2xl flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface-3/40 transition-all duration-200 mb-1"
      >
        <span className="flex scale-110">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <div className="absolute left-full ml-3 px-3.5 py-2 rounded-[10px] bg-surface-3/95 backdrop-blur-sm text-text-primary text-[12px] font-medium opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150 whitespace-nowrap z-50 shadow-xl border border-border-subtle/80 translate-x-1 group-hover:translate-x-0 group-focus-within:translate-x-0 flex items-center gap-2">
          <span>{t('nav.commandPalette', 'Command palette')}</span>
          <kbd className="text-[10px] px-1.5 py-0.5 bg-surface-2 border border-border-subtle/70 rounded">
            {CMD_SHORTCUT_LABEL}
          </kbd>
        </div>
      </button>

      {/* Settings at bottom */}
      <button
        type="button"
        onClick={() => navigate('/settings')}
        aria-label={t('nav.settings', 'Settings')}
        aria-current={location.pathname.startsWith('/settings') ? 'page' : undefined}
        title={t('nav.settings', 'Settings')}
        className={`group relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${
          location.pathname.startsWith('/settings')
            ? 'nav-item-active text-accent'
            : 'text-text-muted hover:text-text-secondary hover:bg-surface-3/40'
        }`}
      >
        <span className="flex scale-110">{settingsIcon}</span>
        <div className="absolute left-full ml-3 px-3.5 py-2 rounded-[10px] bg-surface-3/95 backdrop-blur-sm text-text-primary text-[12px] font-medium opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150 whitespace-nowrap z-50 shadow-xl border border-border-subtle/80 translate-x-1 group-hover:translate-x-0 group-focus-within:translate-x-0">
          {t('nav.settings', 'Settings')}
        </div>
      </button>
    </nav>
  )
}

// ─── Notification Bell ─────────────────────────────────────────────

function NotificationBell() {
  const { t, locale } = useI18n()
  const { notifications, markNotificationRead, markAllNotificationsRead, clearNotifications, setActiveModule } = useAppStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length
  const notificationsLabel = unreadCount > 0
    ? `${t('nav.notifications', 'Notifications')} (${unreadCount})`
    : t('nav.notifications', 'Notifications')

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleAction = (notification: typeof notifications[0]) => {
    markNotificationRead(notification.id)
    if (notification.action) {
      setActiveModule(notification.action.module)
      navigate(`/${notification.action.module}`)
      setOpen(false)
    }
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case 'success': return <IconifyIcon name="ui-check-circle" size={16} color="currentColor" />
      case 'warning': return <IconifyIcon name="ui-warning" size={16} color="currentColor" />
      case 'error': return <IconifyIcon name="ui-error" size={16} color="currentColor" />
      default: return <IconifyIcon name="ui-info" size={16} color="currentColor" />
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={notificationsLabel}
        aria-label={notificationsLabel}
        className={`group relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${
          open ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary hover:bg-surface-3/60'
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <div className="absolute left-full ml-3 px-3 py-1.5 rounded-[10px] bg-surface-3 text-text-primary text-[12px] font-medium opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg border border-border-subtle">
          {notificationsLabel}
        </div>
      </button>

      {open && (
        <div role="dialog" aria-label={t('nav.notifications', 'Notifications')} className="absolute left-full ml-3 bottom-0 w-90 max-h-120 bg-surface-2 border border-border-subtle rounded-2xl shadow-2xl z-50 flex flex-col animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <span className="text-[15px] font-semibold text-text-primary">{t('nav.notifications', 'Notifications')}</span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button type="button" onClick={markAllNotificationsRead} className="text-[11px] text-text-muted hover:text-accent px-2 py-1 rounded-lg">
                  {t('nav.markAllRead', 'Mark all read')}
                </button>
              )}
              {notifications.length > 0 && (
                <button type="button" onClick={clearNotifications} className="text-[11px] text-text-muted hover:text-danger px-2 py-1 rounded-lg">
                  {t('common.clear', 'Clear')}
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-[13px] text-text-muted">{t('nav.noNotifications', 'No notifications')}</div>
            ) : (
              notifications.slice(0, 50).map((n) => (
                <button
                  type="button"
                  key={n.id}
                  onClick={() => handleAction(n)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-border-subtle/50 transition-colors hover:bg-surface-3/50 ${
                    !n.read ? 'bg-accent/3' : ''
                  }`}
                >
                  <span className="text-base mt-0.5 shrink-0">{typeIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[13px] font-medium truncate ${!n.read ? 'text-text-primary' : 'text-text-secondary'}`}>{n.title}</span>
                      <span className="text-[11px] text-text-muted shrink-0">{formatRelativeTime(n.timestamp, locale)}</span>
                    </div>
                    {n.message && <p className="text-[12px] text-text-muted mt-1 line-clamp-2 leading-relaxed">{n.message}</p>}
                    {n.action?.label && <span className="text-[11px] text-accent mt-1.5 inline-block">{n.action.label} →</span>}
                    {!n.read && <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent ml-1.5 -translate-y-px" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Offline Indicator ─────────────────────────────────────────────

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}
function getOnlineSnapshot() { return navigator.onLine }

function OfflineIndicator() {
  const { t } = useI18n()
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot)

  if (isOnline) return null

  const offlineLabel = t('nav.offline', 'Offline')
  const offlineDescription = t('nav.offlineDescription', 'No internet connection')

  return (
    <div className="w-12 flex flex-col items-center justify-center gap-1 mb-1" role="status" aria-label={`${offlineLabel} — ${offlineDescription}`}>
      <div className="w-9 h-9 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center animate-pulse">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
          <line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
        </svg>
      </div>
      <span className="text-[9px] uppercase tracking-[0.14em] text-yellow-500/70 font-semibold text-center leading-none">{offlineLabel}</span>
    </div>
  )
}
