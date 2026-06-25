import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ChatInput } from '@/components/chat/ChatInput';
import { MessageBubble } from '@/components/chat/ChatMessages';
import { IconifyIcon } from '@/components/icons/IconifyIcons';
import { useAIChat } from '@/hooks/useAIChat';
import { useI18n } from '@/hooks/useI18n';
import { AGENT_BUILDER_AGENT_ID, useAppStore } from '@/store/appStore';
import type { Agent, MessageAttachment, Session, Skill } from '@/types';
import { generateId } from '@/utils/helpers';
import { Button as UiButton } from "@/components/catalyst-ui/button";
import { Select as UiSelect } from "@/components/catalyst-ui/form-controls";
import { workbenchSectionEyebrowClass, workbenchSidebarSubtleActionClass } from '@/components/catalyst-ui/workbench';
type AgentAssistantMode = 'create' | 'edit';
type Translate = (key: string, fallback: string) => string;
function ContextChip({ label, value }: {
    label: string;
    value: string;
}) {
    return (<div className="rounded-2xl border border-border-subtle/50 bg-surface-0/72 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/45">{label}</div>
      <div className="mt-1 text-[12px] leading-5 text-text-primary">{value}</div>
    </div>);
}
function SuggestionButton({ label, onClick, disabled, }: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (<UiButton unstyled type="button" onClick={onClick} disabled={disabled} className="rounded-[22px] border border-border-subtle/55 bg-surface-0/64 px-4 py-3 text-left text-[12px] leading-5 text-text-secondary transition-colors hover:border-accent/22 hover:bg-accent/8 hover:text-text-primary disabled:opacity-45">
      {label}
    </UiButton>);
}
function truncateValue(value: string, maxLength = 180): string {
    if (value.length <= maxLength)
        return value;
    return `${value.slice(0, maxLength - 1)}...`;
}
function summarizeList(values: string[] | undefined, t: Translate): string {
    if (!values || values.length === 0)
        return t('common.none', 'None');
    return values.join(', ');
}
function summarizeSkills(skills: Skill[], t: Translate): string {
    const enabledSkills = skills.filter((skill) => skill.enabled !== false);
    if (enabledSkills.length === 0)
        return t('common.none', 'None');
    return enabledSkills
        .slice(0, 12)
        .map((skill) => `${skill.name} (${skill.id})`)
        .join(', ');
}
function summarizeModels(models: ReturnType<typeof useAppStore.getState>['models'], t: Translate): string {
    const enabledModels = models.filter((model) => model.enabled);
    if (enabledModels.length === 0)
        return t('common.none', 'None');
    return enabledModels
        .slice(0, 8)
        .map((model) => `${model.name} (${model.id})`)
        .join(', ');
}
function buildContextPrompt({ mode, agent, t, modelSummary, skillSummary, }: {
    mode: AgentAssistantMode;
    agent?: Agent | null;
    t: Translate;
    modelSummary: string;
    skillSummary: string;
}) {
    const lines = [
        t('agents.agentAssistantContextIntro', "You are operating inside Suora's Agents module as the agent assistant."),
        t('agents.agentAssistantContextTools', 'Use agent_list, agent_add, agent_update, and agent_remove to help the user create or modify saved agents. Use list_models or list_skills when exact ids are unclear.'),
        mode === 'edit' && agent
            ? t('agents.agentAssistantContextEditTarget', 'When the user says "this agent" or "current agent", it refers to the target agent below. Unless the user explicitly asks to create a new agent or delete it, prefer agent_update with this id.')
            : t('agents.agentAssistantContextCreateTarget', 'The default goal in this session is to create a new saved agent. If the user wants to edit an existing agent, list or identify the target agent first.'),
        t('agents.agentAssistantContextConfirm', 'Before executing an add, update, or remove action, first summarize the structured agent fields you plan to apply. The tool layer will ask for a final confirmation.'),
        `${t('agents.agentAssistantAvailableModels', 'Available models')}: ${modelSummary}`,
        `${t('agents.agentAssistantAvailableSkills', 'Available skills')}: ${skillSummary}`,
        `${t('timer.assistantMode', 'Mode')}: ${mode === 'edit' ? t('agents.agentAssistantModeEdit', 'Edit saved agent') : t('agents.agentAssistantModeCreate', 'Create saved agent')}`,
    ];
    if (mode === 'edit' && agent) {
        const noneLabel = t('common.none', 'None');
        lines.push(`${t('agents.agentAssistantTargetAgentId', 'Target agent id')}: ${agent.id}`, `${t('agents.agentAssistantCurrentName', 'Current name')}: ${agent.name}`, `${t('agents.agentAssistantCurrentModel', 'Current model')}: ${agent.modelId || noneLabel}`, `${t('agents.agentAssistantCurrentSkills', 'Current skills')}: ${summarizeList(agent.skills, t)}`, `${t('agents.agentAssistantCurrentAllowedTools', 'Current allowed tools')}: ${summarizeList(agent.allowedTools, t)}`, `${t('agents.agentAssistantCurrentDisallowedTools', 'Current disallowed tools')}: ${summarizeList(agent.disallowedTools, t)}`, `${t('agents.agentAssistantCurrentWhenToUse', 'Current when-to-use hint')}: ${agent.whenToUse || noneLabel}`, `${t('agents.agentAssistantCurrentResponseStyle', 'Current response style')}: ${agent.responseStyle || noneLabel}`, `${t('agents.agentAssistantCurrentPermissionMode', 'Current permission mode')}: ${agent.permissionMode || 'default'}`, `${t('agents.agentAssistantCurrentAutoLearn', 'Current auto-learn')}: ${agent.autoLearn ? t('common.enabled', 'Enabled') : t('common.off', 'Off')}`, `${t('agents.agentAssistantCurrentPrompt', 'Current system prompt')}: ${truncateValue(agent.systemPrompt, 260) || noneLabel}`);
    }
    return lines.join('\n');
}
function buildSessionTitle(mode: AgentAssistantMode, agent: Agent | null | undefined, t: Translate) {
    if (mode === 'edit' && agent) {
        return `${t('agents.agentAssistantLabel', 'Agent assistant')} · ${agent.name}`;
    }
    return `${t('agents.agentAssistantLabel', 'Agent assistant')} · ${t('agents.agentAssistantTargetDraft', 'New saved agent')}`;
}
export function AgentAssistantDrawer({ mode, agent, onClose, onAgentMutated, }: {
    mode: AgentAssistantMode;
    agent?: Agent | null;
    onClose: () => void;
    onAgentMutated?: () => void;
}) {
    const { sessions, addSession, updateSession, selectedModel, models, skills, } = useAppStore();
    const { t } = useI18n();
    const [sessionId, setSessionId] = useState<string | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const contextKeyRef = useRef<string | null>(null);
    const processedToolCallsRef = useRef<Set<string>>(new Set());
    const messagesScrollRef = useRef<HTMLDivElement>(null);
    const { sendMessage, cancelStream, retryLastError, deleteMessage, regenerateMessage, clearMessages, isLoading: isStreaming } = useAIChat({ sessionId });
    const cancelStreamRef = useRef<() => void>(() => { });
    const contextKey = `${mode}:${agent?.id ?? 'create'}`;
    const modelSummary = useMemo(() => summarizeModels(models, t), [models, t]);
    const skillSummary = useMemo(() => summarizeSkills(skills, t), [skills, t]);
    const contextPrompt = useMemo(() => buildContextPrompt({ mode, agent, t, modelSummary, skillSummary }), [agent, mode, modelSummary, skillSummary, t]);
    useEffect(() => {
        sessionIdRef.current = sessionId;
    }, [sessionId]);
    useEffect(() => {
        cancelStreamRef.current = cancelStream;
    }, [cancelStream]);
    useEffect(() => {
        const session: Session = {
            id: generateId('session'),
            title: buildSessionTitle(mode, agent, t),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            surface: 'agents-assistant',
            agentId: AGENT_BUILDER_AGENT_ID,
            modelId: selectedModel?.id,
            messages: [],
            contextPrompt,
        };
        contextKeyRef.current = contextKey;
        addSession(session);
        setSessionId(session.id);
        return () => {
            cancelStreamRef.current();
            const currentSessionId = sessionIdRef.current;
            if (!currentSessionId)
                return;
            queueMicrotask(() => {
                const store = useAppStore.getState();
                if (store.sessions.some((item) => item.id === currentSessionId)) {
                    store.removeSession(currentSessionId);
                }
            });
        };
    }, [addSession]);
    useEffect(() => {
        if (!sessionId)
            return;
        const previousKey = contextKeyRef.current;
        const contextChanged = Boolean(previousKey && previousKey !== contextKey);
        contextKeyRef.current = contextKey;
        if (contextChanged) {
            cancelStream();
            processedToolCallsRef.current.clear();
        }
        updateSession(sessionId, {
            title: buildSessionTitle(mode, agent, t),
            agentId: AGENT_BUILDER_AGENT_ID,
            modelId: selectedModel?.id,
            contextPrompt,
            ...(contextChanged ? { messages: [] } : {}),
        });
    }, [agent, cancelStream, contextKey, contextPrompt, mode, selectedModel?.id, sessionId, t, updateSession]);
    const session = sessions.find((item) => item.id === sessionId) ?? null;
    const messages = session?.messages ?? [];
    const sessionModel = session?.modelId
        ? models.find((model) => model.id === session.modelId) ?? null
        : selectedModel;
    const selectableModels = useMemo(() => models.filter((model) => model.enabled), [models]);
    const handleSessionModelChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
        if (!sessionId)
            return;
        const nextModelId = event.target.value || undefined;
        updateSession(sessionId, { modelId: nextModelId });
    }, [sessionId, updateSession]);
    const starterPrompts = useMemo(() => {
        if (mode === 'edit') {
            return [
                t('agents.agentAssistantPromptEditPrompt', 'Rewrite this agent to be stricter about actionable output and add a stronger review checklist.'),
                t('agents.agentAssistantPromptEditTools', 'Limit this agent to read-only tools and remove any write access it does not need.'),
                t('agents.agentAssistantPromptEditSkills', 'Assign the most relevant skills for this agent and update the when-to-use guidance.'),
            ];
        }
        return [
            t('agents.agentAssistantPromptCreatePlanner', 'Create an agent that turns rough product requests into implementation plans and keeps the output concise.'),
            t('agents.agentAssistantPromptCreateReviewer', 'Create a PR review agent focused on finding regressions, risks, and missing tests using mostly read-only tools.'),
            t('agents.agentAssistantPromptCreateSupport', 'Create a customer support agent that drafts empathetic replies and suggests escalation criteria.'),
        ];
    }, [mode, t]);
    const handleSend = useCallback((input: string, attachments?: MessageAttachment[]) => {
        if (!sessionId)
            return;
        void sendMessage(input, attachments);
    }, [sendMessage, sessionId]);
    useEffect(() => {
        const container = messagesScrollRef.current;
        if (!container)
            return;
        if (typeof container.scrollTo === 'function') {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            return;
        }
        container.scrollTop = container.scrollHeight;
    }, [messages]);
    useEffect(() => {
        if (!onAgentMutated)
            return;
        let hasMutation = false;
        for (const message of messages) {
            for (const toolCall of message.toolCalls ?? []) {
                if (!['agent_add', 'agent_update', 'agent_remove'].includes(toolCall.toolName))
                    continue;
                if (toolCall.status !== 'completed' || processedToolCallsRef.current.has(toolCall.id))
                    continue;
                processedToolCallsRef.current.add(toolCall.id);
                hasMutation = true;
            }
        }
        if (hasMutation)
            onAgentMutated();
    }, [messages, onAgentMutated]);
    return (<div className="pointer-events-none absolute inset-y-0 right-0 z-40 flex w-full justify-end pl-16">
      <section role="dialog" aria-label={t('agents.agentAssistantLabel', 'Agent assistant')} className="pointer-events-auto flex h-full w-full max-w-136 flex-col border-l border-border-subtle/55 bg-surface-0/94 shadow-[-24px_0_60px_rgba(15,23,42,0.22)] backdrop-blur-xl">
        <div className="border-b border-border-subtle/55 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className={workbenchSectionEyebrowClass}>{t('timer.assistantSection', 'Side chat')}</div>
              <h2 className="mt-1 text-[20px] font-semibold text-text-primary">
                {mode === 'edit' ? t('agents.agentAssistantTitleEdit', 'AI Edit Agent') : t('agents.agentAssistantTitleCreate', 'AI Create Agent')}
              </h2>
              <p className="mt-1 text-[12px] leading-5 text-text-secondary/78">
                {t('agents.agentAssistantDescription', 'Create or modify saved agents in natural language. A confirmation step is required before changes execute.')}
              </p>
            </div>
            <div className="flex items-center gap-2">
                            {messages.length > 0 && (<UiButton unstyled type="button" onClick={clearMessages} disabled={isStreaming} className={`${workbenchSidebarSubtleActionClass} disabled:opacity-45`}>
                  {t('timer.assistantClear', 'Clear')}
                </UiButton>)}
              <UiButton unstyled type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border-subtle/55 bg-surface-0/70 text-text-muted transition-colors hover:border-accent/18 hover:bg-accent/10 hover:text-accent" aria-label={t('agents.agentAssistantClose', 'Close agent assistant')} title={t('common.close', 'Close')}>
                <IconifyIcon name="ui-close" size={16} color="currentColor"/>
              </UiButton>
            </div>
          </div>
        </div>

        <div className="border-b border-border-subtle/55 px-5 py-4">
          <div className="mb-3">
            <label htmlFor="agent-assistant-model" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/45">
              {t('agents.agentAssistantModelPicker', 'Assistant model')}
            </label>
            <UiSelect id="agent-assistant-model" aria-label={t('agents.agentAssistantModelPicker', 'Assistant model')} value={session?.modelId ?? ''} onChange={handleSessionModelChange} disabled={isStreaming || selectableModels.length === 0} wrapperClassName="mt-2" controlClassName="rounded-2xl border border-border-subtle/55 bg-surface-0/72 px-3 py-2 text-[12px] text-text-primary">
              <option value="">{t('chat.selectModel', '-- Select Model --')}</option>
              {selectableModels.map((model) => (<option key={model.id} value={model.id}>{model.name}</option>))}
            </UiSelect>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ContextChip label={t('timer.assistantMode', 'Mode')} value={mode === 'edit' ? t('agents.agentAssistantModeEdit', 'Edit saved agent') : t('agents.agentAssistantModeCreate', 'Create saved agent')}/>
            <ContextChip label={t('timer.assistantModel', 'Model')} value={sessionModel?.name || t('timer.assistantNoModelSelected', 'No model selected')}/>
            <ContextChip label={t('timer.assistantConfirmation', 'Confirmation')} value={t('agents.agentAssistantConfirmationHint', 'agent_add / agent_update / agent_remove will ask for confirmation')}/>
            <ContextChip label={t('timer.assistantTarget', 'Target')} value={agent ? `${agent.name} (${agent.id})` : t('agents.agentAssistantTargetDraft', 'New saved agent')}/>
            {agent && <ContextChip label={t('agents.agentAssistantCurrentSkills', 'Current skills')} value={summarizeList(agent.skills, t)}/>}
            {agent && <ContextChip label={t('agents.agentAssistantCurrentModel', 'Current model')} value={agent.modelId || t('common.none', 'None')}/>}
          </div>
        </div>

        <div ref={messagesScrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (<div className="space-y-4">
              <div className="rounded-[26px] border border-border-subtle/55 bg-linear-to-br from-surface-1/94 via-surface-1/86 to-surface-2/72 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <IconifyIcon name="ui-sparkles" size={22} color="currentColor"/>
                </div>
                <h3 className="mt-4 text-[18px] font-semibold text-text-primary">
                  {mode === 'edit'
                ? t('agents.agentAssistantHeroEdit', 'Tell me how you want to change this agent')
                : t('agents.agentAssistantHeroCreate', 'Describe the agent you want to create')}
                </h3>
                <p className="mt-2 text-[12px] leading-6 text-text-secondary/78">
                  {mode === 'edit'
                ? t('agents.agentAssistantHeroEditHint', 'You can rewrite the system prompt, change skills or model routing, and tighten tool permissions.')
                : t('agents.agentAssistantHeroCreateHint', 'Describe the role, desired behavior, model preference, skills, and any tool or permission guardrails.')}
                </p>
              </div>

              <div className="space-y-2">
                {starterPrompts.map((prompt) => (<SuggestionButton key={prompt} label={prompt} disabled={isStreaming || !sessionModel} onClick={() => handleSend(prompt)}/>))}
              </div>

              {!sessionModel && (<div className="rounded-2xl border border-warning/18 bg-warning/10 px-4 py-3 text-[12px] leading-5 text-warning">
                  {t('agents.agentAssistantNoModel', 'No active model is available yet. Select a model in Models before using the agent assistant.')}
                </div>)}
            </div>) : (<div className="space-y-1.5">
              {messages.map((message) => (<MessageBubble key={message.id} message={message} onRetry={message.isError ? () => retryLastError() : undefined} onDelete={() => deleteMessage(message.id)} onRegenerate={message.role === 'assistant' && !message.isStreaming ? () => regenerateMessage(message.id) : undefined}/>))}

            </div>)}
        </div>

        <div className="border-t border-border-subtle/55 px-5 py-4">
          <ChatInput onSend={handleSend} disabled={isStreaming || !sessionModel} isStreaming={isStreaming} onStop={cancelStream} noModel={!sessionModel}/>
        </div>
      </section>
    </div>);
}


