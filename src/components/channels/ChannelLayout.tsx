import { useState, useEffect } from 'react'
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

// ─── Channel Detail View (right panel) ─────────────────────────────

function ChannelDetail({
  channel,
  agents,
  webhookUrl,
  onEdit,
  onDelete,
  onToggle,
}: {
  channel: ChannelConfig
  agents: { id: string; name: string }[]
  webhookUrl?: string
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const [activeTab, setActiveTab] = useState<ChannelTab>('config')

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-13 px-6 flex items-center justify-between border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg"><ChannelPlatformIcon platform={channel.platform} size={22} customIcon={channel.customPlatformIcon} /></span>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">{channel.name}</h2>
            <span className="text-[10px] text-text-muted uppercase tracking-wide">{getPlatformDisplayName(channel.platform)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggle}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
              channel.enabled
                ? 'bg-green-500/15 text-green-400 border-green-500/20 hover:bg-green-500/25'
                : 'bg-surface-2 text-text-muted border-border-subtle hover:bg-surface-3'
            }`}>
            {channel.enabled ? '● ON' : '○ OFF'}
          </button>
          <button onClick={onEdit}
            className="px-3 py-1 text-xs font-medium text-accent bg-accent/10 rounded-lg hover:bg-accent/20 transition-colors border border-accent/20">
            Edit
          </button>
          <button onClick={onDelete}
            className="px-3 py-1 text-xs font-medium text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors border border-red-500/20">
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 pb-2 border-b border-border-subtle">
        {([
          { id: 'config' as ChannelTab, label: 'Config' },
          { id: 'messages' as ChannelTab, label: 'Messages' },
          { id: 'users' as ChannelTab, label: 'Users' },
          { id: 'health' as ChannelTab, label: 'Health' },
          { id: 'debug' as ChannelTab, label: 'Debug' },
        ]).map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === id ? 'bg-accent/15 text-accent' : 'text-text-muted hover:bg-surface-2'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'config' && (
          <div className="p-6 space-y-3">
            <div className="space-y-2.5 text-xs">
              {[
                ['Status', channel.status],
                ['Mode', (channel.connectionMode || 'webhook') === 'stream' ? 'Stream' : 'Webhook'],
                ['Agent', agents.find((a) => a.id === channel.replyAgentId)?.name || 'Unknown'],
                ['Auto Reply', channel.autoReply ? 'Yes' : 'No'],
                ['Messages', String(channel.messageCount)],
                ['Created', new Date(channel.createdAt).toLocaleDateString()],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-1 border border-border-subtle">
                  <span className="text-text-muted">{label}</span>
                  <span className="font-medium text-text-primary">{value}</span>
                </div>
              ))}
            </div>
            {channel.connectionMode === 'stream' ? (
              <div className="mt-4 p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-green-400">Stream Mode</span>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">
                  This channel uses WebSocket stream mode. No public URL or webhook configuration needed.
                  The app connects directly to DingTalk via a persistent WebSocket connection.
                </p>
              </div>
            ) : webhookUrl && (
              <div className="mt-4 p-3 bg-surface-1 rounded-lg border border-border-subtle">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-text-muted font-medium text-xs">Webhook URL</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(webhookUrl).catch(() => {})}
                    className="text-[10px] px-2 py-0.5 rounded-md text-accent hover:bg-accent/10 transition-colors font-medium inline-flex items-center gap-1">
                    <IconifyIcon name="ui-clipboard" size={12} color="currentColor" /> Copy
                  </button>
                </div>
                <code className="text-[10px] text-accent break-all leading-relaxed">{webhookUrl}</code>
              </div>
            )}
          </div>
        )}
        {activeTab === 'messages' && <ChannelMessageHistory channelId={channel.id} />}
        {activeTab === 'users' && <ChannelUsersPanel channelId={channel.id} />}
        {activeTab === 'health' && <ChannelHealthMonitor singleChannelId={channel.id} />}
        {activeTab === 'debug' && <ChannelDebugPanel defaultChannelId={channel.id} />}
      </div>
    </div>
  )
}

// ─── Main Layout ───────────────────────────────────────────────────

export function ChannelLayout() {
  const { t } = useI18n()
  const [panelWidth, setPanelWidth] = useResizablePanel('channels', 280)
  const { channels, agents, addChannel, updateChannel, removeChannel } = useAppStore()
  const [serverRunning, setServerRunning] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingChannel, setEditingChannel] = useState<ChannelConfig | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [webhookUrls, setWebhookUrls] = useState<Record<string, string>>({})

  // Load iconify collections needed for channel platform icons
  useChannelIconCollections()

  const selectedChannel = channels.find((c) => c.id === selectedId) || null

  useEffect(() => {
    checkServerStatus()
  }, [])

  useEffect(() => {
    if (channels.length > 0) {
      registerChannels(channels).catch(console.error)
    }
  }, [channels])

  const checkServerStatus = async () => {
    const running = await getChannelServerStatus()
    setServerRunning(running)
  }

  const handleStartServer = async () => {
    const success = await startChannelServer()
    if (success) {
      setServerRunning(true)
      for (const channel of channels) {
        const url = await getChannelWebhookUrl(channel)
        if (url) setWebhookUrls((prev) => ({ ...prev, [channel.id]: url }))
      }
    }
  }

  const handleStopServer = async () => {
    const success = await stopChannelServer()
    if (success) setServerRunning(false)
  }

  const handleAddChannel = () => {
    const newChannel: ChannelConfig = {
      id: `channel-${Date.now()}`,
      name: 'New Channel',
      platform: 'feishu',
      enabled: false,
      status: 'inactive',
      connectionMode: 'webhook',
      webhookPath: `/webhook/feishu/${Date.now()}`,
      autoReply: true,
      replyAgentId: agents[0]?.id || 'default-assistant',
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
        title="Channels"
        width={panelWidth}
        action={
          <button onClick={handleAddChannel}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium">
            + New
          </button>
        }
      >
        {/* Server status (compact) */}
        <div className={`mx-3 mt-3 mb-2 p-2.5 rounded-lg border text-xs ${
          serverRunning ? 'bg-green-500/5 border-green-500/20' : 'bg-surface-2 border-border-subtle'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${serverRunning ? 'bg-green-400 animate-pulse' : 'bg-text-muted/50'}`} />
              <span className="font-medium text-text-primary">
                {serverRunning ? 'Server Running' : 'Server Stopped'}
              </span>
            </div>
            <button onClick={serverRunning ? handleStopServer : handleStartServer}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                serverRunning
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-accent hover:bg-accent/10'
              }`}>
              {serverRunning ? 'Stop' : 'Start'}
            </button>
          </div>
        </div>

        {/* Channel list */}
        <div className="px-2 pb-2 space-y-0.5">
          {channels.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-6">No channels yet</p>
          ) : channels.map((ch) => (
            <button key={ch.id}
              onClick={() => { setSelectedId(ch.id); setEditingChannel(null); setIsAdding(false) }}
              className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${
                selectedId === ch.id
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:bg-surface-2'
              }`}>
              <span className="text-base shrink-0"><ChannelPlatformIcon platform={ch.platform} size={18} customIcon={ch.customPlatformIcon} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">{ch.name}</div>
                <div className="text-[10px] text-text-muted uppercase tracking-wide">{getPlatformDisplayName(ch.platform)}</div>
              </div>
              <span className={`w-2 h-2 rounded-full shrink-0 ${ch.enabled ? 'bg-green-400' : 'bg-text-muted/30'}`} />
            </button>
          ))}
        </div>
      </SidePanel>
      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={200} maxWidth={480} />

      {/* Right panel */}
      {editingChannel ? (
        <ChannelEditor
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
          onEdit={handleEditChannel}
          onDelete={handleDeleteChannel}
          onToggle={handleToggleEnabled}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-text-muted">
          <div className="text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-5 border border-border-subtle">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
            </div>
            <p className="text-sm text-text-secondary font-medium">Select a channel</p>
            <p className="text-xs text-text-muted mt-1">or create a new one</p>
          </div>
        </div>
      )}
    </>
  )
}
