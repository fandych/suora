import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { ChannelPlatformIcon } from './ChannelIcons'
import { ChannelMessageBubble } from './ChannelComponents'

// ─── Channel Message History Panel ─────────────────────────────────

export function ChannelMessageHistory({ channelId }: { channelId?: string }) {
  const { channelMessages, channels, channelUsers, clearChannelMessages } = useAppStore()
  const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing'>('all')
  const [userFilter, setUserFilter] = useState<string>('all') // 'all' or a senderId
  const scrollRef = useRef<HTMLDivElement>(null)

  // Get unique senders for this channel
  const channelSenders = channelId
    ? Object.values(channelUsers).filter((u) => u.channelId === channelId)
    : []

  const filtered = channelMessages
    .filter((m) => (!channelId || m.channelId === channelId))
    .filter((m) => filter === 'all' || m.direction === filter)
    .filter((m) => userFilter === 'all' || m.senderId === userFilter)

  const getChannel = (id: string) => channels.find((c) => c.id === id)

  // Auto-scroll to bottom when new messages arrive (not on filter changes)
  const prevMsgCountRef = useRef(channelMessages.length)
  useEffect(() => {
    if (channelMessages.length > prevMsgCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevMsgCountRef.current = channelMessages.length
  }, [channelMessages.length])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex gap-1.5 items-center flex-wrap">
          {(['all', 'incoming', 'outgoing'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filter === f ? 'bg-accent/15 text-accent' : 'text-text-muted hover:bg-surface-2'}`}>
              {f === 'all' ? 'All' : f === 'incoming' ? '↓ In' : '↑ Out'}
            </button>
          ))}
          {channelSenders.length > 1 && (
            <>
              <span className="text-border mx-0.5">│</span>
              <label className="sr-only" htmlFor="channel-user-filter">Filter by user</label>
              <select
                id="channel-user-filter"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                aria-label="Filter by user"
                className="px-2 py-1 bg-surface-2 border border-border-subtle rounded-md text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/20 max-w-[140px]"
              >
                <option value="all">All users</option>
                {channelSenders.map((u) => (
                  <option key={u.senderId} value={u.senderId}>
                    {u.senderName} ({u.messageCount})
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted">{filtered.length} messages</span>
          <button onClick={() => clearChannelMessages(channelId)}
            className="text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded-md transition-colors">
            Clear
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <span className="text-3xl mb-3"><IconifyIcon name="action-chat" size={32} /></span>
            <p className="text-xs">No messages yet</p>
            <p className="text-[10px] mt-1 text-text-muted/60">Messages from connected channels will appear here</p>
          </div>
        ) : filtered.map((msg) => (
          <ChannelMessageBubble
            key={msg.id}
            msg={msg}
            showChannel={!channelId ? (getChannel(msg.channelId)?.name || msg.channelId) : undefined}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Channel Health Monitor Panel ──────────────────────────────────

export function ChannelHealthMonitor({ singleChannelId }: { singleChannelId?: string }) {
  const { channels, channelHealth, setChannelHealth } = useAppStore()
  const [checking, setChecking] = useState(false)
  const targetChannels = singleChannelId ? channels.filter((c) => c.id === singleChannelId) : channels

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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Channel Health Status</h3>
        <button onClick={checkHealth} disabled={checking}
          className="px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-xs font-medium hover:bg-accent/20 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5">
          {checking ? 'Checking...' : <><IconifyIcon name="ui-search" size={14} color="currentColor" /> Check All</>}
        </button>
      </div>
      <div className="space-y-3">
        {targetChannels.length === 0 ? (
          <p className="text-xs text-text-muted text-center">No channels configured</p>
        ) : targetChannels.map((ch) => {
          const health = channelHealth[ch.id]
          return (
            <div key={ch.id} className="p-4 rounded-lg bg-surface-1 border border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${
                  !health ? 'bg-gray-500' :
                  health.isHealthy ? 'bg-green-400' : 'bg-red-400'
                }`} />
                <div>
                  <span className="text-sm font-medium text-text-primary">{ch.name}</span>
                  <span className="text-xs text-text-muted ml-2">{ch.platform}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-muted">
                {health ? (
                  <>
                    <span>{health.isHealthy ? <span className="inline-flex items-center gap-1"><IconifyIcon name="ui-check" size={12} color="currentColor" /> Healthy</span> : <span className="inline-flex items-center gap-1"><IconifyIcon name="ui-cross" size={12} color="currentColor" /> Unhealthy</span>}</span>
                    {health.latencyMs !== undefined && <span>{health.latencyMs}ms</span>}
                    {health.errorCount > 0 && <span className="text-red-400">{health.errorCount} errors</span>}
                    <span>{new Date(health.lastCheckAt).toLocaleTimeString()}</span>
                  </>
                ) : (
                  <span>Not checked</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Channel Debug / Mock Mode ─────────────────────────────────────

export function ChannelDebugPanel({ defaultChannelId }: { defaultChannelId?: string }) {
  const { channels } = useAppStore()
  const [selectedChannelId, setSelectedChannelId] = useState(defaultChannelId || channels[0]?.id || '')
  const [mockMessage, setMockMessage] = useState('')
  const [debugLog, setDebugLog] = useState<Array<{ time: string; text: string }>>([])
  const [sending, setSending] = useState(false)

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
    <div className="p-6 flex flex-col h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Debug / Mock Mode</h3>
        <p className="text-xs text-text-muted mb-4">Send simulated messages without connecting to real platforms.</p>
        <div className="flex gap-2 mb-3">
          <select value={selectedChannelId} onChange={(e) => setSelectedChannelId(e.target.value)}
            aria-label="Select channel"
            className="flex-1 px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20">
            {channels.map((ch) => <option key={ch.id} value={ch.id}>{ch.name} ({ch.platform})</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <input value={mockMessage} onChange={(e) => setMockMessage(e.target.value)}
            placeholder="Type a mock message..."
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); sendMock() } }}
            className="flex-1 px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20" />
          <button onClick={sendMock} disabled={sending || !mockMessage.trim()}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50">
            Send
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 bg-surface-1 rounded-lg border border-border-subtle font-mono text-xs space-y-1">
        {debugLog.length === 0 ? (
          <p className="text-text-muted text-center mt-4">Debug log will appear here</p>
        ) : debugLog.map((entry, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-text-muted shrink-0">[{entry.time}]</span>
            <span className={entry.text.startsWith('Error') ? 'text-red-400' : entry.text.startsWith('Mock message processed') ? 'text-green-400' : 'text-text-secondary'}>
              {entry.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Channel Users Panel (multi-user tracking) ────────────────────

export function ChannelUsersPanel({ channelId }: { channelId: string }) {
  const { channelUsers, clearChannelUsers } = useAppStore()

  const users = Object.values(channelUsers)
    .filter((u) => u.channelId === channelId)
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)

  const formatRelativeTime = (ts: number) => {
    const diff = Date.now() - ts
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return `${Math.floor(diff / 86400000)}d ago`
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-primary">
            <IconifyIcon name="ui-users" size={14} color="currentColor" /> {users.length} user{users.length !== 1 ? 's' : ''}
          </span>
        </div>
        {users.length > 0 && (
          <button onClick={() => clearChannelUsers(channelId)}
            className="text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded-md transition-colors">
            Clear Users
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <span className="text-3xl mb-3"><IconifyIcon name="ui-user" size={32} color="currentColor" /></span>
            <p className="text-xs">No users yet</p>
            <p className="text-[10px] mt-1 text-text-muted/60">Users will appear here when they send messages</p>
          </div>
        ) : users.map((user) => (
          <div key={user.id} className="px-4 py-3 border-b border-border-subtle/50 hover:bg-surface-1/50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center shrink-0 border border-accent/10 shadow-sm">
                  <ChannelPlatformIcon platform={user.platform} size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-text-primary truncate">{user.senderName}</div>
                  <div className="text-[10px] text-text-muted truncate">{user.senderId}</div>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <div className="text-[10px] font-medium text-accent">{user.messageCount} msg{user.messageCount !== 1 ? 's' : ''}</div>
                <div className="text-[10px] text-text-muted">{formatRelativeTime(user.lastActiveAt)}</div>
              </div>
            </div>
            {user.conversationHistory.length > 0 && (
              <div className="ml-10.5 mt-1.5">
                <div className="text-[10px] text-text-muted/60 mb-1">Recent context ({user.conversationHistory.length} messages)</div>
                <div className="space-y-0.5">
                  {user.conversationHistory.slice(-3).map((h, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[10px]">
                      <span className={`shrink-0 font-medium ${h.role === 'user' ? 'text-accent/70' : 'text-green-400/70'}`}>
                        {h.role === 'user' ? '→' : '←'}
                      </span>
                      <span className="text-text-muted/80 line-clamp-1 break-all">{h.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
