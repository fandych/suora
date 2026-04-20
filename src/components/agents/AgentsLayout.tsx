import { useState, useRef, useEffect, useMemo } from 'react'
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
import { settingsInputClass } from '@/components/settings/panelUi'

const DEFAULT_AGENT_ID = 'default-assistant'

type MarketplaceAgentSeed = {
  id: string
  avatar: string
  skills: string[]
  temperature: number
  rating: number
  downloads: number
  fallbackName: string
  fallbackDescription: string
  fallbackCategory: string
  fallbackSystemPrompt: string
}

type MarketplaceAgentTemplate = MarketplaceAgentSeed & {
  name: string
  description: string
  category: string
  systemPrompt: string
}

const MARKETPLACE_AGENT_SEEDS: MarketplaceAgentSeed[] = [
  {
    id: 'fullStackDeveloper',
    avatar: 'agent-developer',
    skills: ['builtin-filesystem', 'builtin-shell', 'builtin-git', 'builtin-code-analysis', 'builtin-web'],
    temperature: 0.5,
    rating: 4.8,
    downloads: 1520,
    fallbackName: 'Full-Stack Developer',
    fallbackDescription: 'Expert in frontend and backend development, databases, and deployment',
    fallbackCategory: 'Development',
    fallbackSystemPrompt: 'You are a full-stack developer expert in React, Node.js, Python, databases, APIs, and deployment. Help users build complete applications from frontend to backend.',
  },
  {
    id: 'apiDesigner',
    avatar: 'agent-api',
    skills: ['builtin-filesystem', 'builtin-shell', 'builtin-code-analysis', 'builtin-web'],
    temperature: 0.4,
    rating: 4.6,
    downloads: 890,
    fallbackName: 'API Designer',
    fallbackDescription: 'Design RESTful and GraphQL APIs with best practices',
    fallbackCategory: 'Development',
    fallbackSystemPrompt: 'You are an API design expert. Help users design, document, and implement RESTful and GraphQL APIs following industry best practices.',
  },
  {
    id: 'contentStrategist',
    avatar: 'agent-content',
    skills: ['builtin-web', 'builtin-filesystem', 'builtin-utilities', 'builtin-memory'],
    temperature: 0.7,
    rating: 4.5,
    downloads: 670,
    fallbackName: 'Content Strategist',
    fallbackDescription: 'Create content plans, SEO strategies, and editorial calendars',
    fallbackCategory: 'Marketing',
    fallbackSystemPrompt: 'You are a content strategist expert in SEO, content marketing, editorial planning, and audience engagement. Help users plan and create effective content strategies.',
  },
  {
    id: 'databaseArchitect',
    avatar: 'agent-database',
    skills: ['builtin-filesystem', 'builtin-shell', 'builtin-code-analysis', 'builtin-memory'],
    temperature: 0.4,
    rating: 4.7,
    downloads: 1050,
    fallbackName: 'Database Architect',
    fallbackDescription: 'Design efficient database schemas and optimize queries',
    fallbackCategory: 'Development',
    fallbackSystemPrompt: 'You are a database architect specializing in schema design, query optimization, indexing strategies, and data modeling for SQL and NoSQL databases.',
  },
  {
    id: 'uiUxDesigner',
    avatar: 'agent-designer',
    skills: ['builtin-web', 'builtin-filesystem', 'builtin-browser', 'builtin-utilities'],
    temperature: 0.7,
    rating: 4.4,
    downloads: 780,
    fallbackName: 'UI/UX Designer',
    fallbackDescription: 'Design user interfaces and improve user experience',
    fallbackCategory: 'Design',
    fallbackSystemPrompt: 'You are a UI/UX design expert. Help users create beautiful, accessible, and user-friendly interfaces following modern design principles.',
  },
  {
    id: 'devopsExpert',
    avatar: 'agent-devops',
    skills: ['builtin-shell', 'builtin-filesystem', 'builtin-git', 'builtin-utilities', 'builtin-event-automation'],
    temperature: 0.4,
    rating: 4.6,
    downloads: 920,
    fallbackName: 'DevOps CI/CD Expert',
    fallbackDescription: 'Set up CI/CD pipelines, containers, and infrastructure as code',
    fallbackCategory: 'Infrastructure',
    fallbackSystemPrompt: 'You are a DevOps expert specializing in CI/CD pipelines, Docker, Kubernetes, Terraform, and infrastructure automation.',
  },
  {
    id: 'technicalWriter',
    avatar: 'agent-writer',
    skills: ['builtin-filesystem', 'builtin-web', 'builtin-utilities', 'builtin-memory'],
    temperature: 0.6,
    rating: 4.5,
    downloads: 630,
    fallbackName: 'Technical Writer',
    fallbackDescription: 'Write documentation, READMEs, and technical guides',
    fallbackCategory: 'Writing',
    fallbackSystemPrompt: 'You are a technical writing expert. Help users create clear, structured, and comprehensive documentation, API docs, README files, and technical guides.',
  },
  {
    id: 'mathTutor',
    avatar: 'agent-math',
    skills: ['builtin-utilities', 'builtin-memory', 'builtin-web'],
    temperature: 0.5,
    rating: 4.7,
    downloads: 1200,
    fallbackName: 'Math Tutor',
    fallbackDescription: 'Explain math concepts and solve problems step by step',
    fallbackCategory: 'Education',
    fallbackSystemPrompt: 'You are an expert math tutor. Explain mathematical concepts clearly with step-by-step solutions. Cover algebra, calculus, statistics, linear algebra, and more.',
  },
]

function getAgentDisplayName(agent: Agent, t: (key: string, fallback?: string) => string) {
  return agent.id === DEFAULT_AGENT_ID
    ? t('chat.assistant', agent.name || 'Assistant')
    : agent.name
}

function getAgentPreviewText(agent: Agent, t: (key: string, fallback?: string) => string) {
  if (agent.id === DEFAULT_AGENT_ID) {
    return t('agents.defaultAssistantSummary', 'General-purpose tasks, Q&A, and everyday help.')
  }

  return `${agent.systemPrompt.slice(0, 40)}…`
}

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
        getAgentDisplayName(a, t).toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.systemPrompt.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : agents

  return (
    <div className="px-3 pb-3 space-y-2.5">
      {/* Search */}
      {agents.length > 3 && (
        <div className="rounded-[22px] border border-border-subtle/55 bg-surface-0/45 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <div className="relative">
            <IconifyIcon
              name="ui-search"
              size={14}
              color="currentColor"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/55 pointer-events-none"
            />
            <input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('agents.search', 'Search agents...')}
              className="w-full rounded-2xl border border-border-subtle/55 bg-surface-2/80 py-2.5 pl-10 pr-3 text-[12px] text-text-secondary placeholder-text-muted/55 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted/70">
            <span>{filteredAgents.length} {t('common.results', 'results')}</span>
            {searchQuery && <span>{agents.length} {t('common.total', 'total')}</span>}
          </div>
        </div>
      )}

      {filteredAgents.length === 0 && (
        <div className="rounded-[22px] border border-dashed border-border-subtle/60 bg-surface-0/30 px-4 py-10 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
            <IconifyIcon name="ui-search" size={18} color="currentColor" />
          </div>
          <p className="text-[12px] text-text-muted px-2">
            {searchQuery ? t('agents.noMatching', 'No matching agents.') : t('agents.noAgents', 'No agents. Click + New to create one.')}
          </p>
        </div>
      )}
      {filteredAgents.map((agent) => {
        const isActive = editingId === agent.id
        const isDefault = agent.id === DEFAULT_AGENT_ID
        const isBuiltin = agent.id.startsWith('builtin-') || agent.id === 'default-assistant'
        const sourceBadge = isBuiltin ? 'builtin' : null
        const displayName = getAgentDisplayName(agent, t)
        const previewText = getAgentPreviewText(agent, t)
        return (
          <div
            key={agent.id}
            tabIndex={0}
            onClick={() => onSelect(agent)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(agent)
              }
            }}
            onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, agent) }}
            className={`group rounded-[22px] border px-3.5 py-3.5 cursor-pointer transition-all duration-200 ${
              isActive
                ? 'border-accent/20 bg-accent/10 text-text-primary shadow-[0_14px_34px_rgba(var(--t-accent-rgb),0.07)]'
                : isDefault
                ? 'border-border-subtle/55 bg-linear-to-br from-surface-1/80 to-surface-2/55 text-text-secondary hover:border-accent/16 hover:text-text-primary'
                : 'border-transparent bg-surface-1/20 text-text-secondary hover:bg-surface-3/55 hover:border-border-subtle/60 hover:text-text-primary'
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <div className="relative mt-0.5 shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-0/75 shadow-sm">
                    <AgentAvatar avatar={agent.avatar} size={22} />
                  </div>
                  {agent.color && (
                    <svg viewBox="0 0 10 10" className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-surface-0 p-px" aria-hidden="true">
                      <circle cx="5" cy="5" r="4" fill={agent.color} />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13px] font-semibold truncate text-text-primary">{displayName}</span>
                    {!agent.enabled && (
                      <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-text-muted shrink-0">{t('common.off', 'off')}</span>
                    )}
                    {sourceBadge && (
                      <span className="rounded-full border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[9px] text-accent shrink-0">{t('agents.builtin', 'builtin')}</span>
                    )}
                    {isDefault && (
                      <span className="rounded-full border border-border-subtle/50 bg-surface-0/80 px-1.5 py-0.5 text-[9px] text-text-muted shrink-0">{t('agents.default', 'default')}</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-text-secondary/80 line-clamp-2">{previewText}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-surface-3/85 px-2 py-0.5 text-[10px] text-text-muted">{agent.skills.length} {t('agents.skills', 'skills')}</span>
                    {!!agent.memories?.length && <span className="rounded-full bg-surface-3/85 px-2 py-0.5 text-[10px] text-text-muted">{agent.memories.length} {t('agents.memoriesCount', 'memories')}</span>}
                    {agent.autoLearn && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] text-success">{t('agents.autoLearn', 'Auto-learn')}</span>}
                  </div>
                </div>
              </div>
              <div className={`flex items-center gap-1 shrink-0 transition-opacity ${
                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
              }`}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onStartChat(agent) }}
                  aria-label={t('agents.startChat', 'Start chat with this agent')}
                  title={t('agents.startChat', 'Start chat with this agent')}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-0/65 text-text-muted transition-colors hover:text-accent hover:bg-accent/8"
                  tabIndex={isActive ? 0 : -1}
                >
                  <IconifyIcon name="ui-chat" size={14} color="currentColor" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDuplicate(agent) }}
                  aria-label={t('agents.duplicateAgent', 'Duplicate agent')}
                  title={t('agents.duplicateAgent', 'Duplicate agent')}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-0/65 text-text-muted transition-colors hover:text-accent hover:bg-accent/8"
                  tabIndex={isActive ? 0 : -1}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onExport(agent) }}
                  aria-label={t('agents.exportJson', 'Export agent as JSON')}
                  title={t('agents.exportJson', 'Export agent as JSON')}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-0/65 text-text-muted transition-colors hover:text-accent hover:bg-accent/8"
                  tabIndex={isActive ? 0 : -1}
                >
                  ↓
                </button>
                {!isDefault && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(agent.id) }}
                    aria-label={t('agents.deleteAgent', 'Delete agent')}
                    title={t('agents.deleteAgent', 'Delete agent')}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-0/65 text-text-muted transition-colors hover:text-danger hover:bg-danger/8"
                    tabIndex={isActive ? 0 : -1}
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
  const [panelWidth, setPanelWidth] = useResizablePanel('agents', 320)
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
  const marketplaceAgents = useMemo<MarketplaceAgentTemplate[]>(() => (
    MARKETPLACE_AGENT_SEEDS.map((seed) => ({
      ...seed,
      name: t(`agents.marketplace.${seed.id}.name`, seed.fallbackName),
      description: t(`agents.marketplace.${seed.id}.description`, seed.fallbackDescription),
      category: t(`agents.marketplace.${seed.id}.category`, seed.fallbackCategory),
      systemPrompt: t(`agents.marketplace.${seed.id}.systemPrompt`, seed.fallbackSystemPrompt),
    }))
  ), [t])

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
      name: `${agent.name} (${t('common.copy', 'Copy')})`,
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
      title: t('chat.newChat', 'New Chat'),
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

  const filteredMarketAgents = marketplaceAgents.filter((a) =>
    !marketSearch || a.name.toLowerCase().includes(marketSearch.toLowerCase()) || a.category.toLowerCase().includes(marketSearch.toLowerCase())
  )
  const enabledAgentCount = agents.filter((agent) => agent.enabled).length
  const autoLearnAgentCount = agents.filter((agent) => agent.autoLearn).length
  const customAgentCount = agents.filter((agent) => agent.id !== DEFAULT_AGENT_ID && !agent.id.startsWith('builtin-')).length
  const installedMarketplaceCount = marketplaceAgents.filter((tpl) =>
    agents.some((agent) => agent.avatar === tpl.avatar && tpl.skills.every((skillId) => agent.skills.includes(skillId))),
  ).length

  const installMarketAgent = (tpl: MarketplaceAgentTemplate) => {
    const greetingTemplate = t('agents.marketplace.greeting', "Hi! I'm {name}. {description}")
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
      greeting: greetingTemplate.replace('{name}', tpl.name).replace('{description}', tpl.description),
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
              + {t('common.new', 'New')}
            </button>
          </div>
        }
      >
        <input type="file" ref={fileInputRef} accept=".json" onChange={handleImport} className="hidden" aria-label={t('agents.importAgent', 'Import agent from JSON')} />

        {/* Side panel tabs */}
        <div className="grid grid-cols-2 gap-1.5 px-3 pb-3 pt-1">
          <button
            type="button"
            onClick={() => setSideTab('local')}
            className={`text-xs py-2 rounded-xl font-semibold transition-all ${
              sideTab === 'local'
                ? 'bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.14)]'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-3/60'
            }`}
          >
            {t('agents.local', 'Local')} ({agents.length})
          </button>
          <button
            type="button"
            onClick={() => setSideTab('marketplace')}
            className={`text-xs py-2 rounded-xl font-semibold transition-all inline-flex items-center justify-center gap-1.5 ${
              sideTab === 'marketplace'
                ? 'bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.14)]'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-3/60'
            }`}
          >
            <IconifyIcon name="ui-cart" size={14} color="currentColor" /> {t('agents.market', 'Market')}
          </button>
        </div>

        <div className="px-3 pb-3">
          {sideTab === 'local' ? (
            <div className="rounded-3xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/92 to-surface-2/70 p-4 shadow-[0_14px_40px_rgba(var(--t-accent-rgb),0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/55">
                    {t('agents.studio', 'Studio')}
                  </div>
                  <div className="mt-1 text-[18px] font-semibold text-text-primary">
                    {t('agents.roster', 'Agent Roster')}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-text-secondary/80">
                    {t('agents.rosterHint', 'Curate specialists, test their prompts, and keep the active lineup easy to scan.')}
                  </p>
                </div>
                <div className="rounded-2xl border border-accent/15 bg-surface-0/70 px-3 py-2 text-right shadow-sm">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('common.total', 'Total')}</div>
                  <div className="text-xl font-semibold text-text-primary tabular-nums">{agents.length}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('common.enabled', 'Enabled')}</div>
                  <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{enabledAgentCount}</div>
                </div>
                <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('agents.autoLearn', 'Auto-learn')}</div>
                  <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{autoLearnAgentCount}</div>
                </div>
                <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('agents.custom', 'Custom')}</div>
                  <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{customAgentCount}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-border-subtle/55 bg-linear-to-br from-surface-2/95 via-surface-1/85 to-surface-1/65 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.12)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/55">
                    {t('agents.curated', 'Curated')}
                  </div>
                  <div className="mt-1 text-[18px] font-semibold text-text-primary">
                    {t('agents.marketCollection', 'Starter Collection')}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-text-secondary/80">
                    {t('agents.marketCollectionHint', 'Install ready-made specialists and use them as a starting point for your own workflows.')}
                  </p>
                </div>
                <div className="rounded-2xl border border-border-subtle/50 bg-surface-0/70 px-3 py-2 text-right shadow-sm">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('common.installed', 'Installed')}</div>
                  <div className="text-xl font-semibold text-text-primary tabular-nums">{installedMarketplaceCount}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('agents.catalog', 'Catalog')}</div>
                  <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{marketplaceAgents.length}</div>
                </div>
                <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('common.search', 'Search')}</div>
                  <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{filteredMarketAgents.length}</div>
                </div>
              </div>
            </div>
          )}
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
          <div className="px-3 pb-3 space-y-3">
            <div className="relative">
              <IconifyIcon
                name="ui-search"
                size={14}
                color="currentColor"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/55 pointer-events-none"
              />
              <input
                type="text"
                value={marketSearch}
                onChange={(e) => setMarketSearch(e.target.value)}
                placeholder={t('agents.search', 'Search agents...')}
                className={`${settingsInputClass} py-2.5 pl-10 pr-3 text-[12px]`}
              />
            </div>
            {filteredMarketAgents.map((tpl, idx) => {
              const alreadyInstalled = agents.some((a) => a.avatar === tpl.avatar && tpl.skills.every((skillId) => a.skills.includes(skillId)))
              return (
                <div key={idx} className="rounded-[22px] border border-border-subtle/60 bg-linear-to-br from-surface-1/92 to-surface-2/58 p-3.5 transition-all duration-200 hover:border-accent/18 hover:shadow-[0_10px_24px_rgba(var(--t-accent-rgb),0.05)]">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-0/70 shadow-sm">
                      <AgentAvatar avatar={tpl.avatar} size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-text-primary">{tpl.name}</span>
                        <span className="rounded-full bg-surface-3/85 px-2 py-0.5 text-[10px] text-text-muted">{tpl.category}</span>
                      </div>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary/82 line-clamp-2">{tpl.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-text-muted">
                        <span className="rounded-full bg-surface-3/75 px-2 py-0.5">⭐ {tpl.rating}</span>
                        <span className="rounded-full bg-surface-3/75 px-2 py-0.5">↓ {tpl.downloads}</span>
                        <span className="rounded-full bg-surface-3/75 px-2 py-0.5">{tpl.skills.length} {t('agents.skills', 'skills')}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="text-[10px] text-text-muted/65 line-clamp-1">
                          {tpl.systemPrompt}
                        </div>
                        <button
                          type="button"
                          onClick={() => installMarketAgent(tpl)}
                          disabled={alreadyInstalled}
                          className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-colors shrink-0 ${
                            alreadyInstalled
                              ? 'bg-surface-3 text-text-muted cursor-not-allowed'
                              : 'bg-accent/15 text-accent hover:bg-accent/25'
                          }`}
                        >
                          {alreadyInstalled ? t('common.installed', 'Installed') : t('common.install', 'Install')}
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
              ↓ {t('common.export', 'Export')}
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
      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={240} maxWidth={520} />

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
        <div className="flex-1 overflow-y-auto px-6 py-8 text-text-muted xl:px-10">
          <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center">
            <div className="w-full rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/94 via-surface-1/88 to-surface-2/72 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.16)] animate-fade-in xl:p-10">
              <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-2xl">
                  <div className="flex h-18 w-18 items-center justify-center rounded-[26px] border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z"/></svg>
                  </div>
                  <p className="mt-5 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">
                    {t('agents.studioWorkspace', 'Agent Workspace')}
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
                    {t('agents.selectToEdit', 'Select an agent to edit')}
                  </h2>
                  <p className="mt-3 max-w-xl text-[14px] leading-7 text-text-secondary/82">
                    {t('agents.emptyStateDetail', 'Build specialists with distinct prompts, curated skills, and guardrails. Pick an existing agent to refine it, or create a new one as a reusable starting point.')}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => { setIsAdding(true); setEditingId(null) }}
                      className="rounded-2xl bg-accent px-5 py-3 text-[13px] font-semibold text-white shadow-[0_10px_30px_rgba(var(--t-accent-rgb),0.22)] transition-all hover:bg-accent-hover"
                    >
                      + {t('common.new', 'New')} {t('agents.title', 'Agents')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowHub(true)}
                      className="rounded-2xl border border-border-subtle/60 bg-surface-0/60 px-5 py-3 text-[13px] font-semibold text-text-secondary transition-all hover:border-accent/20 hover:text-text-primary"
                    >
                      {t('agents.agentHub', 'Agent Hub')}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:w-[24rem] xl:grid-cols-1">
                  <div className="rounded-[22px] border border-border-subtle/55 bg-surface-0/60 p-4">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('common.total', 'Total')}</div>
                    <div className="mt-2 text-2xl font-semibold text-text-primary tabular-nums">{agents.length}</div>
                    <div className="mt-1 text-[12px] text-text-muted">{t('agents.availableSpecialists', 'available specialists')}</div>
                  </div>
                  <div className="rounded-[22px] border border-border-subtle/55 bg-surface-0/60 p-4">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('common.enabled', 'Enabled')}</div>
                    <div className="mt-2 text-2xl font-semibold text-text-primary tabular-nums">{enabledAgentCount}</div>
                    <div className="mt-1 text-[12px] text-text-muted">{t('agents.readyForUse', 'ready for use')}</div>
                  </div>
                  <div className="rounded-[22px] border border-border-subtle/55 bg-surface-0/60 p-4">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('agents.market', 'Market')}</div>
                    <div className="mt-2 text-2xl font-semibold text-text-primary tabular-nums">{marketplaceAgents.length}</div>
                    <div className="mt-1 text-[12px] text-text-muted">{t('agents.starterTemplates', 'starter templates')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
