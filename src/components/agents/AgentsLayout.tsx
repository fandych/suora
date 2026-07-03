import { Suspense, lazy, useState, useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '@/store/appStore';
import { useI18n } from '@/hooks/useI18n';
import { SidePanel } from '@/components/layout/SidePanel';
import { generateId } from '@/utils/helpers';
import { AgentAvatar, IconifyIcon } from '@/components/icons/IconifyIcons';
import type { Agent, Session } from '@/types';
import { ResizeHandle } from '@/components/layout/ResizeHandle';
import { useResizablePanel } from '@/hooks/useResizablePanel';
import { confirm } from '@/services/confirmDialog';
import { toast } from '@/services/toast';
import { WorkbenchEmptyState } from '@/components/catalyst-ui/workbench-empty-state';
import { Button as UiButton } from '@/components/catalyst-ui/button';
import { Dropdown, DropdownButton, DropdownMenu, DropdownItem, DropdownDivider } from '@/components/catalyst-ui/dropdown';
import { workbenchSegmentButtonClass, workbenchSidebarAccentActionClass, workbenchSidebarCardClass, workbenchSidebarDescriptionClass, workbenchSidebarIconClass, workbenchSidebarItemClass, workbenchSidebarMetaClass, workbenchSidebarPillClass, workbenchSidebarPrimaryActionClass, workbenchSidebarSearchInputClass, workbenchSidebarSubtleActionClass, workbenchSidebarTitleClass } from '@/components/catalyst-ui/workbench';
import { safeParse, safeStringify } from '@/utils/safeJson';
import { Input as UiInput } from "@/components/catalyst-ui/form-controls";
const LazyAgentTestChat = lazy(() => import('./AgentTestChat').then((module) => ({ default: module.AgentTestChat })));
const LazyAgentEditor = lazy(() => import('./AgentEditor').then((module) => ({ default: module.AgentEditor })));
const LazyAgentAssistantDrawer = lazy(() => import('./AgentAssistantDrawer').then((module) => ({ default: module.AgentAssistantDrawer })));
const LazyAgentOrchestrationPanel = lazy(() => import('./AgentOrchestrationPanel').then((module) => ({ default: module.AgentOrchestrationPanel })));
const DEFAULT_AGENT_ID = 'default-assistant';
type MarketplaceAgentSeed = {
    id: string;
    avatar: string;
    skills: string[];
    temperature: number;
    rating: number;
    downloads: number;
    fallbackName: string;
    fallbackDescription: string;
    fallbackCategory: string;
    fallbackSystemPrompt: string;
};
type MarketplaceAgentTemplate = MarketplaceAgentSeed & {
    name: string;
    description: string;
    category: string;
    systemPrompt: string;
};
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
];
function getAgentDisplayName(agent: Agent, t: (key: string, fallback?: string) => string) {
    return agent.id === DEFAULT_AGENT_ID
        ? t('chat.assistant', agent.name || 'Assistant')
        : agent.name;
}
function getAgentPreviewText(agent: Agent, t: (key: string, fallback?: string) => string) {
    if (agent.id === DEFAULT_AGENT_ID) {
        return t('agents.defaultAssistantSummary', 'General-purpose tasks, Q&A, and everyday help.');
    }
    return `${agent.systemPrompt.slice(0, 40)}…`;
}
// ─── Agent List (sidebar sub-component) ────────────────────────────
type AgentAction = { key: string; label: string; icon: string; tone?: 'danger'; separator?: boolean; onClick: () => void };
function AgentList({ agents, editingId, searchQuery, onSearchChange, onSelect, getAgentActions, }: {
    agents: Agent[];
    editingId: string | null;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    onSelect: (agent: Agent) => void;
    getAgentActions: (agent: Agent) => AgentAction[];
}) {
    const { t } = useI18n();
    const filteredAgents = searchQuery.trim()
        ? agents.filter((a) => getAgentDisplayName(a, t).toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.systemPrompt.toLowerCase().includes(searchQuery.toLowerCase()))
        : agents;
    return (<div className="module-sidebar-stack px-3 pb-3 space-y-2.5">
      {/* Search */}
      {agents.length > 3 && (<div className={workbenchSidebarCardClass}>
          <div className="relative">
            <IconifyIcon name="ui-search" size={14} color="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/55 pointer-events-none"/>
            <UiInput value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder={t('agents.search', 'Search agents...')} wrapperClassName="w-full" controlClassName={workbenchSidebarSearchInputClass}/>
          </div>
          <div className={workbenchSidebarMetaClass}>
            <span>{filteredAgents.length} {t('common.results', 'results')}</span>
            {searchQuery && <span>{agents.length} {t('common.total', 'total')}</span>}
          </div>
        </div>)}

      {filteredAgents.length === 0 && (<div className="rounded-[22px] border border-dashed border-border-subtle/60 bg-surface-0/30 px-4 py-10 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
            <IconifyIcon name="ui-search" size={18} color="currentColor"/>
          </div>
          <p className="text-[12px] text-text-muted px-2">
            {searchQuery ? t('agents.noMatching', 'No matching agents.') : t('agents.noAgents', 'No agents. Click + New to create one.')}
          </p>
        </div>)}
      {filteredAgents.map((agent) => {
            const isActive = editingId === agent.id;
            const isDefault = agent.id === DEFAULT_AGENT_ID;
            const isBuiltin = agent.id.startsWith('builtin-') || agent.id === 'default-assistant';
            const sourceBadge = isBuiltin ? 'builtin' : null;
            const displayName = getAgentDisplayName(agent, t);
            const previewText = getAgentPreviewText(agent, t);
            return (<div key={agent.id} tabIndex={0} onClick={() => onSelect(agent)} onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(agent);
                    }
                }} className={`${workbenchSidebarItemClass(isActive, isDefault
                    ? 'border-border-subtle/55 bg-linear-to-br from-surface-1/80 to-surface-2/55 text-text-secondary hover:border-accent/16 hover:text-text-primary'
                    : 'border-transparent bg-surface-1/20 text-text-secondary hover:bg-surface-3/55 hover:border-border-subtle/60 hover:text-text-primary')} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30`}>
            <div className="flex min-w-0 gap-3">
                <div className="relative mt-0.5 shrink-0">
                  <div className={workbenchSidebarIconClass}>
                    <AgentAvatar avatar={agent.avatar} size={22}/>
                  </div>
                  {agent.color && (<svg viewBox="0 0 10 10" className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-surface-0 p-px" aria-hidden="true">
                      <circle cx="5" cy="5" r="4" fill={agent.color}/>
                    </svg>)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className={workbenchSidebarTitleClass}>{displayName}</span>
                      {!agent.enabled && (<span className="shrink-0 rounded-full bg-surface-3 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-text-muted">{t('common.off', 'off')}</span>)}
                      {sourceBadge && (<span className="shrink-0 rounded-full border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[9px] text-accent">{t('agents.builtin', 'builtin')}</span>)}
                      {isDefault && (<span className="shrink-0 rounded-full border border-border-subtle/50 bg-surface-0/80 px-1.5 py-0.5 text-[9px] text-text-muted">{t('agents.default', 'default')}</span>)}
                    </div>
                    <div className={`flex items-center gap-1 shrink-0 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
                      <Dropdown>
                        <DropdownButton as="button" type="button" onClick={(e: React.MouseEvent) => e.stopPropagation()} aria-label={t('common.actions', 'Actions')} title={t('common.actions', 'Actions')} className="flex h-8 items-center gap-1 rounded-xl bg-surface-0/65 px-2.5 text-[11px] font-medium text-text-muted transition-colors hover:bg-accent/8 hover:text-accent" tabIndex={isActive ? 0 : -1}>
                          <span>{t('common.actions', 'Actions')}</span>
                          <IconifyIcon name="ui-chevron-down" size={12} color="currentColor"/>
                        </DropdownButton>
                        <DropdownMenu anchor="bottom end" className="min-w-44 overflow-hidden rounded-2xl border border-border/60 bg-surface-2/95 py-1.5 shadow-2xl backdrop-blur-xl">
                          {getAgentActions(agent).map((action) => (<>
                            {action.separator && <DropdownDivider key={`sep-${action.key}`} className="mx-2 my-1"/>}
                            <DropdownItem key={action.key} onClick={action.onClick} className={`flex items-center gap-2.5 px-4 py-2.5 text-[13px] ${action.tone === 'danger' ? 'text-danger' : 'text-text-secondary'}`}>
                              <div className="col-span-full flex items-center gap-2.5 w-full">
                                <IconifyIcon name={action.icon} size={14} color="currentColor"/>
                                {action.label}
                              </div>
                            </DropdownItem>
                          </>))}
                        </DropdownMenu>
                      </Dropdown>
                    </div>
                  </div>
                  <p className={workbenchSidebarDescriptionClass}>{previewText}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className={workbenchSidebarPillClass}>{agent.skills.length} {t('agents.skills', 'skills')}</span>
                    {!!agent.memories?.length && <span className={workbenchSidebarPillClass}>{agent.memories.length} {t('agents.memoriesCount', 'memories')}</span>}
                    {agent.autoLearn && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] text-success">{t('agents.autoLearn', 'Auto-learn')}</span>}
                  </div>
                </div>
            </div>
          </div>);
        })}
    </div>);
}
// ─── Agents Layout (main) ──────────────────────────────────────────
export function AgentsLayout() {
    const { t } = useI18n();
    const [panelWidth, setPanelWidth] = useResizablePanel('agents', 340);
    const { agents, addAgent, updateAgent, removeAgent, setSelectedAgent, addSession, setActiveSession, setActiveModule, addAgentVersion } = useAppStore();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [assistantState, setAssistantState] = useState<{
        mode: 'create' | 'edit';
        agentId: string | null;
    } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [testAgent, setTestAgent] = useState<Agent | null>(null);
    const [editorRevision, setEditorRevision] = useState(0);
    const [showHub, setShowHub] = useState(false);
    const [sideTab, setSideTab] = useState<'local' | 'marketplace'>('local');
    const [marketSearch, setMarketSearch] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const marketplaceAgents = useMemo<MarketplaceAgentTemplate[]>(() => (MARKETPLACE_AGENT_SEEDS.map((seed) => ({
        ...seed,
        name: t(`agents.marketplace.${seed.id}.name`, seed.fallbackName),
        description: t(`agents.marketplace.${seed.id}.description`, seed.fallbackDescription),
        category: t(`agents.marketplace.${seed.id}.category`, seed.fallbackCategory),
        systemPrompt: t(`agents.marketplace.${seed.id}.systemPrompt`, seed.fallbackSystemPrompt),
    }))), [t]);
    useEffect(() => {
        if (!assistantState || assistantState.mode !== 'edit')
            return;
        if (!assistantState.agentId || agents.some((agent) => agent.id === assistantState.agentId))
            return;
        if (editingId === assistantState.agentId) {
            setEditingId(null);
            setTestAgent(null);
            setEditorRevision((value) => value + 1);
        }
        setAssistantState(null);
    }, [agents, assistantState, editingId]);
    const handleSave = (agent: Agent) => {
        if (editingId) {
            updateAgent(editingId, agent);
        }
        else {
            addAgent(agent);
        }
        // Create version snapshot
        const existingVersions = useAppStore.getState().agentVersions.filter((v) => v.agentId === agent.id);
        const { memories: _mem, ...snapshotData } = agent;
        addAgentVersion({
            id: generateId('aver'),
            agentId: agent.id,
            version: existingVersions.length + 1,
            snapshot: snapshotData,
            createdAt: Date.now(),
            source: editingId ? 'manual' : 'marketplace',
        });
        setEditingId(null);
        setIsAdding(false);
    };
    const handleDelete = async (id: string) => {
        if (id === DEFAULT_AGENT_ID)
            return; // protect default agent
        const agent = agents.find((a) => a.id === id);
        if (!agent)
            return;
        const ok = await confirm({
            title: t('agents.deleteTitle', 'Delete agent?'),
            body: t('agents.deleteBody', '"{name}" will be permanently deleted. This cannot be undone.').replace('{name}', agent.name),
            danger: true,
            confirmText: t('common.delete', 'Delete'),
        });
        if (!ok)
            return;
        removeAgent(id);
        if (editingId === id)
            setEditingId(null);
    };
    const handleDuplicate = (agent: Agent) => {
        const clone: Agent = {
            ...agent,
            id: generateId('agent'),
            name: `${agent.name} (${t('common.copy', 'Copy')})`,
            memories: [], // start fresh
        };
        addAgent(clone);
        setEditingId(clone.id);
        setIsAdding(false);
    };
    const handleExport = (agent: Agent) => {
        const exportData = { ...agent };
        const blob = new Blob([safeStringify(exportData, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agent-${agent.name.replace(/\s+/g, '-').toLowerCase()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = safeParse<Agent>(reader.result as string);
                if (!data.name || !data.systemPrompt) {
                    toast.error(t('agents.invalidFile', 'Invalid agent file: missing required fields.'));
                    return;
                }
                const imported: Agent = {
                    ...data,
                    id: generateId('agent'), // always assign new ID
                    memories: data.memories || [],
                    skills: data.skills || [],
                    allowedTools: data.allowedTools || [],
                    enabled: true,
                };
                addAgent(imported);
                setEditingId(imported.id);
                setIsAdding(false);
            }
            catch {
                toast.error(t('agents.parseError', 'Failed to parse agent file. Please check the JSON format.'));
            }
        };
        reader.readAsText(file);
        // Reset so the same file can be re-imported
        e.target.value = '';
    };
    const handleStartChat = (agent: Agent) => {
        setSelectedAgent(agent);
        const session: Session = {
            id: generateId('session'),
            title: t('chat.newChat', 'New Chat'),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            agentId: agent.id,
            modelId: agent.modelId || undefined,
            messages: [],
        };
        addSession(session);
        setActiveSession(session.id);
        setActiveModule('chat');
    };
    const handleAssistantAgentMutated = () => {
        const store = useAppStore.getState();
        if (assistantState?.mode === 'edit' && assistantState.agentId) {
            const updatedAgent = store.agents.find((item) => item.id === assistantState.agentId) ?? null;
            if (updatedAgent) {
                setEditingId(updatedAgent.id);
                setIsAdding(false);
                setTestAgent(null);
                setEditorRevision((value) => value + 1);
                return;
            }
            if (editingId === assistantState.agentId) {
                setEditingId(null);
                setTestAgent(null);
                setEditorRevision((value) => value + 1);
            }
            setIsAdding(false);
            setAssistantState(null);
            return;
        }
        const selectedByTool = store.selectedAgent;
        const createdAgent = selectedByTool && store.agents.some((item) => item.id === selectedByTool.id)
            ? store.agents.find((item) => item.id === selectedByTool.id) ?? null
            : (store.agents[store.agents.length - 1] ?? null);
        if (!createdAgent)
            return;
        setEditingId(createdAgent.id);
        setIsAdding(false);
        setTestAgent(null);
        setEditorRevision((value) => value + 1);
    };
    const filteredMarketAgents = marketplaceAgents.filter((a) => !marketSearch || a.name.toLowerCase().includes(marketSearch.toLowerCase()) || a.category.toLowerCase().includes(marketSearch.toLowerCase()));
    const enabledAgentCount = agents.filter((agent) => agent.enabled).length;
    const editingAgent = editingId ? agents.find((a) => a.id === editingId) ?? null : null;
    const assistantAgent = assistantState?.agentId
        ? agents.find((a) => a.id === assistantState.agentId) ?? null
        : null;
    const editorHeader = (<div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border-subtle/60 bg-surface-0/70 px-4 py-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/55">{t('timer.assistantSection', 'Side chat')}</div>
        <div className="mt-1 text-sm font-semibold text-text-primary">
          {isAdding
            ? t('agents.agentAssistantTitleCreate', 'AI Create Agent')
            : t('agents.agentAssistantTitleEdit', 'AI Edit Agent')}
        </div>
        <p className="mt-1 text-[12px] text-text-secondary/78">
          {isAdding
            ? t('agents.agentAssistantHeroCreateHint', 'Describe the role, desired behavior, model preference, skills, and any tool or permission guardrails.')
            : t('agents.agentAssistantHeroEditHint', 'You can rewrite the system prompt, change skills or model routing, and tighten tool permissions.')}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <UiButton unstyled type="button" onClick={() => setAssistantState({ mode: 'create', agentId: null })} className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle/55 bg-surface-0/75 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-accent/18 hover:bg-accent/8 hover:text-accent">
          <IconifyIcon name="ui-sparkles" size={14} color="currentColor"/>
          {t('timer.aiCreate', 'AI Create')}
        </UiButton>
        {!isAdding && editingAgent && (<UiButton unstyled type="button" onClick={() => setAssistantState({ mode: 'edit', agentId: editingAgent.id })} className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-hover">
            <IconifyIcon name="ui-sparkles" size={14} color="currentColor"/>
            {t('timer.aiEditCurrent', 'AI Edit')}
          </UiButton>)}
      </div>
    </div>);
    const installMarketAgent = (tpl: MarketplaceAgentTemplate) => {
        const greetingTemplate = t('agents.marketplace.greeting', "Hi! I'm {name}. {description}");
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
            greeting: greetingTemplate.replace('{name}', () => tpl.name).replace('{description}', () => tpl.description),
            responseStyle: 'balanced',
            allowedTools: [],
            memories: [],
            autoLearn: true,
        };
        addAgent(agent);
        setEditingId(agent.id);
        setSideTab('local');
    };
    return (<>
      <SidePanel title={t('agents.title', 'Agents')} width={panelWidth} action={<div className="flex items-center gap-1.5">
            <UiButton unstyled type="button" onClick={() => setAssistantState({ mode: 'create', agentId: null })} title={t('timer.aiCreate', 'AI Create')} className={`${workbenchSidebarPrimaryActionClass} inline-flex items-center gap-1.5`}>
              <IconifyIcon name="ui-sparkles" size={13} color="currentColor"/>
              {t('timer.aiCreate', 'AI Create')}
            </UiButton>
            <UiButton unstyled type="button" onClick={() => setShowHub(!showHub)} title={t('agents.agentHub', 'Agent Hub')} className={showHub ? workbenchSidebarAccentActionClass : workbenchSidebarSubtleActionClass}>
              <IconifyIcon name="ui-link" size={14} color="currentColor"/>
            </UiButton>
            <UiButton unstyled type="button" onClick={() => fileInputRef.current?.click()} title={t('agents.importAgent', 'Import agent from JSON')} className={workbenchSidebarSubtleActionClass}>
              ↑
            </UiButton>
            <UiButton unstyled type="button" onClick={() => { setIsAdding(true); setEditingId(null); }} className={workbenchSidebarAccentActionClass}>
              + {t('common.new', 'New')}
            </UiButton>
          </div>}>
        <UiInput type="file" ref={fileInputRef} accept=".json" onChange={handleImport} className="hidden" aria-label={t('agents.importAgent', 'Import agent from JSON')}/>

        {/* Side panel tabs */}
        <div className="grid grid-cols-2 gap-1.5 px-3 pb-3 pt-1">
          <UiButton unstyled type="button" onClick={() => setSideTab('local')} className={workbenchSegmentButtonClass(sideTab === 'local')}>
            {t('agents.local', 'Local')} ({agents.length})
          </UiButton>
          <UiButton unstyled type="button" onClick={() => setSideTab('marketplace')} className={`${workbenchSegmentButtonClass(sideTab === 'marketplace')} inline-flex items-center justify-center gap-1.5`}>
            <IconifyIcon name="ui-cart" size={14} color="currentColor"/> {t('agents.market', 'Market')}
          </UiButton>
        </div>

        {sideTab === 'local' && (<AgentList agents={agents} editingId={editingId} searchQuery={searchQuery} onSearchChange={setSearchQuery} onSelect={(agent) => { setEditingId(agent.id); setIsAdding(false); }} getAgentActions={(agent) => [
              { key: 'chat', label: t('agents.startChat', 'Start Chat'), icon: 'ui-chat', onClick: () => handleStartChat(agent) },
              { key: 'ai-edit', label: t('timer.aiEditCurrent', 'AI Edit'), icon: 'ui-sparkles', onClick: () => setAssistantState({ mode: 'edit', agentId: agent.id }) },
              { key: 'edit', label: t('common.edit', 'Edit'), icon: 'ui-edit', onClick: () => { setEditingId(agent.id); setIsAdding(false); } },
              { key: 'duplicate', label: t('common.duplicate', 'Duplicate'), icon: 'ui-copy', onClick: () => handleDuplicate(agent) },
              { key: 'export', label: t('common.export', 'Export'), icon: 'ui-export', onClick: () => handleExport(agent) },
              ...(agent.id !== DEFAULT_AGENT_ID ? [{ key: 'delete', label: t('common.delete', 'Delete'), icon: 'ui-trash', tone: 'danger' as const, separator: true, onClick: () => void handleDelete(agent.id) }] : []),
            ]}/>)}

        {sideTab === 'marketplace' && (<div className="module-sidebar-stack px-3 pb-3 space-y-3">
            <div className={workbenchSidebarCardClass}>
              <div className="relative">
              <IconifyIcon name="ui-search" size={14} color="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/55 pointer-events-none"/>
              <UiInput type="text" value={marketSearch} onChange={(e) => setMarketSearch(e.target.value)} placeholder={t('agents.search', 'Search agents...')} wrapperClassName="w-full" controlClassName={workbenchSidebarSearchInputClass}/>
              </div>
            </div>
            {filteredMarketAgents.map((tpl, idx) => {
                const alreadyInstalled = agents.some((a) => a.avatar === tpl.avatar && tpl.skills.every((skillId) => a.skills.includes(skillId)));
                return (<div key={idx} className={`${workbenchSidebarCardClass} transition-all duration-200 hover:border-accent/18`}>
                  <div className="flex items-start gap-3">
                    <div className={`${workbenchSidebarIconClass} mt-0.5`}>
                      <AgentAvatar avatar={tpl.avatar} size={22}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={workbenchSidebarTitleClass}>{tpl.name}</span>
                        <span className={workbenchSidebarPillClass}>{tpl.category}</span>
                      </div>
                      <p className={workbenchSidebarDescriptionClass}>{tpl.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-text-muted">
                        <span className={workbenchSidebarPillClass}>⭐ {tpl.rating}</span>
                        <span className={workbenchSidebarPillClass}>↓ {tpl.downloads}</span>
                        <span className={workbenchSidebarPillClass}>{tpl.skills.length} {t('agents.skills', 'skills')}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="text-[10px] text-text-muted/65 line-clamp-1">
                          {tpl.systemPrompt}
                        </div>
                        <UiButton unstyled type="button" onClick={() => installMarketAgent(tpl)} disabled={alreadyInstalled} className={`shrink-0 ${alreadyInstalled
                        ? workbenchSidebarSubtleActionClass
                        : workbenchSidebarAccentActionClass}`}>
                          {alreadyInstalled ? t('common.installed', 'Installed') : t('common.install', 'Install')}
                        </UiButton>
                      </div>
                    </div>
                  </div>
                </div>);
            })}
          </div>)}

      </SidePanel>
      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={280} maxWidth={420}/>

      {showHub ? (<Suspense fallback={<div className="flex-1 bg-surface-0/40" />}>
          <LazyAgentOrchestrationPanel agents={agents} title={t('agents.agentHub', 'Agent Hub')} allowedTabs={['communications', 'versions', 'performance']} initialTab="communications" onClose={() => setShowHub(false)}/>
        </Suspense>) : isAdding || editingId ? (<>
          <div className="min-h-0 min-w-0 flex flex-1 overflow-hidden">
            <Suspense fallback={<div className="flex-1 bg-surface-0/40" />}>
              <LazyAgentEditor key={`${editingId ?? 'new'}:${editorRevision}`} agent={isAdding ? null : editingAgent} onSave={handleSave} onCancel={() => { setIsAdding(false); setEditingId(null); setTestAgent(null); }} onTest={(agentData) => setTestAgent(agentData)} header={editorHeader}/>
            </Suspense>
          </div>
          {testAgent && (<div className="min-h-0 w-95 shrink-0">
              <Suspense fallback={<div className="h-full rounded-l-3xl border-l border-border-subtle/70 bg-surface-1/70" />}>
                <LazyAgentTestChat key={testAgent.id} agent={testAgent} onClose={() => setTestAgent(null)}/>
              </Suspense>
            </div>)}
        </>) : (<div className="module-canvas flex-1 overflow-y-auto px-6 py-8 text-text-muted xl:px-10">
          <WorkbenchEmptyState icon={<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z"/></svg>} eyebrow={t('agents.studioWorkspace', 'Agent Workspace')} title={t('agents.selectToEdit', 'Select an agent to edit')} description={t('agents.emptyStateDetail', 'Build specialists with distinct prompts, curated skills, and guardrails. Pick an existing agent to refine it, or create a new one as a reusable starting point.')} actions={(<>
                <UiButton unstyled type="button" onClick={() => setAssistantState({ mode: 'create', agentId: null })} className={workbenchSidebarPrimaryActionClass}>
                  {t('timer.aiCreate', 'AI Create')}
                </UiButton>
                <UiButton unstyled type="button" onClick={() => { setIsAdding(true); setEditingId(null); }} className={workbenchSidebarSubtleActionClass}>
                  + {t('common.new', 'New')} {t('agents.title', 'Agents')}
                </UiButton>
                <UiButton unstyled type="button" onClick={() => setShowHub(true)} className={workbenchSidebarSubtleActionClass}>
                  {t('agents.agentHub', 'Agent Hub')}
                </UiButton>
              </>)} metrics={[
                {
                    label: t('common.total', 'Total'),
                    value: agents.length,
                    description: t('agents.availableSpecialists', 'available specialists'),
                },
                {
                    label: t('common.enabled', 'Enabled'),
                    value: enabledAgentCount,
                    description: t('agents.readyForUse', 'ready for use'),
                },
                {
                    label: t('agents.market', 'Market'),
                    value: marketplaceAgents.length,
                    description: t('agents.starterTemplates', 'starter templates'),
                },
            ]}/>
        </div>)}
      {assistantState && (<Suspense fallback={null}>
          <LazyAgentAssistantDrawer mode={assistantState.mode} agent={assistantState.mode === 'edit' ? assistantAgent : null} onClose={() => setAssistantState(null)} onAgentMutated={handleAssistantAgentMutated}/>
        </Suspense>)}
    </>);
}



