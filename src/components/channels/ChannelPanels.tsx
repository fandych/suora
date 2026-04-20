import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAppStore } from '@/store/appStore'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import { ChannelPlatformIcon } from './ChannelIcons'
import { ChannelMessageBubble } from './ChannelComponents'

function PanelShell({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{eyebrow}</div>
          <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{title}</h3>
          {description && <p className="mt-2 max-w-3xl text-[13px] leading-6 text-text-secondary/80">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function PanelStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-3xl border px-4 py-3 ${accent ? 'border-accent/18 bg-accent/10' : 'border-border-subtle/55 bg-surface-0/60'}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</div>
    </div>
  )
}

function EmptyPanelState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-4xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-3xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
        <IconifyIcon name={icon} size={18} color="currentColor" />
      </div>
      <h4 className="text-[15px] font-semibold text-text-primary">{title}</h4>
      <p className="mt-2 max-w-md text-[12px] leading-6 text-text-muted">{description}</p>
    </div>
  )
}

function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' }) {
  const toneClass = tone === 'accent'
    ? 'bg-accent/12 text-accent'
    : tone === 'success'
      ? 'bg-green-500/12 text-green-400'
      : tone === 'warning'
        ? 'bg-amber-500/12 text-amber-400'
        : tone === 'danger'
          ? 'bg-red-500/12 text-red-400'
          : 'bg-surface-3 text-text-muted'

  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${toneClass}`}>{children}</span>
}

function formatRelativeTime(value?: number) {
  if (!value) return 'No activity yet'
  const diff = Date.now() - value
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))}h ago`
  if (diff < 604_800_000) return `${Math.max(1, Math.floor(diff / 86_400_000))}d ago`
  return new Date(value).toLocaleDateString()
}

// ─── Channel Message History Panel ─────────────────────────────────

export function ChannelMessageHistory({ channelId }: { channelId?: string }) {
  const { t } = useI18n()
  const { channelMessages, channels, channelUsers, clearChannelMessages } = useAppStore()
  const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing'>('all')
  const [userFilter, setUserFilter] = useState<string>('all') // 'all' or a senderId
  const scrollRef = useRef<HTMLDivElement>(null)

  const channelSenders = useMemo(
    () => channelId ? Object.values(channelUsers).filter((user) => user.channelId === channelId) : [],
    [channelId, channelUsers],
  )

  const filtered = useMemo(
    () => channelMessages
      .filter((message) => (!channelId || message.channelId === channelId))
      .filter((message) => filter === 'all' || message.direction === filter)
      .filter((message) => userFilter === 'all' || message.senderId === userFilter),
    [channelId, channelMessages, filter, userFilter],
  )

  const totalMessages = useMemo(
    () => channelMessages.filter((message) => !channelId || message.channelId === channelId).length,
    [channelId, channelMessages],
  )

  const selectedChannel = useMemo(
    () => channelId ? channels.find((channel) => channel.id === channelId) : undefined,
    [channelId, channels],
  )

  const getChannel = useCallback((id: string) => channels.find((channel) => channel.id === id), [channels])

  // Auto-scroll to bottom when new messages arrive (not on filter changes)
  const prevMsgCountRef = useRef(channelMessages.length)
  useEffect(() => {
    if (channelMessages.length > prevMsgCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevMsgCountRef.current = channelMessages.length
  }, [channelMessages.length])

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 p-5">
      <PanelShell
        eyebrow={t('channels.messages', 'Messages')}
        title={selectedChannel ? selectedChannel.name : t('channels.messageStream', 'Message Stream')}
        description={t('channels.messageStreamHint', 'Review inbound and outbound traffic for this channel, then narrow the stream by direction or by a specific sender.')}
        action={
          <button
            type="button"
            onClick={() => clearChannelMessages(channelId)}
            className="rounded-2xl border border-red-500/18 bg-red-500/8 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/14"
          >
            {t('common.clear', 'Clear')}
          </button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <PanelStat label={t('channels.messages', 'Messages')} value={String(totalMessages)} accent />
          <PanelStat label={t('channels.filtered', 'Filtered')} value={String(filtered.length)} />
          <PanelStat label={t('channels.users', 'Users')} value={String(channelSenders.length)} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(['all', 'incoming', 'outgoing'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-2xl border px-4 py-2.5 text-[11px] font-semibold transition-colors ${filter === value ? 'border-accent/20 bg-accent/10 text-accent' : 'border-border-subtle/55 bg-surface-0/72 text-text-secondary hover:bg-surface-2'}`}
            >
              {value === 'all' ? t('channels.filterAll', 'All') : value === 'incoming' ? t('channels.filterIncoming', 'Incoming') : t('channels.filterOutgoing', 'Outgoing')}
            </button>
          ))}
          {channelSenders.length > 1 && (
            <>
              <label className="sr-only" htmlFor="channel-user-filter">{t('channels.filterByUser', 'Filter by user')}</label>
              <select
                id="channel-user-filter"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                aria-label={t('channels.filterByUser', 'Filter by user')}
                className="max-w-44 rounded-2xl border border-border-subtle/55 bg-surface-0/72 px-3 py-2.5 text-[11px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="all">{t('channels.allUsers', 'All users')}</option>
                {channelSenders.map((user) => (
                  <option key={user.senderId} value={user.senderId}>
                    {user.senderName} ({user.messageCount})
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </PanelShell>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto rounded-4xl border border-border-subtle/55 bg-surface-0/35 px-6 py-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        {filtered.length === 0 ? (
          <EmptyPanelState
            icon="action-chat"
            title={t('channels.noMessagesYet', 'No messages yet')}
            description={t('channels.messagesAppearHere', 'Messages from connected channels will appear here.')}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((msg) => (
              <ChannelMessageBubble
                key={msg.id}
                msg={msg}
                showChannel={!channelId ? (getChannel(msg.channelId)?.name || msg.channelId) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Channel Health Monitor Panel ──────────────────────────────────

export function ChannelHealthMonitor({ singleChannelId }: { singleChannelId?: string }) {
  const { t } = useI18n()
  const { channels, channelHealth, setChannelHealth } = useAppStore()
  const [checking, setChecking] = useState(false)
  const targetChannels = useMemo(
    () => singleChannelId ? channels.filter((channel) => channel.id === singleChannelId) : channels,
    [channels, singleChannelId],
  )

  const checkHealth = useCallback(async () => {
    setChecking(true)
    for (const channel of targetChannels) {
      try {
        const result = await window.electron.invoke('channel:healthCheck', channel.id) as {
          success?: boolean; health?: { isHealthy: boolean; latencyMs: number; error?: string }; error?: string
        }
        if (result.success && result.health) {
          setChannelHealth(channel.id, {
            channelId: channel.id,
            isHealthy: result.health.isHealthy,
            lastCheckAt: Date.now(),
            latencyMs: result.health.latencyMs,
            errorCount: result.health.isHealthy ? 0 : (channelHealth[channel.id]?.errorCount || 0) + 1,
            lastError: result.health.error,
          })
        }
      } catch {
        setChannelHealth(channel.id, {
          channelId: channel.id,
          isHealthy: false,
          lastCheckAt: Date.now(),
          errorCount: (channelHealth[channel.id]?.errorCount || 0) + 1,
          lastError: 'Health check failed',
        })
      }
    }
    setChecking(false)
  }, [targetChannels, channelHealth, setChannelHealth])

  const healthyCount = useMemo(
    () => targetChannels.filter((channel) => channelHealth[channel.id]?.isHealthy).length,
    [channelHealth, targetChannels],
  )
  const unhealthyCount = useMemo(
    () => targetChannels.filter((channel) => channelHealth[channel.id] && !channelHealth[channel.id]?.isHealthy).length,
    [channelHealth, targetChannels],
  )
  const uncheckedCount = targetChannels.length - healthyCount - unhealthyCount

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 p-5">
      <PanelShell
        eyebrow={t('channels.health', 'Health')}
        title={t('channels.healthStatus', 'Channel Health Status')}
        description={t('channels.deliveryHealthHint', 'Run active probes and compare latency, failure count, and last-check time for every configured channel in scope.')}
        action={
          <button
            type="button"
            onClick={() => void checkHealth()}
            disabled={checking}
            className="rounded-2xl border border-accent/18 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/18 disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-1.5">{checking ? t('channels.checking', 'Checking…') : <><IconifyIcon name="ui-search" size={14} color="currentColor" /> {t('channels.checkAll', 'Check All')}</>}</span>
          </button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <PanelStat label={t('channels.healthy', 'Healthy')} value={String(healthyCount)} accent />
          <PanelStat label={t('channels.unhealthy', 'Unhealthy')} value={String(unhealthyCount)} />
          <PanelStat label={t('channels.notChecked', 'Not checked')} value={String(uncheckedCount)} />
        </div>
      </PanelShell>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {targetChannels.length === 0 ? (
          <EmptyPanelState
            icon="ui-warning"
            title={t('channels.noChannelsConfigured', 'No channels configured')}
            description={t('channels.noChannelsConfiguredHint', 'Create a channel first so the health monitor has something to probe.')}
          />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {targetChannels.map((channel) => {
              const health = channelHealth[channel.id]
              const tone = !health ? 'neutral' : health.isHealthy ? 'success' : 'danger'
              return (
                <article key={channel.id} className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/70 text-accent shadow-sm">
                        <ChannelPlatformIcon platform={channel.platform} size={18} customIcon={channel.customPlatformIcon} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-[14px] font-semibold text-text-primary">{channel.name}</h4>
                          <StatusPill tone={tone}>{health ? (health.isHealthy ? t('channels.healthy', 'Healthy') : t('channels.unhealthy', 'Unhealthy')) : t('channels.notChecked', 'Not checked')}</StatusPill>
                        </div>
                        <p className="mt-1 text-[11px] text-text-muted/75">{channel.platform}</p>
                      </div>
                    </div>
                    {health?.latencyMs !== undefined && <span className="text-[11px] font-medium text-text-secondary">{health.latencyMs}ms</span>}
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2 text-[11px] text-text-secondary">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted/45">{t('channels.lastChecked', 'Last Checked')}</div>
                      <div className="mt-1 text-text-primary">{health?.lastCheckAt ? new Date(health.lastCheckAt).toLocaleString() : t('channels.notChecked', 'Not checked')}</div>
                    </div>
                    <div className="rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2 text-[11px] text-text-secondary">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted/45">{t('channels.errors', 'Errors')}</div>
                      <div className="mt-1 text-text-primary">{health?.errorCount ?? 0}</div>
                    </div>
                  </div>

                  {health?.lastError && (
                    <div className="mt-4 rounded-2xl border border-red-500/18 bg-red-500/8 px-4 py-3 text-[12px] leading-6 text-red-400 wrap-break-word">
                      <div className="font-semibold text-red-400">{t('channels.lastError', 'Last error')}</div>
                      <p className="mt-2">{health.lastError}</p>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Channel Debug / Mock Mode ─────────────────────────────────────

export function ChannelDebugPanel({ defaultChannelId }: { defaultChannelId?: string }) {
  const { t } = useI18n()
  const { channels } = useAppStore()
  const [selectedChannelId, setSelectedChannelId] = useState(defaultChannelId || channels[0]?.id || '')
  const [mockMessage, setMockMessage] = useState('')
  const [debugLog, setDebugLog] = useState<Array<{ time: string; text: string }>>([])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    setSelectedChannelId(defaultChannelId || channels[0]?.id || '')
  }, [channels, defaultChannelId])

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId),
    [channels, selectedChannelId],
  )

  const errorCount = useMemo(
    () => debugLog.filter((entry) => entry.text.startsWith('Error') || entry.text.includes('failed')).length,
    [debugLog],
  )

  const sendMock = async () => {
    if (!selectedChannelId || !mockMessage.trim()) return
    setSending(true)
    const time = new Date().toLocaleTimeString()
    setDebugLog((prev) => [...prev, { time, text: `→ Sending mock: "${mockMessage}"` }])
    try {
      const result = await window.electron.invoke('channel:debugSend', selectedChannelId, mockMessage) as { success?: boolean; error?: string }
      if (result.success) {
        setDebugLog((prev) => [...prev, { time: new Date().toLocaleTimeString(), text: 'Mock message processed successfully' }])
      } else {
        setDebugLog((prev) => [...prev, { time: new Date().toLocaleTimeString(), text: `Error: ${result.error}` }])
      }
    } catch (err) {
      setDebugLog((prev) => [...prev, { time: new Date().toLocaleTimeString(), text: `${err instanceof Error ? err.message : String(err)}` }])
    }
    setMockMessage('')
    setSending(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 p-5">
      <PanelShell
        eyebrow={t('channels.debug', 'Debug')}
        title={t('channels.debugMockMode', 'Debug / Mock Mode')}
        description={t('channels.debugMockModeHint', 'Send simulated inbound events without connecting to a real platform, then inspect the exact local debug log produced by the handler.')}
        action={debugLog.length > 0 ? (
          <button
            type="button"
            onClick={() => setDebugLog([])}
            className="rounded-2xl border border-red-500/18 bg-red-500/8 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/14"
          >
            {t('common.clear', 'Clear')}
          </button>
        ) : undefined}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <PanelStat label={t('channels.channel', 'Channel')} value={selectedChannel?.name || t('common.none', 'None')} accent />
          <PanelStat label={t('settings.entries', 'Entries')} value={String(debugLog.length)} />
          <PanelStat label={t('settings.errors', 'Errors')} value={String(errorCount)} />
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[0.75fr_1.25fr_auto]">
          <select
            value={selectedChannelId}
            onChange={(e) => setSelectedChannelId(e.target.value)}
            aria-label={t('channels.selectChannel', 'Select channel')}
            className="rounded-2xl border border-border-subtle/55 bg-surface-0/72 px-3 py-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name} ({channel.platform})</option>)}
          </select>
          <input
            value={mockMessage}
            onChange={(e) => setMockMessage(e.target.value)}
            placeholder={t('channels.mockMessagePlaceholder', 'Type a mock message...')}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void sendMock() } }}
            className="rounded-2xl border border-border-subtle/55 bg-surface-0/72 px-3 py-3 text-sm text-text-primary placeholder-text-muted/55 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="button"
            onClick={() => void sendMock()}
            disabled={sending || !mockMessage.trim() || !selectedChannelId}
            className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {sending ? t('common.sending', 'Sending…') : t('common.send', 'Send')}
          </button>
        </div>
      </PanelShell>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-4xl border border-border-subtle/55 bg-surface-0/35 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        {debugLog.length === 0 ? (
          <EmptyPanelState
            icon="ui-search"
            title={t('channels.debugLogEmpty', 'Debug log will appear here')}
            description={t('channels.debugLogEmptyHint', 'Send a mock message to the selected channel and the local execution trace will start filling this panel.')}
          />
        ) : (
          <div className="space-y-2 font-mono text-xs">
            {debugLog.map((entry, index) => (
              <div key={`${entry.time}-${index}`} className="rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-4 py-3">
                <div className="flex gap-3">
                  <span className="shrink-0 text-text-muted">[{entry.time}]</span>
                  <span className={entry.text.startsWith('Error') ? 'text-red-400' : entry.text.startsWith('Mock message processed') ? 'text-green-400' : 'text-text-secondary'}>
                    {entry.text}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Channel Users Panel (multi-user tracking) ────────────────────

export function ChannelUsersPanel({ channelId }: { channelId: string }) {
  const { t } = useI18n()
  const { channelUsers, clearChannelUsers } = useAppStore()

  const users = useMemo(
    () => Object.values(channelUsers)
      .filter((user) => user.channelId === channelId)
      .sort((left, right) => right.lastActiveAt - left.lastActiveAt),
    [channelId, channelUsers],
  )

  const activeTodayCount = useMemo(
    () => users.filter((user) => Date.now() - user.lastActiveAt < 86_400_000).length,
    [users],
  )

  const totalMessages = useMemo(
    () => users.reduce((sum, user) => sum + user.messageCount, 0),
    [users],
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 p-5">
      <PanelShell
        eyebrow={t('channels.users', 'Users')}
        title={t('channels.channelUsers', 'Channel Users')}
        description={t('channels.channelUsersHint', 'Track who is active on this channel, how much they have messaged, and what recent conversational context is still attached to them.')}
        action={users.length > 0 ? (
          <button
            type="button"
            onClick={() => clearChannelUsers(channelId)}
            className="rounded-2xl border border-red-500/18 bg-red-500/8 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/14"
          >
            {t('channels.clearUsers', 'Clear Users')}
          </button>
        ) : undefined}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <PanelStat label={t('channels.users', 'Users')} value={String(users.length)} accent />
          <PanelStat label={t('channels.activeToday', 'Active Today')} value={String(activeTodayCount)} />
          <PanelStat label={t('channels.messages', 'Messages')} value={String(totalMessages)} />
        </div>
      </PanelShell>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {users.length === 0 ? (
          <EmptyPanelState
            icon="ui-user"
            title={t('channels.noUsersYet', 'No users yet')}
            description={t('channels.noUsersYetHint', 'Users will appear here once messages arrive and the channel has enough activity to build conversation context.')}
          />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {users.map((user) => (
              <article key={user.id} className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-accent/10 bg-linear-to-br from-accent/20 to-accent/5 shadow-sm">
                      <ChannelPlatformIcon platform={user.platform} size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold text-text-primary truncate">{user.senderName}</div>
                      <div className="mt-1 text-[11px] text-text-muted/75 truncate">{user.senderId}</div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-text-secondary">
                    <div className="font-semibold text-accent">{user.messageCount} {t('channels.messages', 'messages')}</div>
                    <div className="mt-1 text-text-muted/75">{formatRelativeTime(user.lastActiveAt)}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2 text-[11px] text-text-secondary">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted/45">{t('channels.firstSeen', 'First Seen')}</div>
                    <div className="mt-1 text-text-primary">{new Date(user.firstSeenAt).toLocaleString()}</div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-3 py-2 text-[11px] text-text-secondary">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted/45">{t('channels.lastActive', 'Last Active')}</div>
                    <div className="mt-1 text-text-primary">{new Date(user.lastActiveAt).toLocaleString()}</div>
                  </div>
                </div>

                {user.conversationHistory.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-border-subtle/45 bg-surface-2/55 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted/45">{t('channels.recentContext', 'Recent Context')}</div>
                    <div className="mt-3 space-y-2">
                      {user.conversationHistory.slice(-3).map((entry, index) => (
                        <div key={`${entry.timestamp}-${index}`} className="flex items-start gap-2 text-[11px]">
                          <span className={`mt-0.5 shrink-0 font-medium ${entry.role === 'user' ? 'text-accent/80' : 'text-green-400/80'}`}>
                            {entry.role === 'user' ? '→' : '←'}
                          </span>
                          <span className="text-text-secondary wrap-break-word">{entry.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
