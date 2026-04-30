import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { SidePanel } from '@/components/layout/SidePanel'
import { generateId } from '@/utils/helpers'
import type { Session } from '@/types'
import { AgentAvatar, IconifyIcon } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import { confirm } from '@/services/confirmDialog'
import { toast } from '@/services/toast'
import { safeStringify } from '@/utils/safeJson'

function formatSessionRelativeTime(ts: number, locale = 'en'): string {
  const diffSeconds = Math.round((ts - Date.now()) / 1000)
  const absSeconds = Math.abs(diffSeconds)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (absSeconds < 45) return formatter.format(0, 'second')
  if (absSeconds < 3600) return formatter.format(Math.round(diffSeconds / 60), 'minute')
  if (absSeconds < 86400) return formatter.format(Math.round(diffSeconds / 3600), 'hour')
  if (absSeconds < 604800) return formatter.format(Math.round(diffSeconds / 86400), 'day')

  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(ts)
}

function getSessionPreview(session: Session, t: (key: string, fallback: string) => string): string {
  const lastMessage = session.messages[session.messages.length - 1]
  if (!lastMessage) return t('sessions.noPreview', 'No messages yet')

  const content = lastMessage.content.replace(/\s+/g, ' ').trim()
  if (content) return content

  if ((lastMessage.attachments?.length ?? 0) > 0) {
    return t('sessions.attachmentPreview', 'Attachment-only message')
  }

  return t('sessions.emptyPreview', 'Empty message')
}

function groupSessionsByDate(sessions: Session[], t: (key: string, fallback: string) => string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const groups: Array<{ label: string; items: Session[] }> = []
  const todayItems = sessions.filter((session) => session.updatedAt >= today.getTime())
  const yesterdayItems = sessions.filter((session) => session.updatedAt >= yesterday.getTime() && session.updatedAt < today.getTime())
  const olderItems = sessions.filter((session) => session.updatedAt < yesterday.getTime())

  if (todayItems.length > 0) groups.push({ label: t('sessions.today', 'Today'), items: todayItems })
  if (yesterdayItems.length > 0) groups.push({ label: t('sessions.yesterday', 'Yesterday'), items: yesterdayItems })
  if (olderItems.length > 0) groups.push({ label: t('sessions.earlier', 'Earlier'), items: olderItems })

  return groups
}

export function SessionList({ width }: { width?: number }) {
  const { sessions, activeSessionId, addSession, openSessionTab, openSessionTabs, removeSession, updateSession, models, agents, selectedModel, selectedAgent } = useAppStore()
  const { t, locale } = useI18n()
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sessionId: string } | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current)
    }
  }, [])

  const handleNewSession = () => {
    if (!selectedModel) {
      toast.warning('No model configured', 'Please add a model provider in Models settings first.')
      return
    }
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

  const filteredSessions = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase()
    if (!query) return sessions

    return sessions.filter((session) =>
      session.title.toLowerCase().includes(query) ||
      session.messages.some((message) => message.content.toLowerCase().includes(query)),
    )
  }, [sessions, deferredSearchQuery])

  const orderedSessions = useMemo(
    () => [...filteredSessions].sort((a, b) => b.updatedAt - a.updatedAt),
    [filteredSessions],
  )

  const groups = useMemo(
    () => groupSessionsByDate(orderedSessions, t),
    [orderedSessions, t],
  )

  const startRename = (sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId)
    if (!session) return
    setEditingId(sessionId)
    setEditTitle(session.title)
    setContextMenu(null)
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current)
    focusTimerRef.current = setTimeout(() => editInputRef.current?.focus(), 50)
  }

  const commitRename = () => {
    if (editingId && editTitle.trim()) {
      updateSession(editingId, { title: editTitle.trim() })
    }
    setEditingId(null)
  }

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault()
    const MENU_WIDTH = 160
    const MENU_HEIGHT = 176
    const x = Math.min(e.clientX, window.innerWidth - MENU_WIDTH - 8)
    const y = Math.min(e.clientY, window.innerHeight - MENU_HEIGHT - 8)
    setContextMenu({ x, y, sessionId })
  }

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
      <div className="px-3 pb-4 pt-3 space-y-3">
        <div className="rounded-2xl border border-border-subtle/55 bg-surface-0/48 p-3 shadow-sm">
          <div className="relative">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/40">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('sessions.search', 'Search sessions...')}
              className="w-full rounded-2xl border border-border-subtle/55 bg-surface-2/80 py-2.5 pl-10 pr-10 text-[13px] text-text-primary placeholder-text-muted/45 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            {searchQuery && (
              <button
                type="button"
                title={t('sessions.clearSearch', 'Clear search')}
                aria-label={t('sessions.clearSearch', 'Clear search')}
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                <IconifyIcon name="ui-close" size={16} color="currentColor" />
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted/70">
            <span>{filteredSessions.length} {t('common.results', 'results')}</span>
            {searchQuery && <span>{sessions.length} {t('common.total', 'total')}</span>}
          </div>
        </div>

        {filteredSessions.length === 0 && (
          <div className="rounded-[26px] border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] border border-border-subtle/30 bg-surface-3/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted/40"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <p className="text-[13px] text-text-muted/75 leading-relaxed">{searchQuery ? t('sessions.noMatching', 'No matching sessions') : t('sessions.noConversations', 'No conversations yet')}</p>
            {!searchQuery && <p className="mt-2 text-[11px] text-text-muted/45">{t('sessions.clickNewToStart', 'Click + New to start')}</p>}
          </div>
        )}

        {groups.map((group) => (
          <section key={group.label} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="font-display text-[10px] font-semibold text-text-muted/40 uppercase tracking-[0.18em]">{group.label}</div>
              <div className="text-[10px] text-text-muted/40">{group.items.length}</div>
            </div>

            {group.items.map((session) => {
              const { agent, model } = getSessionMeta(session)
              const isActive = activeSessionId === session.id
              const msgCount = session.messages.length
              const isEditing = editingId === session.id
              const isOpen = openSessionTabs.includes(session.id)
              const preview = getSessionPreview(session, t)

              return (
                <div
                  key={session.id}
                  onContextMenu={(e) => handleContextMenu(e, session.id)}
                  className={`group rounded-2xl border transition-all duration-200 ${
                    isActive
                      ? 'border-accent/20 bg-accent/10 text-text-primary shadow-[0_14px_34px_rgba(var(--t-accent-rgb),0.07)]'
                      : 'border-transparent bg-surface-1/18 text-text-secondary hover:border-border-subtle/60 hover:bg-surface-3/55 hover:text-text-primary'
                  }`}
                >
                  {isEditing ? (
                    <div className="min-w-0 flex-1 p-3.5">
                      <input
                        ref={editInputRef}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) commitRename(); if (e.key === 'Escape') setEditingId(null) }}
                        aria-label={t('sessions.titleField', 'Session title')}
                        className="w-full rounded-2xl border border-accent/30 bg-surface-0/80 px-3.5 py-3 text-[13px] font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 p-3.5">
                      <button
                        type="button"
                        onClick={() => openSessionTab(session.id)}
                        onDoubleClick={() => startRename(session.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className="min-w-0 flex flex-1 items-start gap-3 text-left focus:outline-none"
                      >
                        <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm ${
                          isActive
                            ? 'border-accent/22 bg-accent/12 text-accent'
                            : 'border-border-subtle/45 bg-surface-0/78 text-text-muted'
                        }`}>
                          {agent ? <AgentAvatar avatar={agent.avatar} size={18} /> : <IconifyIcon name="ui-sparkles" size={16} color="currentColor" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <div className="truncate text-[13px] font-semibold text-text-primary">{session.title}</div>
                            {isOpen && (
                              <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold text-accent">
                                {t('sessions.live', 'Live')}
                              </span>
                            )}
                          </div>

                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-text-secondary/78">{preview}</p>

                          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-text-muted">
                            {agent && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-surface-0/70 px-2 py-0.5">
                                <AgentAvatar avatar={agent.avatar} size={12} />
                                <span className="truncate max-w-24">{agent.name}</span>
                              </span>
                            )}
                            {model && <span className="rounded-full bg-surface-0/70 px-2 py-0.5 truncate max-w-28">{model.name}</span>}
                            <span className="rounded-full bg-surface-0/70 px-2 py-0.5">{msgCount} {t('sessions.msgs', 'msgs')}</span>
                          </div>
                        </div>
                      </button>

                      <div className="flex shrink-0 flex-col items-end gap-2 pl-1.5">
                        <span className="text-[10px] text-text-muted/52">{formatSessionRelativeTime(session.updatedAt, locale)}</span>
                        <button
                          type="button"
                          title={t('sessions.removeSession', 'Delete session')}
                          aria-label={`${t('sessions.removeSession', 'Delete session')}: ${session.title}`}
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
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-0/68 text-text-muted/70 transition-colors hover:bg-danger/10 hover:text-danger"
                        >
                          <IconifyIcon name="ui-close" size={15} color="currentColor" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        ))}
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 min-w-44 rounded-2xl border border-border/60 bg-surface-2/95 py-1.5 shadow-2xl backdrop-blur-xl animate-fade-in-scale"
          {...{ style: { left: contextMenu.x, top: contextMenu.y } }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={() => startRename(contextMenu.sessionId)} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-text-secondary transition-colors hover:bg-surface-3/50 hover:text-text-primary">
            <IconifyIcon name="ui-edit" size={15} color="currentColor" /> {t('common.rename', 'Rename')}
          </button>
          <button
            type="button"
            onClick={() => {
              const session = sessions.find((s) => s.id === contextMenu.sessionId)
              if (session) {
                const blob = new Blob([safeStringify(session, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `session-${session.title.replace(/\s+/g, '-')}.json`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
              }
              setContextMenu(null)
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-text-secondary transition-colors hover:bg-surface-3/50 hover:text-text-primary"
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
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-danger transition-colors hover:bg-danger/10"
          >
            <IconifyIcon name="ui-trash" size={15} color="currentColor" /> {t('common.delete', 'Delete')}
          </button>
        </div>
      )}
    </SidePanel>
  )
}
