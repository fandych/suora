import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { SidePanel } from '@/components/layout/SidePanel'
import { generateId } from '@/utils/helpers'
import type { Session } from '@/types'
import { AgentAvatar, IconifyIcon } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import { confirm } from '@/services/confirmDialog'

export function SessionList({ width }: { width?: number }) {
  const { sessions, activeSessionId, addSession, openSessionTab, removeSession, updateSession, models, agents, selectedModel, selectedAgent } = useAppStore()
  const { t } = useI18n()
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sessionId: string } | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const handleNewSession = () => {
    const session: Session = {
      id: generateId('session'),
      title: t('chat.newChat', 'New Chat'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      agentId: selectedAgent?.id,
      modelId: selectedModel?.id,
      messages: [],
    }
    addSession(session)
  }

  // Filter sessions by search query
  const filteredSessions = searchQuery.trim()
    ? sessions.filter((s) => {
        const q = searchQuery.toLowerCase()
        return s.title.toLowerCase().includes(q) ||
          s.messages.some((m) => m.content.toLowerCase().includes(q))
      })
    : sessions

  // Group sessions by date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const groups: { label: string; items: Session[] }[] = []
  const todayItems = filteredSessions.filter((s) => s.updatedAt >= today.getTime())
  const yesterdayItems = filteredSessions.filter((s) => s.updatedAt >= yesterday.getTime() && s.updatedAt < today.getTime())
  const olderItems = filteredSessions.filter((s) => s.updatedAt < yesterday.getTime())

  if (todayItems.length) groups.push({ label: t('sessions.today', 'Today'), items: todayItems })
  if (yesterdayItems.length) groups.push({ label: t('sessions.yesterday', 'Yesterday'), items: yesterdayItems })
  if (olderItems.length) groups.push({ label: t('sessions.earlier', 'Earlier'), items: olderItems })

  // Handle rename
  const startRename = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session) return
    setEditingId(sessionId)
    setEditTitle(session.title)
    setContextMenu(null)
    setTimeout(() => editInputRef.current?.focus(), 50)
  }

  const commitRename = () => {
    if (editingId && editTitle.trim()) {
      updateSession(editingId, { title: editTitle.trim() })
    }
    setEditingId(null)
  }

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, sessionId })
  }

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [contextMenu])

  const getSessionMeta = (session: Session) => {
    const agent = session.agentId ? agents.find((a) => a.id === session.agentId) : null
    const model = session.modelId ? models.find((m) => m.id === session.modelId) : null
    return { agent, model }
  }

  return (
    <SidePanel
      title={t('sessions.title', 'Sessions')}
      width={width}
      action={
        <button
          type="button"
          onClick={handleNewSession}
          className="text-[12px] px-3.5 py-2 rounded-xl bg-accent/10 text-accent hover:bg-accent/20 transition-all duration-200 font-semibold flex items-center gap-2 hover:shadow-sm border border-accent/10 hover:border-accent/20"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {t('sessions.new', 'New')}
        </button>
      }
    >
      {/* Search box */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/40">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('sessions.search', 'Search sessions...')}
            className="w-full pl-10 pr-4 py-3 text-[14px] bg-surface-2/40 border border-border-subtle/40 rounded-[14px] text-text-primary placeholder-text-muted/40 focus:outline-none focus:ring-1 focus:ring-accent/25 focus:border-accent/20 transition-all"
          />
          {searchQuery && (
            <button type="button" title="Clear search" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"><IconifyIcon name="ui-close" size={16} color="currentColor" /></button>
          )}
        </div>
      </div>

      <div className="p-3">
        {filteredSessions.length === 0 && (
          <div className="px-4 py-16 text-center">
            <div className="w-14 h-14 rounded-[18px] bg-surface-3/30 flex items-center justify-center mx-auto mb-4 border border-border-subtle/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted/40"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <p className="text-[14px] text-text-muted/70 leading-relaxed">{searchQuery ? t('sessions.noMatching', 'No matching sessions') : t('sessions.noConversations', 'No conversations yet')}</p>
            {!searchQuery && <p className="text-[11px] text-text-muted/40 mt-2">{t('sessions.clickNewToStart', 'Click + New to start')}</p>}
          </div>
        )}
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="font-display text-[10px] font-semibold text-text-muted/40 uppercase tracking-[0.18em] px-4 mb-2">{group.label}</div>
            {group.items.map((session) => {
              const { agent } = getSessionMeta(session)
              const isActive = activeSessionId === session.id
              const msgCount = session.messages.length
              const isEditing = editingId === session.id
              return (
                <div
                  key={session.id}
                  onClick={() => { if (!isEditing) openSessionTab(session.id) }}
                  onContextMenu={(e) => handleContextMenu(e, session.id)}
                  onDoubleClick={() => startRename(session.id)}
                  className={`group flex items-center justify-between px-4 py-3.5 rounded-[14px] cursor-pointer transition-all duration-200 mb-1 ${
                    isActive
                      ? 'bg-accent/8 text-text-primary shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.12)]'
                      : 'text-text-secondary hover:bg-surface-3/30 hover:text-text-primary'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <input
                        ref={editInputRef}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) commitRename(); if (e.key === 'Escape') setEditingId(null) }}
                        aria-label="Session title"
                        className="text-[14px] font-medium w-full bg-surface-0/80 border border-accent/30 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30 text-text-primary"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="text-[14px] truncate font-medium leading-snug">{session.title}</div>
                    )}
                    <div className="flex items-center gap-2.5 mt-1">
                      {agent && <span className="text-[11px] text-text-muted/60 truncate inline-flex items-center gap-1.5"><AgentAvatar avatar={agent.avatar} size={13} /> {agent.name}</span>}
                      {msgCount > 0 && <span className="text-[10px] text-text-muted/30 font-medium">{msgCount} {t('sessions.msgs', 'msgs')}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    title={t('sessions.removeSession', 'Delete session')}
                    onClick={async (e) => {
                      e.stopPropagation()
                      const ok = await confirm({
                        title: t('sessions.deleteTitle', 'Delete conversation?'),
                        body: t(
                          'sessions.deleteBody',
                          `"${session.title}" and its ${session.messages.length} messages will be permanently deleted.`,
                        ),
                        danger: true,
                        confirmText: t('common.delete', 'Delete'),
                      })
                      if (ok) removeSession(session.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger p-1.5 rounded-lg hover:bg-danger/10 transition-all duration-150 shrink-0"
                  >
                    <IconifyIcon name="ui-close" size={16} color="currentColor" />
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-surface-2/95 backdrop-blur-xl border border-border/60 rounded-[14px] shadow-2xl py-1.5 min-w-44 animate-fade-in-scale"
          {...{ style: { left: contextMenu.x, top: contextMenu.y } }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={() => startRename(contextMenu.sessionId)} className="w-full text-left px-4 py-2.5 text-[13px] text-text-secondary hover:bg-surface-3/50 hover:text-text-primary transition-colors flex items-center gap-2.5">
            <IconifyIcon name="ui-edit" size={15} color="currentColor" /> {t('common.rename', 'Rename')}
          </button>
          <button
            type="button"
            onClick={() => {
              const session = sessions.find((s) => s.id === contextMenu.sessionId)
              if (session) {
                const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `session-${session.title.replace(/\s+/g, '-')}.json`
                a.click()
                URL.revokeObjectURL(url)
              }
              setContextMenu(null)
            }}
            className="w-full text-left px-4 py-2.5 text-[13px] text-text-secondary hover:bg-surface-3/50 hover:text-text-primary transition-colors flex items-center gap-2.5"
          >
            <IconifyIcon name="ui-export" size={15} color="currentColor" /> {t('common.export', 'Export')}
          </button>
          <div className="separator-gradient mx-2 my-1" />
          <button
            type="button"
            onClick={async () => {
              const session = sessions.find((s) => s.id === contextMenu.sessionId)
              const title = session?.title ?? t('sessions.thisConversation', 'this conversation')
              const count = session?.messages.length ?? 0
              setContextMenu(null)
              const ok = await confirm({
                title: t('sessions.deleteTitle', 'Delete conversation?'),
                body: t(
                  'sessions.deleteBody',
                  `"${title}" and its ${count} messages will be permanently deleted.`,
                ),
                danger: true,
                confirmText: t('common.delete', 'Delete'),
              })
              if (ok) removeSession(contextMenu.sessionId)
            }}
            className="w-full text-left px-4 py-2.5 text-[13px] text-danger hover:bg-danger/10 transition-colors flex items-center gap-2.5"
          >
            <IconifyIcon name="ui-trash" size={15} color="currentColor" /> {t('common.delete', 'Delete')}
          </button>
        </div>
      )}
    </SidePanel>
  )
}
