import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { SidePanel } from '@/components/layout/SidePanel'
import { generateId } from '@/utils/helpers'
import { loadAgentsFromDisk, saveAgentToDisk, deleteAgentFromDisk } from '@/services/agentFiles'
import { AgentAvatar, IconifyIcon } from '@/components/icons/IconifyIcons'
import type { Agent, Session } from '@/types'
import { AgentTestChat } from './AgentTestChat'
import { AgentEditor } from './AgentEditor'
import { AgentOrchestrationPanel } from './AgentOrchestrationPanel'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { useResizablePanel } from '@/hooks/useResizablePanel'
import { confirm } from '@/services/confirmDialog'
import { toast } from '@/services/toast'

const DEFAULT_AGENT_ID = 'default-assistant'

// ─── Agent List (sidebar sub-component) ────────────────────────────

function AgentList({
  agents,
  editingId,
  searchQuery,
  onSearchChange,
  onSelect,
  onStartChat,
  onDuplicate,
  onExport,
  onDelete,
  onContextMenu,
}: {
  agents: Agent[]
  editingId: string | null
  searchQuery: string
  onSearchChange: (q: string) => void
  onSelect: (agent: Agent) => void
  onStartChat: (agent: Agent) => void
  onDuplicate: (agent: Agent) => void
  onExport: (agent: Agent) => void
  onDelete: (id: string) => void
  onContextMenu: (e: React.MouseEvent, agent: Agent) => void
}) {
  const { t } = useI18n()
  const filteredAgents = searchQuery.trim()
    ? agents.filter((a) =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.systemPrompt.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : agents

  return (
    <div className="p-2 space-y-1">
      {/* Search */}
      {agents.length > 3 && (
        <div className="px-1 pb-2">
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('agents.search', 'Search agents...')}
            className="w-full px-2.5 py-1.5 rounded-lg bg-surface-2 border border-border text-xs text-text-secondary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
      )}

      {filteredAgents.length === 0 && (
        <p className="text-xs text-text-muted px-2 py-8 text-center">
          {searchQuery ? t('agents.noMatching', 'No matching agents.') : t('agents.noAgents', 'No agents. Click + New to create one.')}
        </p>
      )}
      {filteredAgents.map((agent) => {
        const isDefault = agent.id === DEFAULT_AGENT_ID
        const isBuiltin = agent.id.startsWith('builtin-') || agent.id === 'default-assistant'
        const sourceBadge = isBuiltin ? 'builtin' : null
        return (
          <div
            key={agent.id}
            onClick={() => onSelect(agent)}
            onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, agent) }}
            className={`group px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
              editingId === agent.id
                ? 'bg-accent/10 text-text-primary shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.15)]'
                : 'text-text-secondary hover:bg-surface-3/60 hover:text-text-primary'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {agent.color && (
                  <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 shrink-0" aria-hidden="true">
                    <circle cx="5" cy="5" r="5" fill={agent.color} />
                  </svg>
                )}
                <span className="shrink-0"><AgentAvatar avatar={agent.avatar} size={20} /></span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium truncate">{agent.name}</span>
                    {!agent.enabled && (
                      <span className="text-[9px] uppercase tracking-wider text-text-muted bg-surface-3 px-1.5 py-0.5 rounded-md shrink-0">{t('common.off', 'off')}</span>
                    )}
                    {sourceBadge && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 shrink-0">{t('agents.builtin', 'builtin')}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-text-muted truncate">{agent.systemPrompt.slice(0, 40)}...</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {agent.autoLearn && <span className="text-[10px] text-success">{t('agents.autoLearn', 'Auto-learn')}</span>}
                    {!!agent.memories?.length && <span className="text-[10px] text-text-muted">{agent.memories.length} {t('agents.memoriesCount', 'memories')}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onStartChat(agent) }}
                  title={t('agents.startChat', 'Start chat with this agent')}
                  className="text-text-muted hover:text-accent text-xs px-1 transition-colors"
                >
                  <IconifyIcon name="ui-chat" size={14} color="currentColor" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDuplicate(agent) }}
                  title={t('agents.duplicateAgent', 'Duplicate agent')}
                  className="text-text-muted hover:text-accent text-xs px-1 transition-colors"
                >
                  ⧉
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onExport(agent) }}
                  title={t('agents.exportJson', 'Export agent as JSON')}
                  className="text-text-muted hover:text-accent text-xs px-1 transition-colors"
                >
                  ↓
                </button>
                {!isDefault && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(agent.id) }}
                    title={t('agents.deleteAgent', 'Delete agent')}
                    className="text-text-muted hover:text-danger text-xs px-1 transition-colors"
                  >
                    <IconifyIcon name="ui-close" size={14} color="currentColor" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Agents Layout (main) ──────────────────────────────────────────

export function AgentsLayout() {
  const { t } = useI18n()
  const [panelWidth, setPanelWidth] = useResizablePanel('agents', 280)
  const { agents, addAgent, updateAgent, removeAgent, setSelectedAgent, addSession, setActiveSession, setActiveModule, workspacePath, addAgentVersion } = useAppStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [testAgent, setTestAgent] = useState<Agent | null>(null)
  const [showHub, setShowHub] = useState(false)
  const [sideTab, setSideTab] = useState<'local' | 'marketplace'>('local')
  const [marketSearch, setMarketSearch] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; agent: Agent } | null>(null)
  const ctxRef = useRef<HTMLDivElement>(null)

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!ctxMenu) return
    const handleClick = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null)
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtxMenu(null) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey) }
  }, [ctxMenu])

  const editingAgent = editingId ? agents.find((a) => a.id === editingId) ?? null : null

  // Load agents from disk on mount when workspace is configured
  useEffect(() => {
    if (!workspacePath) return
    loadAgentsFromDisk(workspacePath).then((diskAgents) => {
      const storeIds = new Set(useAppStore.getState().agents.map((a) => a.id))
      for (const agent of diskAgents) {
        if (!storeIds.has(agent.id)) {
          addAgent(agent)
        }
      }
    })
  }, [workspacePath])

  const handleSave = (agent: Agent) => {
    if (editingId) {
      updateAgent(editingId, agent)
    } else {
      addAgent(agent)
    }
    if (workspacePath) saveAgentToDisk(workspacePath, agent)
    // Create version snapshot
    const existingVersions = useAppStore.getState().agentVersions.filter((v) => v.agentId === agent.id)
    const { memories: _mem, ...snapshotData } = agent
    addAgentVersion({
      id: generateId('aver'),
      agentId: agent.id,
      version: existingVersions.length + 1,
      snapshot: snapshotData,
      createdAt: Date.now(),
    })
    setEditingId(null)
    setIsAdding(false)
  }

  const handleDelete = async (id: string) => {
    if (id === DEFAULT_AGENT_ID) return // protect default agent
    const agent = agents.find((a) => a.id === id)
    if (!agent) return
    const ok = await confirm({
      title: t('agents.deleteTitle', 'Delete agent?'),
      body: t('agents.deleteBody', `"${agent.name}" will be permanently deleted. This cannot be undone.`),
      danger: true,
      confirmText: t('common.delete', 'Delete'),
    })
    if (!ok) return
    removeAgent(id)
    if (workspacePath) deleteAgentFromDisk(workspacePath, id)
    if (editingId === id) setEditingId(null)
  }

  const handleDuplicate = (agent: Agent) => {
    const clone: Agent = {
      ...agent,
      id: generateId('agent'),
      name: `${agent.name} (Copy)`,
      memories: [], // start fresh
    }
    addAgent(clone)
    if (workspacePath) saveAgentToDisk(workspacePath, clone)
    setEditingId(clone.id)
    setIsAdding(false)
  }

  const handleExport = (agent: Agent) => {
    const exportData = { ...agent }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agent-${agent.name.replace(/\s+/g, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as Agent
        if (!data.name || !data.systemPrompt) {
          toast.error(t('agents.invalidFile', 'Invalid agent file: missing required fields.'))
          return
        }
        const imported: Agent = {
          ...data,
          id: generateId('agent'), // always assign new ID
          memories: data.memories || [],
          skills: data.skills || [],
          allowedTools: data.allowedTools || [],
          enabled: true,
        }
        addAgent(imported)
        if (workspacePath) saveAgentToDisk(workspacePath, imported)
        setEditingId(imported.id)
        setIsAdding(false)
      } catch {
        toast.error(t('agents.parseError', 'Failed to parse agent file. Please check the JSON format.'))
      }
    }
    reader.readAsText(file)
    // Reset so the same file can be re-imported
    e.target.value = ''
  }

  const handleStartChat = (agent: Agent) => {
    setSelectedAgent(agent)
    const session: Session = {
      id: generateId('session'),
      title: 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      agentId: agent.id,
      modelId: agent.modelId || undefined,
      messages: [],
    }
    addSession(session)
    setActiveSession(session.id)
    setActiveModule('chat')
  }

  // ─── Agent Marketplace Catalog ─────────────────────────────
  const MARKETPLACE_AGENTS: Array<{
    name: string; avatar: string; description: string; category: string
    systemPrompt: string; skills: string[]; temperature: number; rating: number; downloads: number
  }> = [
    {
      name: 'Full-Stack Developer',
      avatar: 'agent-developer',
      description: 'Expert in frontend and backend development, databases, and deployment',
      category: 'Development',
      systemPrompt: 'You are a full-stack developer expert in React, Node.js, Python, databases, APIs, and deployment. Help users build complete applications from frontend to backend.',
      skills: ['builtin-filesystem', 'builtin-shell', 'builtin-git', 'builtin-code-analysis', 'builtin-web'],
      temperature: 0.5,
      rating: 4.8,
      downloads: 1520,
    },
    {
      name: 'API Designer',
      avatar: 'agent-api',
      description: 'Design RESTful and GraphQL APIs with best practices',
      category: 'Development',
      systemPrompt: 'You are an API design expert. Help users design, document, and implement RESTful and GraphQL APIs following industry best practices.',
      skills: ['builtin-filesystem', 'builtin-shell', 'builtin-code-analysis', 'builtin-web'],
      temperature: 0.4,
      rating: 4.6,
      downloads: 890,
    },
    {
      name: 'Content Strategist',
      avatar: 'agent-content',
      description: 'Create content plans, SEO strategies, and editorial calendars',
      category: 'Marketing',
      systemPrompt: 'You are a content strategist expert in SEO, content marketing, editorial planning, and audience engagement. Help users plan and create effective content strategies.',
      skills: ['builtin-web', 'builtin-filesystem', 'builtin-utilities', 'builtin-memory'],
      temperature: 0.7,
      rating: 4.5,
      downloads: 670,
    },
    {
      name: 'Database Architect',
      avatar: 'agent-database',
      description: 'Design efficient database schemas and optimize queries',
      category: 'Development',
      systemPrompt: 'You are a database architect specializing in schema design, query optimization, indexing strategies, and data modeling for SQL and NoSQL databases.',
      skills: ['builtin-filesystem', 'builtin-shell', 'builtin-code-analysis', 'builtin-memory'],
      temperature: 0.4,
      rating: 4.7,
      downloads: 1050,
    },
    {
      name: 'UI/UX Designer',
      avatar: 'agent-designer',
      description: 'Design user interfaces and improve user experience',
      category: 'Design',
      systemPrompt: 'You are a UI/UX design expert. Help users create beautiful, accessible, and user-friendly interfaces following modern design principles.',
      skills: ['builtin-web', 'builtin-filesystem', 'builtin-browser', 'builtin-utilities'],
      temperature: 0.7,
      rating: 4.4,
      downloads: 780,
    },
    {
      name: 'DevOps CI/CD Expert',
      avatar: 'agent-devops',
      description: 'Set up CI/CD pipelines, containers, and infrastructure as code',
      category: 'Infrastructure',
      systemPrompt: 'You are a DevOps expert specializing in CI/CD pipelines, Docker, Kubernetes, Terraform, and infrastructure automation.',
      skills: ['builtin-shell', 'builtin-filesystem', 'builtin-git', 'builtin-utilities', 'builtin-event-automation'],
      temperature: 0.4,
      rating: 4.6,
      downloads: 920,
    },
    {
      name: 'Technical Writer',
      avatar: 'agent-writer',
      description: 'Write documentation, READMEs, and technical guides',
      category: 'Writing',
      systemPrompt: 'You are a technical writing expert. Help users create clear, structured, and comprehensive documentation, API docs, README files, and technical guides.',
      skills: ['builtin-filesystem', 'builtin-web', 'builtin-utilities', 'builtin-memory'],
      temperature: 0.6,
      rating: 4.5,
      downloads: 630,
    },
    {
      name: 'Math Tutor',
      avatar: 'agent-math',
      description: 'Explain math concepts and solve problems step by step',
      category: 'Education',
      systemPrompt: 'You are an expert math tutor. Explain mathematical concepts clearly with step-by-step solutions. Cover algebra, calculus, statistics, linear algebra, and more.',
      skills: ['builtin-utilities', 'builtin-memory', 'builtin-web'],
      temperature: 0.5,
      rating: 4.7,
      downloads: 1200,
    },
  ]

  const filteredMarketAgents = MARKETPLACE_AGENTS.filter((a) =>
    !marketSearch || a.name.toLowerCase().includes(marketSearch.toLowerCase()) || a.category.toLowerCase().includes(marketSearch.toLowerCase())
  )

  const installMarketAgent = (tpl: typeof MARKETPLACE_AGENTS[number]) => {
    const agent: Agent = {
      id: generateId('agent'),
      name: tpl.name,
      avatar: tpl.avatar,
      systemPrompt: tpl.systemPrompt,
      modelId: '',
      skills: tpl.skills,
      temperature: tpl.temperature,
      maxTokens: 8192,
      enabled: true,
      greeting: `Hi! I'm ${tpl.name}. ${tpl.description}`,
      responseStyle: 'balanced',
      allowedTools: [],
      memories: [],
      autoLearn: true,
    }
    addAgent(agent)
    if (workspacePath) saveAgentToDisk(workspacePath, agent)
    setEditingId(agent.id)
    setSideTab('local')
  }

  return (
    <>
      <SidePanel
        title={t('agents.title', 'Agents')}
        width={panelWidth}
        action={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowHub(!showHub)}
              title={t('agents.agentHub', 'Agent Hub')}
              className={`text-[11px] px-2 py-1 rounded-lg transition-colors ${showHub ? 'bg-accent/15 text-accent' : 'text-text-muted hover:bg-surface-3/60'}`}
            >
              <IconifyIcon name="ui-link" size={14} color="currentColor" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title={t('agents.importAgent', 'Import agent from JSON')}
              className="text-[11px] px-2 py-1 rounded-lg text-text-muted hover:bg-surface-3/60 transition-colors"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => { setIsAdding(true); setEditingId(null) }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium"
            >
              + New
            </button>
          </div>
        }
      >
        <input type="file" ref={fileInputRef} accept=".json" onChange={handleImport} className="hidden" aria-label="Import agent JSON" />

        {/* Side panel tabs */}
        <div className="flex items-center gap-1 px-2 pb-2">
          <button
            type="button"
            onClick={() => setSideTab('local')}
            className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-all ${
              sideTab === 'local' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary hover:bg-surface-3/60'
            }`}
          >
            {t('agents.local', 'Local')} ({agents.length})
          </button>
          <button
            type="button"
            onClick={() => setSideTab('marketplace')}
            className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-all inline-flex items-center justify-center gap-1.5 ${
              sideTab === 'marketplace' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary hover:bg-surface-3/60'
            }`}
          >
            <IconifyIcon name="ui-cart" size={14} color="currentColor" /> {t('agents.market', 'Market')}
          </button>
        </div>

        {sideTab === 'local' && (
          <AgentList
          agents={agents}
          editingId={editingId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelect={(agent) => { setEditingId(agent.id); setIsAdding(false) }}
          onStartChat={handleStartChat}
          onDuplicate={handleDuplicate}
          onExport={handleExport}
          onDelete={handleDelete}
          onContextMenu={(e, agent) => setCtxMenu({ x: e.clientX, y: e.clientY, agent })}
        />
        )}

        {sideTab === 'marketplace' && (
          <div className="px-2 space-y-2">
            <input
              type="text"
              value={marketSearch}
              onChange={(e) => setMarketSearch(e.target.value)}
              placeholder={t('agents.search', 'Search agents...')}
              className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary text-xs placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            {filteredMarketAgents.map((tpl, idx) => {
              const alreadyInstalled = agents.some((a) => a.name === tpl.name)
              return (
                <div key={idx} className="p-3 rounded-xl bg-surface-1/80 border border-border-subtle hover:border-border transition-all">
                  <div className="flex items-start gap-2">
                    <AgentAvatar avatar={tpl.avatar} size={20} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-text-primary">{tpl.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-muted">{tpl.category}</span>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{tpl.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 text-[10px] text-text-muted">
                          <span>⭐ {tpl.rating}</span>
                          <span>↓ {tpl.downloads}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => installMarketAgent(tpl)}
                          disabled={alreadyInstalled}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                            alreadyInstalled
                              ? 'bg-surface-3 text-text-muted cursor-not-allowed'
                              : 'bg-accent/15 text-accent hover:bg-accent/25'
                          }`}
                        >
                          {alreadyInstalled ? 'Installed' : 'Install'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Right-click context menu */}
        {ctxMenu && (
          <div
            ref={ctxRef}
            className="fixed bg-surface-2 border border-border-subtle rounded-xl shadow-xl py-1 min-w-40 animate-fade-in z-9999"
            {...{ style: { top: ctxMenu.y, left: ctxMenu.x } }}
          >
            <button type="button" className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors flex items-center gap-1.5" onClick={() => { handleStartChat(ctxMenu.agent); setCtxMenu(null) }}>
              <IconifyIcon name="ui-chat" size={14} color="currentColor" /> {t('agents.startChat', 'Start Chat')}
            </button>
            <button type="button" className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors flex items-center gap-1.5" onClick={() => { setEditingId(ctxMenu.agent.id); setIsAdding(false); setCtxMenu(null) }}>
              <IconifyIcon name="ui-edit" size={14} color="currentColor" /> {t('common.edit', 'Edit')}
            </button>
            <button type="button" className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors flex items-center gap-1.5" onClick={() => { handleDuplicate(ctxMenu.agent); setCtxMenu(null) }}>
              ⧉ {t('common.duplicate', 'Duplicate')}
            </button>
            <button type="button" className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors flex items-center gap-1.5" onClick={() => { handleExport(ctxMenu.agent); setCtxMenu(null) }}>
              ↓ {t('agents.exportJson', 'Export JSON')}
            </button>
            {ctxMenu.agent.id !== DEFAULT_AGENT_ID && (
              <>
                <div className="my-1 border-t border-border-subtle" />
                <button type="button" className="w-full text-left px-3 py-1.5 text-[13px] text-danger hover:bg-danger/10 transition-colors flex items-center gap-1.5" onClick={() => { handleDelete(ctxMenu.agent.id); setCtxMenu(null) }}>
                  <IconifyIcon name="ui-close" size={14} color="currentColor" /> {t('common.delete', 'Delete')}
                </button>
              </>
            )}
          </div>
        )}
      </SidePanel>
      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={200} maxWidth={480} />

      {showHub ? (
        <AgentOrchestrationPanel
          agents={agents}
          title={t('agents.agentHub', 'Agent Hub')}
          allowedTabs={['communications', 'versions', 'performance']}
          initialTab="communications"
          onClose={() => setShowHub(false)}
        />
      ) : isAdding || editingId ? (
        <>
          <AgentEditor
            key={editingId ?? 'new'} // reset form state when switching agents
            agent={isAdding ? null : editingAgent}
            onSave={handleSave}
            onCancel={() => { setIsAdding(false); setEditingId(null); setTestAgent(null) }}
            onTest={(agentData) => setTestAgent(agentData)}
          />
          {testAgent && (
            <div className="w-95 shrink-0">
              <AgentTestChat
                key={testAgent.id}
                agent={testAgent}
                onClose={() => setTestAgent(null)}
              />
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-text-muted">
          <div className="text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-5 border border-border-subtle">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z"/></svg>
            </div>
            <p className="text-sm text-text-secondary font-medium">{t('agents.selectToEdit', 'Select an agent to edit')}</p>
            <p className="text-xs text-text-muted mt-1">{t('agents.orCreateNew', 'or create a new one')}</p>
          </div>
        </div>
      )}
    </>
  )
}
