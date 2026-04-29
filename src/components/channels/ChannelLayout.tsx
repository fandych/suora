import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAppStore } from '@/store/appStore'
import { SidePanel } from '@/components/layout/SidePanel'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { useResizablePanel } from '@/hooks/useResizablePanel'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import {
  startChannelServer,
  stopChannelServer,
  getChannelServerStatus,
  getChannelWebhookUrl,
  registerChannels,
} from '@/services/channelMessageHandler'
import type { ChannelConfig } from '@/types'
import { ChannelPlatformIcon, getPlatformDisplayName, useChannelIconCollections } from './ChannelIcons'
import { ChannelEditor } from './ChannelEditor'
import { ChannelMessageHistory, ChannelHealthMonitor, ChannelDebugPanel, ChannelUsersPanel } from './ChannelPanels'
import { confirm as showConfirm } from '@/services/confirmDialog'
import { useI18n } from '@/hooks/useI18n'

type ChannelTab = 'config' | 'messages' | 'health' | 'debug' | 'users'

function SummaryStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border px-3 py-2.5 ${accent ? 'border-accent/18 bg-accent/10' : 'border-border-subtle/45 bg-surface-0/55'}`}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{label}</div>
      <div className={`mt-1 text-[15px] font-semibold tabular-nums ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</div>
    </div>
  )
}

function DetailSection({
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
    <section className="rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)] xl:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{eyebrow}</div>
          <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{title}</h3>
          {description && <p className="mt-2 max-w-2xl text-[13px] leading-6 text-text-secondary/80">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-4 py-3 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="text-right font-medium text-text-primary">{value}</span>
    </div>
  )
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

function copyToClipboard(value: string) {
  navigator.clipboard?.writeText(value).catch(() => {})
}

// ─── Channel Detail View (right panel) ─────────────────────────────

function ChannelDetail({
  channel,
  agents,
  webhookUrl,
  serverRunning,
  onEdit,
  onDelete,
  onToggle,
  onStartServer,
}: {
  channel: ChannelConfig
  agents: { id: string; name: string; enabled?: boolean }[]
  webhookUrl?: string
  serverRunning: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onStartServer: () => void
}) {
  const { t } = useI18n()
  const { channelHealth, channelMessages, channelUsers } = useAppStore()
  const [activeTab, setActiveTab] = useState<ChannelTab>('config')

  useEffect(() => {
    setActiveTab('config')
  }, [channel.id])

  const health = channelHealth[channel.id]
  const users = useMemo(
    () => Object.values(channelUsers).filter((user) => user.channelId === channel.id),
    [channel.id, channelUsers],
  )
  const messages = useMemo(
    () => channelMessages.filter((message) => message.channelId === channel.id),
    [channel.id, channelMessages],
  )

  const assignedAgent = agents.find((agent) => agent.id === channel.replyAgentId)
  const platformLabel = channel.platform === 'custom'
    ? channel.customPlatformName || t('channels.customChannel', 'Custom Channel')
    : getPlatformDisplayName(channel.platform)
  const modeLabel = channel.connectionMode === 'stream'
    ? t('channels.stream', 'Stream')
    : t('channels.webhook', 'Webhook')
  const stateLabel = !channel.enabled
    ? t('common.disabled', 'Disabled')
    : channel.status === 'active'
      ? t('channels.active', 'Active')
      : channel.status === 'error'
        ? t('common.error', 'Error')
        : t('channels.inactive', 'Inactive')
  const stateTone = !channel.enabled
    ? 'border-border-subtle/60 bg-surface-2/80 text-text-muted'
    : channel.status === 'active'
      ? 'border-green-500/20 bg-green-500/10 text-green-400'
      : channel.status === 'error'
        ? 'border-red-500/20 bg-red-500/10 text-red-400'
        : 'border-border-subtle/60 bg-surface-2/80 text-text-muted'
  const transportTone = channel.connectionMode === 'stream'
    ? 'border-green-500/20 bg-green-500/10 text-green-400'
    : serverRunning
      ? 'border-accent/20 bg-accent/10 text-accent'
      : 'border-yellow-500/20 bg-yellow-500/10 text-yellow-500'
  const healthTone = !health
    ? 'border-border-subtle/60 bg-surface-2/80 text-text-muted'
    : health.isHealthy
      ? 'border-green-500/20 bg-green-500/10 text-green-400'
      : 'border-red-500/20 bg-red-500/10 text-red-400'

  const tabMeta: Array<{ id: ChannelTab; label: string; icon: string }> = [
    { id: 'config', label: t('channels.config', 'Config'), icon: 'ui-clipboard' },
    { id: 'messages', label: t('channels.messages', 'Messages'), icon: 'action-chat' },
    { id: 'users', label: t('channels.users', 'Users'), icon: 'ui-users' },
    { id: 'health', label: t('channels.health', 'Health'), icon: 'ui-check' },
    { id: 'debug', label: t('channels.debug', 'Debug'), icon: 'ui-search' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <section className="rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-4xl border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]">
              <ChannelPlatformIcon platform={channel.platform} size={30} customIcon={channel.customPlatformIcon} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{platformLabel}</div>
              <h1 className="mt-2 text-[30px] font-semibold tracking-tight text-text-primary">{channel.name}</h1>
              <p className="mt-2 max-w-3xl text-[14px] leading-7 text-text-secondary/82">
                {channel.connectionMode === 'stream'
                  ? t('channels.streamHeroHint', 'This channel keeps a live socket connection so inbound messages land directly in the desktop runtime without exposing a public callback URL.')
                  : t('channels.webhookHeroHint', 'This channel listens through the webhook server and routes every inbound event to the assigned reply agent.')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <button
              type="button"
              onClick={onToggle}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${channel.enabled ? 'border-green-500/20 bg-green-500/12 text-green-400 hover:bg-green-500/18' : 'border-border-subtle/55 bg-surface-0/70 text-text-muted hover:bg-surface-2'}`}
            >
              {channel.enabled ? t('channels.disableChannel', 'Disable Channel') : t('channels.enableChannel', 'Enable Channel')}
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-2xl border border-accent/18 bg-accent/12 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/18"
            >
              {t('common.edit', 'Edit')}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-2xl border border-red-500/18 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/16"
            >
              {t('common.delete', 'Delete')}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-text-secondary">
          <span className={`rounded-full border px-3 py-1 ${stateTone}`}>{stateLabel}</span>
          <span className={`rounded-full border px-3 py-1 ${transportTone}`}>{channel.connectionMode === 'stream' ? t('channels.streamMode', 'Stream Mode') : serverRunning ? t('channels.webhookLive', 'Webhook Live') : t('channels.webhookWaiting', 'Webhook Waiting')}</span>
          <span className="rounded-full bg-surface-0/70 px-3 py-1">{assignedAgent?.name || t('common.noData', 'Unknown agent')}</span>
          <span className="rounded-full bg-surface-0/70 px-3 py-1">{channel.autoReply ? t('channels.autoReplyEnabled', 'Auto reply on') : t('channels.autoReplyDisabled', 'Auto reply off')}</span>
          <span className={`rounded-full border px-3 py-1 ${healthTone}`}>{health ? (health.isHealthy ? t('channels.healthy', 'Healthy') : t('channels.attentionNeeded', 'Attention needed')) : t('channels.notChecked', 'Not checked')}</span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryStat label={t('channels.messages', 'Messages')} value={String(channel.messageCount)} accent />
          <SummaryStat label={t('channels.users', 'Users')} value={String(users.length)} />
          <SummaryStat label={t('channels.lastSeen', 'Last Seen')} value={formatRelativeTime(channel.lastMessageAt)} />
          <SummaryStat label={t('channels.latency', 'Latency')} value={health?.latencyMs !== undefined ? `${health.latencyMs}ms` : t('channels.pending', 'Pending')} />
        </div>
      </section>

      <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/50 p-2 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap gap-2">
          {tabMeta.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-2xl px-4 py-2.5 text-[12px] font-semibold transition-colors ${activeTab === tab.id ? 'bg-accent/15 text-accent' : 'text-text-muted hover:bg-surface-3/60 hover:text-text-primary'}`}
            >
              <span className="inline-flex items-center gap-2"><IconifyIcon name={tab.icon} size={14} color="currentColor" /> {tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'config' ? (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <DetailSection
              eyebrow={t('channels.config', 'Config')}
              title={t('channels.channelOverview', 'Channel Overview')}
              description={t('channels.channelOverviewHint', 'Review transport mode, runtime status, and which agent currently owns replies for this integration.')}
            >
              <div className="space-y-3">
                <DetailRow label={t('channels.platform', 'Platform')} value={platformLabel} />
                <DetailRow label={t('channels.mode', 'Mode')} value={modeLabel} />
                <DetailRow label={t('channels.agent', 'Agent')} value={assignedAgent?.name || t('common.noData', 'Unknown')} />
                <DetailRow label={t('channels.autoReply', 'Auto Reply')} value={channel.autoReply ? t('channels.yes', 'Yes') : t('channels.no', 'No')} />
                <DetailRow label={t('channels.status', 'Status')} value={stateLabel} />
                <DetailRow label={t('channels.created', 'Created')} value={new Date(channel.createdAt).toLocaleString()} />
              </div>
            </DetailSection>

            <DetailSection
              eyebrow={t('channels.delivery', 'Delivery')}
              title={channel.connectionMode === 'stream' ? t('channels.streamMode', 'Stream Mode') : t('channels.webhookRouting', 'Webhook Routing')}
              description={channel.connectionMode === 'stream'
                ? t('channels.streamModeDesc', 'This channel keeps a persistent WebSocket connection. No public URL is required, so the desktop app can stay completely local.')
                : t('channels.webhookRoutingHint', 'Use the callback address below when wiring the platform to this workspace. The webhook server must be running to receive traffic.')}
              action={channel.connectionMode !== 'stream' && webhookUrl ? (
                <button
                  type="button"
                  onClick={() => copyToClipboard(webhookUrl)}
                  className="rounded-xl border border-accent/18 bg-accent/10 px-3 py-2 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/18"
                >
                  <span className="inline-flex items-center gap-1.5"><IconifyIcon name="ui-clipboard" size={13} color="currentColor" /> {t('common.copy', 'Copy')}</span>
                </button>
              ) : undefined}
            >
              {channel.connectionMode === 'stream' ? (
                <div className="rounded-3xl border border-green-500/20 bg-green-500/8 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-green-400">
                    <IconifyIcon name="ui-check" size={14} color="currentColor" />
                    {t('channels.streamReady', 'Direct stream transport is ready')}
                  </div>
                  <p className="mt-2 text-[12px] leading-6 text-text-secondary/80">
                    {t('channels.streamReadyHint', 'Keep the desktop app online and authenticated. Messages arrive through the long-lived socket instead of an inbound HTTP callback.')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <DetailRow
                    label={t('channels.serverState', 'Server State')}
                    value={serverRunning ? t('channels.serverRunning', 'Server running') : t('channels.serverStopped', 'Server stopped')}
                  />
                  <DetailRow label={t('channels.webhookPath', 'Webhook Path')} value={<code className="rounded-lg bg-surface-3/60 px-2 py-1 text-xs text-accent">{channel.webhookPath}</code>} />
                  {webhookUrl ? (
                    <DetailRow label={t('channels.webhookUrl', 'Webhook URL')} value={<code className="break-all rounded-lg bg-surface-3/60 px-2 py-1 text-xs text-accent">{webhookUrl}</code>} />
                  ) : (
                    <div className="rounded-3xl border border-yellow-500/18 bg-yellow-500/8 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-text-primary">{t('channels.webhookServerRequired', 'Webhook server required')}</div>
                          <p className="mt-1 text-[12px] leading-6 text-text-secondary/80">{t('channels.webhookServerRequiredHint', 'Start the local channel server to expose the callback URL for this integration.')}</p>
                        </div>
                        {!serverRunning && (
                          <button
                            type="button"
                            onClick={onStartServer}
                            className="rounded-xl border border-accent/18 bg-accent/10 px-3 py-2 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/18"
                          >
                            {t('channels.startServer', 'Start Server')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </DetailSection>
          </div>

          <div className="space-y-6">
            <DetailSection
              eyebrow={t('channels.activity', 'Activity')}
              title={t('channels.runtimeSignals', 'Runtime Signals')}
              description={t('channels.runtimeSignalsHint', 'These metrics show how recently the integration was used and whether the transport is still healthy.')}
            >
              <div className="space-y-3">
                <DetailRow label={t('channels.lastMessage', 'Last Message')} value={channel.lastMessageAt ? new Date(channel.lastMessageAt).toLocaleString() : t('channels.noMessagesYet', 'No messages yet')} />
                <DetailRow label={t('channels.recentActivity', 'Recent Activity')} value={formatRelativeTime(channel.lastMessageAt)} />
                <DetailRow label={t('channels.users', 'Users')} value={String(users.length)} />
                <DetailRow label={t('channels.messages', 'Messages')} value={String(messages.length || channel.messageCount)} />
              </div>
            </DetailSection>

            <DetailSection
              eyebrow={t('channels.health', 'Health')}
              title={t('channels.deliveryHealth', 'Delivery Health')}
              description={t('channels.deliveryHealthHint', 'Monitor the latest health probe, observed latency, and recent failure counts for this channel.')}
            >
              <div className="space-y-3">
                <DetailRow label={t('channels.healthStatus', 'Health Status')} value={health ? (health.isHealthy ? t('channels.healthy', 'Healthy') : t('channels.unhealthy', 'Unhealthy')) : t('channels.notChecked', 'Not checked')} />
                <DetailRow label={t('channels.lastChecked', 'Last Checked')} value={health?.lastCheckAt ? new Date(health.lastCheckAt).toLocaleString() : t('channels.notChecked', 'Not checked')} />
                <DetailRow label={t('channels.latency', 'Latency')} value={health?.latencyMs !== undefined ? `${health.latencyMs}ms` : t('channels.pending', 'Pending')} />
                <DetailRow label={t('channels.errors', 'Errors')} value={String(health?.errorCount ?? 0)} />
                {health?.lastError && (
                  <div className="rounded-3xl border border-red-500/18 bg-red-500/8 p-4 text-[12px] leading-6 text-red-400">
                    <div className="font-semibold">{t('channels.lastError', 'Last error')}</div>
                    <p className="mt-2 wrap-break-word">{health.lastError}</p>
                  </div>
                )}
              </div>
            </DetailSection>
          </div>
        </div>
      ) : (
        <div className="flex h-[calc(100vh-15rem)] min-h-135 max-h-[calc(100vh-15rem)] flex-col overflow-hidden rounded-4xl border border-border-subtle/55 bg-surface-1/70">
          {activeTab === 'messages' && <ChannelMessageHistory channelId={channel.id} />}
          {activeTab === 'users' && <ChannelUsersPanel channelId={channel.id} />}
          {activeTab === 'health' && <ChannelHealthMonitor singleChannelId={channel.id} />}
          {activeTab === 'debug' && <ChannelDebugPanel defaultChannelId={channel.id} />}
        </div>
      )}
    </div>
  )
}

// ─── Main Layout ───────────────────────────────────────────────────

export function ChannelLayout() {
  const { t } = useI18n()
  const [panelWidth, setPanelWidth] = useResizablePanel('channels', 320)
  const { channels, agents, addChannel, updateChannel, removeChannel } = useAppStore()
  const [serverRunning, setServerRunning] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingChannel, setEditingChannel] = useState<ChannelConfig | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [webhookUrls, setWebhookUrls] = useState<Record<string, string>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)

  // Load iconify collections needed for channel platform icons
  useChannelIconCollections()

  const selectedChannel = channels.find((c) => c.id === selectedId) || null
  const agentNameMap = useMemo(() => new Map(agents.map((agent) => [agent.id, agent.name])), [agents])

  const filteredChannels = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase()
    if (!query) return channels

    return channels.filter((channel) => {
      const haystacks = [
        channel.name,
        getPlatformDisplayName(channel.platform),
        channel.customPlatformName || '',
        agentNameMap.get(channel.replyAgentId) || '',
        channel.connectionMode,
      ]

      return haystacks.some((value) => value.toLowerCase().includes(query))
    })
  }, [agentNameMap, channels, deferredSearchQuery])

  useEffect(() => {
    checkServerStatus().catch(console.error)
  }, [])

  useEffect(() => {
    if (channels.length > 0) {
      registerChannels(channels).catch(console.error)
    }
  }, [channels])

  useEffect(() => {
    if (editingChannel) return
    if (selectedId && channels.some((channel) => channel.id === selectedId)) return
    setSelectedId(channels[0]?.id ?? null)
  }, [channels, editingChannel, selectedId])

  useEffect(() => {
    if (!serverRunning) return
    hydrateWebhookUrls(channels).catch(console.error)
  }, [channels, serverRunning])

  const hydrateWebhookUrls = async (channelList: ChannelConfig[]) => {
    const entries = await Promise.all(
      channelList.map(async (channel) => {
        if (channel.connectionMode === 'stream') return [channel.id, undefined] as const
        const url = await getChannelWebhookUrl(channel)
        return [channel.id, url] as const
      }),
    )

    setWebhookUrls((prev) => {
      const next = { ...prev }
      for (const [channelId, url] of entries) {
        if (url) next[channelId] = url
        else delete next[channelId]
      }
      return next
    })
  }

  const checkServerStatus = async () => {
    const running = await getChannelServerStatus()
    setServerRunning(running)
    if (running) await hydrateWebhookUrls(channels)
  }

  const handleStartServer = async () => {
    const success = await startChannelServer()
    if (success) {
      setServerRunning(true)
      await hydrateWebhookUrls(channels)
    }
  }

  const handleStopServer = async () => {
    const success = await stopChannelServer()
    if (success) {
      setServerRunning(false)
      setWebhookUrls({})
    }
  }

  const handleAddChannel = () => {
    const newChannel: ChannelConfig = {
      id: `channel-${Date.now()}`,
      name: t('channels.newChannelName', 'New Channel'),
      platform: 'feishu',
      enabled: false,
      status: 'inactive',
      connectionMode: 'webhook',
      webhookPath: `/webhook/feishu/${Date.now()}`,
      autoReply: true,
      replyAgentId: agents.find((agent) => agent.enabled !== false)?.id || 'default-assistant',
      createdAt: Date.now(),
      messageCount: 0,
    }
    setEditingChannel(newChannel)
    setIsAdding(true)
    setSelectedId(null)
  }

  const handleSaveChannel = (ch: ChannelConfig) => {
    const existing = channels.find((c) => c.id === ch.id)
    if (existing) {
      updateChannel(ch.id, ch)
    } else {
      addChannel(ch)
    }
    setEditingChannel(null)
    setIsAdding(false)
    setSelectedId(ch.id)
  }

  const handleCancelEdit = () => {
    setEditingChannel(null)
    setIsAdding(false)
  }

  const handleEditChannel = () => {
    if (selectedChannel) {
      setEditingChannel({ ...selectedChannel })
      setIsAdding(false)
    }
  }

  const handleDeleteChannel = async () => {
    if (!selectedChannel) return
    const ok = await showConfirm({
      title: t('channels.deleteTitle', 'Delete channel?'),
      body: t(
        'channels.deleteBody',
        `"${selectedChannel.name}" will be permanently removed along with its configuration and message history. This cannot be undone.`,
      ),
      danger: true,
      confirmText: t('common.delete', 'Delete'),
    })
    if (!ok) return
    removeChannel(selectedChannel.id)
    setSelectedId(null)
  }

  const handleToggleEnabled = () => {
    if (selectedChannel) {
      updateChannel(selectedChannel.id, { enabled: !selectedChannel.enabled })
    }
  }

  return (
    <>
      <SidePanel
        title={t('channels.title', 'Channels')}
        width={panelWidth}
        action={
          <button
            type="button"
            onClick={handleAddChannel}
            className="rounded-xl bg-accent/15 px-3 py-1.5 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/25"
          >
            + {t('common.new', 'New')}
          </button>
        }
      >
        <div className="module-sidebar-stack px-3 pb-3 pt-3 space-y-3">
          <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="relative">
              <IconifyIcon name="ui-search" size={14} color="currentColor" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/55" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('channels.searchChannels', 'Search channels, platforms, or agents...')}
                className="w-full rounded-2xl border border-border-subtle/55 bg-surface-2/80 py-2.5 pl-10 pr-10 text-[12px] text-text-primary placeholder-text-muted/55 focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  title={t('common.clear', 'Clear')}
                  aria-label={t('common.clear', 'Clear')}
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-primary"
                >
                  <IconifyIcon name="ui-close" size={14} color="currentColor" />
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted/70">
              <span>{filteredChannels.length} {t('common.results', 'results')}</span>
              {searchQuery.trim() && <span>{channels.length} {t('common.total', 'total')}</span>}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-1 py-1 text-[11px] text-text-secondary">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${serverRunning ? 'bg-green-400' : 'bg-text-muted/45'}`} />
              <span className="truncate">{serverRunning ? t('channels.serverRunning', 'Server Running') : t('channels.serverStopped', 'Server Stopped')}</span>
            </div>
            <button
              type="button"
              onClick={serverRunning ? handleStopServer : handleStartServer}
              className={`shrink-0 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${serverRunning ? 'border-red-500/18 bg-red-500/8 text-red-400 hover:bg-red-500/14' : 'border-accent/18 bg-accent/10 text-accent hover:bg-accent/18'}`}
            >
              {serverRunning ? t('channels.stopServer', 'Stop Server') : t('channels.startServer', 'Start Server')}
            </button>
          </div>

          <div className="space-y-2">
            {filteredChannels.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
                  <IconifyIcon name="action-chat" size={18} color="currentColor" />
                </div>
                <p className="text-[12px] leading-relaxed text-text-muted">{searchQuery.trim() ? t('channels.noMatchingChannels', 'No matching channels.') : t('channels.noChannelsYet', 'No channels yet')}</p>
                <p className="mt-1 text-[10px] text-text-muted/60">{searchQuery.trim() ? t('channels.adjustChannelSearch', 'Adjust the search query or clear it to see every integration.') : t('channels.createFirstChannel', 'Create your first channel to route inbound messages into agents.')}</p>
              </div>
            ) : filteredChannels.map((channel) => {
              const isActive = selectedId === channel.id || editingChannel?.id === channel.id
              const platformLabel = channel.platform === 'custom'
                ? channel.customPlatformName || t('channels.customChannel', 'Custom Channel')
                : getPlatformDisplayName(channel.platform)
              const agentLabel = agentNameMap.get(channel.replyAgentId) || t('common.noData', 'Unknown')
              const badgeTone = !channel.enabled
                ? 'bg-surface-3/80 text-text-muted'
                : channel.status === 'active'
                  ? 'bg-green-500/15 text-green-400'
                  : channel.status === 'error'
                    ? 'bg-red-500/15 text-red-400'
                    : 'bg-surface-3/80 text-text-muted'

              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => { setSelectedId(channel.id); setEditingChannel(null); setIsAdding(false) }}
                  className={`w-full rounded-3xl border px-3.5 py-3.5 text-left transition-all duration-200 ${isActive ? 'border-accent/20 bg-accent/10 shadow-[0_14px_34px_rgba(var(--t-accent-rgb),0.07)]' : 'border-transparent bg-surface-1/20 hover:bg-surface-3/55 hover:border-border-subtle/60'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-0/75 text-accent shadow-sm">
                        <ChannelPlatformIcon platform={channel.platform} size={18} customIcon={channel.customPlatformIcon} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-[13px] font-semibold text-text-primary">{channel.name}</span>
                          {!channel.enabled && <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[9px] text-text-muted">OFF</span>}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-text-secondary/80">{platformLabel} · {agentLabel}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-text-muted">
                          <span className="rounded-full bg-surface-3/80 px-2 py-0.5 uppercase">{channel.connectionMode}</span>
                          <span className="rounded-full bg-surface-3/80 px-2 py-0.5">{channel.messageCount} {t('channels.messages', 'messages')}</span>
                          {channel.autoReply && <span className="rounded-full bg-surface-3/80 px-2 py-0.5">{t('channels.autoReply', 'Auto Reply')}</span>}
                        </div>
                        <div className="mt-2 text-[10px] text-text-muted/70">{channel.lastMessageAt ? `${t('channels.lastSeen', 'Last seen')}: ${formatRelativeTime(channel.lastMessageAt)}` : t('channels.noActivityYet', 'No activity yet')}</div>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeTone}`}>{!channel.enabled ? t('common.off', 'Off') : channel.status === 'active' ? t('channels.live', 'Live') : channel.status === 'error' ? t('common.error', 'Error') : t('channels.idle', 'Idle')}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </SidePanel>
      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={240} maxWidth={520} />

      <div className="module-canvas flex-1 min-w-0 overflow-y-auto px-5 py-6 xl:px-8 xl:py-8">
        {editingChannel ? (
          <ChannelEditor
            key={`${isAdding ? 'new' : 'edit'}-${editingChannel.id}`}
            channel={editingChannel}
            agents={agents}
            isNew={isAdding}
            onSave={handleSaveChannel}
            onCancel={handleCancelEdit}
          />
        ) : selectedChannel ? (
          <ChannelDetail
            key={selectedChannel.id}
            channel={selectedChannel}
            agents={agents}
            webhookUrl={webhookUrls[selectedChannel.id]}
            serverRunning={serverRunning}
            onEdit={handleEditChannel}
            onDelete={handleDeleteChannel}
            onToggle={handleToggleEnabled}
            onStartServer={handleStartServer}
          />
        ) : (
          <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center">
            <div className="w-full rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/94 via-surface-1/88 to-surface-2/72 p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.16)] animate-fade-in xl:p-10">
              <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-[26px] border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]">
                <IconifyIcon name="action-chat" size={30} color="currentColor" />
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-text-primary">{t('channels.selectChannel', 'Select a channel or create a new one')}</h2>
              <p className="mt-3 text-[14px] leading-7 text-text-secondary/82">{t('channels.selectChannelHint', 'Organize inbound chat surfaces, attach a reply agent, and monitor webhook or stream traffic from one place.')}</p>
              <button
                type="button"
                onClick={handleAddChannel}
                className="mt-6 rounded-2xl bg-accent px-5 py-3 text-[13px] font-semibold text-white shadow-[0_10px_30px_rgba(var(--t-accent-rgb),0.22)] transition-all hover:bg-accent-hover"
              >
                + {t('common.new', 'New')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
