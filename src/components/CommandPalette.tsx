import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { ICON_DATA, IconifyIcon } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import { generateId } from '@/utils/helpers'
import type { Session } from '@/types'

interface PaletteItem {
  id: string
  type: 'session' | 'document' | 'agent' | 'skill' | 'model' | 'action'
  title: string
  subtitle?: string
  icon: string
  action: () => void
}

/** Programmatically open the command palette from anywhere (e.g. NavBar button). */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent('suora:command-palette:open'))
}

export function CommandPalette() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { sessions, documentNodes, setSelectedDocument, agents, skills, models, providerConfigs, setActiveSession, setSelectedAgent, addSession, selectedModel, selectedAgent } = useAppStore()

  // Listen for Cmd+K / Ctrl+K plus programmatic open events.
  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    const openHandler = () => setOpen(true)
    window.addEventListener('keydown', keyHandler)
    window.addEventListener('suora:command-palette:open', openHandler as EventListener)
    return () => {
      window.removeEventListener('keydown', keyHandler)
      window.removeEventListener('suora:command-palette:open', openHandler as EventListener)
    }
  }, [open])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      const focusTimer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(focusTimer)
    }
  }, [open])

  const items = useMemo<PaletteItem[]>(() => {
    const results: PaletteItem[] = []

    // Actions always available
    results.push(
      {
        id: 'action-new-chat',
        type: 'action',
        title: t('chat.newChat', 'New Chat'),
        subtitle: t('chat.startNew', 'Start a new conversation'),
        icon: 'action-chat',
        action: () => {
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
          navigate('/chat')
          setOpen(false)
        },
      },
      { id: 'action-pipeline', type: 'action', title: t('nav.pipeline', 'Pipeline'), subtitle: t('commandPalette.pipelineSubtitle', 'Build and run agent pipelines'), icon: 'skill-agent-comm', action: () => { navigate('/pipeline'); setOpen(false) } },
      { id: 'action-documents', type: 'action', title: t('nav.documents', 'Documents'), subtitle: t('commandPalette.documentsSubtitle', 'Write markdown notes and nested document groups'), icon: 'skill-code-review', action: () => { navigate('/documents'); setOpen(false) } },
      { id: 'action-settings', type: 'action', title: t('nav.settings', 'Settings'), subtitle: t('commandPalette.settingsSubtitle', 'Open settings page'), icon: 'action-settings', action: () => { navigate('/settings'); setOpen(false) } },
      { id: 'action-models', type: 'action', title: t('nav.models', 'Models'), subtitle: t('commandPalette.modelsSubtitle', 'Manage AI models'), icon: 'action-models', action: () => { navigate('/models'); setOpen(false) } },
      { id: 'action-mcp', type: 'action', title: t('nav.mcp', 'MCP Servers'), subtitle: t('commandPalette.mcpSubtitle', 'Configure MCP servers'), icon: 'ui-plugin', action: () => { navigate('/mcp'); setOpen(false) } },
      { id: 'action-agents', type: 'action', title: t('nav.agents', 'Agents'), subtitle: t('commandPalette.agentsSubtitle', 'View all agents'), icon: 'agent-robot', action: () => { navigate('/agents'); setOpen(false) } },
      { id: 'action-skills', type: 'action', title: t('nav.skills', 'Skills'), subtitle: t('commandPalette.skillsSubtitle', 'Manage skills'), icon: 'action-skills', action: () => { navigate('/skills'); setOpen(false) } },
      { id: 'action-timer', type: 'action', title: t('nav.timer', 'Timer'), subtitle: t('commandPalette.timerSubtitle', 'Scheduled tasks'), icon: 'action-timer', action: () => { navigate('/timer'); setOpen(false) } },
      { id: 'action-channels', type: 'action', title: t('nav.channels', 'Channels'), subtitle: t('commandPalette.channelsSubtitle', 'Platform integrations'), icon: 'action-channels', action: () => { navigate('/channels'); setOpen(false) } },
    )

    // Sessions
    for (const session of sessions.slice(0, 20)) {
      results.push({
        id: `session-${session.id}`,
        type: 'session',
        title: session.title,
        subtitle: `${session.messages.length} ${t('commandPalette.messages', 'messages')}`,
        icon: 'action-chat',
        action: () => { setActiveSession(session.id); navigate('/chat'); setOpen(false) },
      })
    }

    for (const document of documentNodes.filter((node) => node.type === 'document').slice(0, 20)) {
      results.push({
        id: `document-${document.id}`,
        type: 'document',
        title: document.title,
        subtitle: document.markdown.slice(0, 80).replace(/\s+/g, ' '),
        icon: 'skill-code-review',
        action: () => { setSelectedDocument(document.id); navigate('/documents'); setOpen(false) },
      })
    }

    // Agents
    for (const agent of agents) {
      results.push({
        id: `agent-${agent.id}`,
        type: 'agent',
        title: agent.name,
        subtitle: agent.systemPrompt.length > 60 ? agent.systemPrompt.slice(0, 60) + '…' : agent.systemPrompt,
        icon: agent.avatar || 'agent-robot',
        action: () => { setSelectedAgent(agent); navigate('/agents'); setOpen(false) },
      })
    }

    // Skills
    for (const skill of skills.slice(0, 20)) {
      results.push({
        id: `skill-${skill.id}`,
        type: 'skill',
        title: skill.name,
        subtitle: skill.description && skill.description.length > 60 ? skill.description.slice(0, 60) + '…' : skill.description,
        icon: 'action-skills',
        action: () => { navigate('/skills'); setOpen(false) },
      })
    }

    // Models
    for (const model of models) {
      const providerName = providerConfigs.find((p) => p.id === model.provider)?.name || model.provider
      results.push({
        id: `model-${model.id}`,
        type: 'model',
        title: model.name,
        subtitle: providerName,
        icon: 'action-models',
        action: () => { navigate('/models'); setOpen(false) },
      })
    }

    return results
  }, [sessions, documentNodes, setSelectedDocument, agents, skills, models, providerConfigs, navigate, setActiveSession, setSelectedAgent, addSession, selectedAgent, selectedModel, t])

  const filtered = useMemo(() => {
    if (!query.trim()) return items.filter((i) => i.type === 'action')
    const q = query.toLowerCase()
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle?.toLowerCase().includes(q) ||
        item.type.includes(q)
    )
  }, [items, query])

  // Reset selected index when filtered changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [filtered.length])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && !e.nativeEvent.isComposing && filtered[selectedIndex]) {
        e.preventDefault()
        filtered[selectedIndex].action()
      }
    },
    [filtered, selectedIndex]
  )

  // Scroll selected item into view
  useEffect(() => {
    const selectedItem = filtered[selectedIndex]
    const el = selectedItem ? document.getElementById(`cp-item-${selectedItem.id}`) : null
    el?.scrollIntoView({ block: 'nearest' })
  }, [filtered, selectedIndex])

  if (!open) return null

  const typeLabel: Record<string, string> = {
    action: t('commandPalette.actions', 'Actions'),
    session: t('sessions.title', 'Sessions'),
    document: t('nav.documents', 'Documents'),
    agent: t('nav.agents', 'Agents'),
    skill: t('nav.skills', 'Skills'),
    model: t('nav.models', 'Models'),
  }

  // Group items by type
  const grouped: { type: string; items: { item: PaletteItem; globalIdx: number }[] }[] = []
  let currentType = ''
  filtered.forEach((item, idx) => {
    if (item.type !== currentType) {
      currentType = item.type
      grouped.push({ type: currentType, items: [] })
    }
    grouped[grouped.length - 1].items.push({ item, globalIdx: idx })
  })

  return (
    <div
      role="dialog"
      aria-label={t('nav.commandPalette', 'Command palette')}
      aria-modal="true"
      className="fixed inset-0 z-100 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="glass-strong w-full max-w-lg border rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="command-palette-search flex items-center gap-3 px-4 py-3 border-b focus-within:shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.18)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted shrink-0">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label={t('commandPalette.search', 'Search commands')}
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-describedby="command-palette-hint"
            aria-activedescendant={filtered[selectedIndex] ? `cp-item-${filtered[selectedIndex].id}` : undefined}
            placeholder={t('commandPalette.searchPlaceholder', 'Search sessions, agents, skills, models…')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <kbd className="text-[10px] text-text-muted px-1.5 py-0.5 bg-surface-2 border border-border-subtle rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} id="command-palette-list" role="listbox" aria-label={t('commandPalette.results', 'Search results')} className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              {t('commandPalette.noResults', 'No results found')}
            </div>
          )}
          {grouped.map((group) => (
            <div key={group.type}>
              <div className="px-4 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                {typeLabel[group.type] || group.type}
              </div>
              {group.items.map(({ item, globalIdx }) => (
                <button
                  key={item.id}
                  id={`cp-item-${item.id}`}
                  role="option"
                  {...{ 'aria-selected': globalIdx === selectedIndex ? 'true' : 'false' }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    globalIdx === selectedIndex
                      ? 'nav-item-active text-accent'
                      : 'glass-hover text-text-primary'
                  }`}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(globalIdx)}
                >
                  <span className="text-base shrink-0">{ICON_DATA[item.icon] ? <IconifyIcon name={item.icon} size={18} /> : item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{item.title}</div>
                    {item.subtitle && (
                      <div className="truncate text-xs text-text-muted">{item.subtitle}</div>
                    )}
                  </div>
                  <span className="text-[10px] text-text-muted/60 shrink-0">{typeLabel[item.type]}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div id="command-palette-hint" className="px-4 py-2 border-t border-border-subtle flex items-center gap-4 text-[10px] text-text-muted">
          <span>{t('commandPalette.navigateHint', '↑↓ Navigate')}</span>
          <span>{t('commandPalette.openHint', '↵ Open')}</span>
          <span>{t('commandPalette.closeHint', 'ESC Close')}</span>
        </div>
      </div>
    </div>
  )
}
