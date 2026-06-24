// Global state management using Zustand
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ActiveModule, Model, Session, Agent, Skill, AgentMemoryEntry, ToolSecuritySettings, MarketplaceSettings, ThemeMode, FontSize, CodeFont, BubbleStyle, ProviderConfig, ExternalDirectoryConfig, ChannelConfig, AppNotification, ModelUsageStats, ChannelHistoryMessage, ChannelAccessToken, ChannelHealthStatus, ChannelUser, PluginInfo, AgentVersion, AgentPerformanceStats, AgentPipeline, AgentPipelineStep, AppLocale, ProxySettings, OnboardingState, SkillVersion, EmailConfig, EnvVariable, MCPServerConfig, MCPServerStatus, DocumentGroup, DocumentFolder, DocumentItem, DocumentNode, AgentSelectionPreference } from '@/types'
import { setLiveStoreAccessor, setLiveStoreWriter } from '@/services/tools'
import { setPluginLiveStoreAccessor } from '@/services/pluginSystem'
import { setVectorMemoryLiveStoreAccessor } from '@/services/vectorMemory'
import { loadExternalResources, syncExternalDirectoryAccess } from '@/services/externalDirectories'
import { loadAllSkills } from '@/services/skillRegistry'
import { normalizeAppLocale, setI18nLocale, t } from '@/services/i18n'
import { fileStateStorage, flushPendingSplitStoreWrites } from '@/services/fileStorage'
import { createSessionSlice } from '@/store/slices/sessionSlice'
import { createModelConfigSlice, normalizeToolSecuritySettings, syncToolSecurityToElectron } from '@/store/slices/modelConfigSlice'
import { createUIPreferencesSlice } from '@/store/slices/uiPreferencesSlice'
import { createSafePersistStorage } from '@/services/safePersistStorage'
import { taskFingerprint } from '@/utils/taskFingerprint'

function normalizeExternalDirectoryPathInStore(path: string): string {
  const normalizedPath = path.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  const normalizedKey = normalizedPath.toLowerCase()

  if (normalizedKey === '~/.claude/.suora/skills') return '~/.claude/skills'
  if (normalizedKey === '~/.agents/.suora/skills') return '~/.agents/skills'

  return normalizedPath
}

function normalizeExternalDirectoriesInStore(
  directories: ExternalDirectoryConfig[],
): ExternalDirectoryConfig[] {
  const deduped = new Map<string, ExternalDirectoryConfig>()

  for (const directory of directories) {
    if (!directory?.path?.trim()) continue

    const normalizedPath = normalizeExternalDirectoryPathInStore(directory.path)
    const key = `${directory.type}:${normalizedPath.toLowerCase()}`
    const existing = deduped.get(key)

    deduped.set(key, {
      ...(existing ?? directory),
      ...directory,
      path: normalizedPath,
      enabled: existing ? existing.enabled || directory.enabled : directory.enabled,
    })
  }

  return Array.from(deduped.values())
}

function normalizeAgentMaxTurns(maxTurns: number | undefined): number | undefined {
  if (typeof maxTurns !== 'number' || !Number.isFinite(maxTurns)) return undefined
  return Math.max(2, Math.trunc(maxTurns))
}

function normalizeAgent(agent: Agent): Agent {
  const maxTurns = normalizeAgentMaxTurns(agent.maxTurns)
  const normalizedAgent = agent.enabled === undefined
    ? { ...agent, enabled: true }
    : agent
  return maxTurns === undefined ? normalizedAgent : { ...normalizedAgent, maxTurns }
}

function normalizeAgentPatch(agent: Partial<Agent>): Partial<Agent> {
  if (agent.maxTurns === undefined) return agent
  return { ...agent, maxTurns: normalizeAgentMaxTurns(agent.maxTurns) }
}

// ─── Default general-purpose agent ─────────────────────────────────

const LEGACY_DEFAULT_AGENT_NAME = ['Assistant', '助手']
const LEGACY_DEFAULT_AGENT_WHEN_TO_USE = [
  'General-purpose tasks, Q&A, and any task not better suited for a specialized agent',
  '适合通用任务、问答和任何不更适合专门智能体的任务',
]
const LEGACY_DEFAULT_AGENT_GREETING = [
  'Hi! I\'m your Suora. How can I help you today?',
  '你好，我是你的 Suora。今天想让我帮你处理什么？',
]
const LEGACY_DEFAULT_AGENT_SYSTEM_PROMPT = [
  'You are a helpful, friendly, and knowledgeable AI assistant with access to all available tools and skills. You can help with a wide range of tasks including answering questions, writing, coding, analysis, file operations, sending emails, reading webpages by URL, running shell commands, managing timers, git operations, and much more. Proactively use the most appropriate tool for each task. When a task can benefit from a tool, use it without hesitation. Be clear and concise in your responses. When you are unsure, say so honestly. If the user speaks in Chinese, reply in Chinese; otherwise match the user\'s language.',
  '你是一个友好、可靠且知识丰富的 AI 助手，可以使用所有可用的工具和技能。你能够协助回答问题、写作、编程、分析、文件操作、发送邮件、按 URL 读取网页、执行命令、管理定时任务、进行 Git 操作等各种任务。请主动选择最合适的工具；当任务适合借助工具完成时，不要犹豫。回复时保持清晰和简洁；如果你不确定，请诚实说明。如果用户使用中文，就用中文回复，否则匹配用户的语言。',
]

export const PIPELINE_BUILDER_AGENT_ID = 'builtin-pipeline-builder'
export const TIMER_BUILDER_AGENT_ID = 'builtin-timer-builder'
export const DOCUMENT_EDITOR_AGENT_ID = 'builtin-document-editor'
export const AGENT_BUILDER_AGENT_ID = 'builtin-agent-builder'
export const CHANNEL_BUILDER_AGENT_ID = 'builtin-channel-builder'

const LEGACY_PIPELINE_BUILDER_AGENT_NAME = ['Pipeline builder', '流水线编排']
const LEGACY_PIPELINE_BUILDER_AGENT_WHEN_TO_USE = [
  'Use inside the Pipeline module to convert natural-language requirements into saved pipelines, update existing pipelines, and keep the work focused on pipeline structure instead of completing the end task directly.',
  '在流水线模块中使用，将自然语言需求转换成已保存的流水线、更新现有流水线，并把重点放在流水线结构上，而不是直接替用户完成业务任务。',
]
const LEGACY_PIPELINE_BUILDER_AGENT_GREETING = [
  'Ready to build pipelines.',
  '已准备好创建流水线。',
]
const LEGACY_PIPELINE_BUILDER_AGENT_SYSTEM_PROMPT = [
  'You are Suora\'s pipeline builder. Your job is to create, inspect, update, or remove saved pipelines inside the Pipeline module. Do not complete the user\'s requested business task directly. Instead, translate the request into a structured saved pipeline and use pipeline_list, pipeline_add, pipeline_update, and pipeline_remove when needed. Before any mutation, briefly summarize the pipeline fields you are about to apply. If required details are missing, ask a short clarifying question. Prefer existing enabled agents for steps, and only add variables, retries, timeouts, or budgets when they materially improve the pipeline.',
  '你是 Suora 的流水线编排助手。你的职责是在流水线模块中创建、检查、更新或删除已保存的流水线。不要直接替用户完成其业务任务，而是把需求翻译成结构化的已保存流水线，并在需要时使用 pipeline_list、pipeline_add、pipeline_update、pipeline_remove。在执行任何增删改之前，先简要总结你将要应用的流水线字段。如果关键信息缺失，先提出一个简短的澄清问题。步骤应优先复用当前已启用的 agent，只有在确实能改善流水线时才添加变量、重试、超时或预算限制。',
]

const LEGACY_AGENT_BUILDER_AGENT_NAME = ['Agent builder', '智能体编排']
const LEGACY_AGENT_BUILDER_AGENT_WHEN_TO_USE = [
  'Use inside the Agents module to turn natural-language requirements into saved agent profiles, update existing agents, and keep the work focused on agent configuration instead of completing the end task directly.',
  '在智能体模块中使用，将自然语言需求转换成已保存的智能体配置、更新现有智能体，并把重点放在智能体配置本身，而不是直接替用户完成终局任务。',
]
const LEGACY_AGENT_BUILDER_AGENT_GREETING = [
  'Ready to build agents.',
  '已准备好创建智能体。',
]
const LEGACY_AGENT_BUILDER_AGENT_SYSTEM_PROMPT = [
  'You are Suora\'s agent builder. Your job is to create, inspect, update, or remove saved agents inside the Agents module. Do not complete the user\'s requested business task directly. Instead, translate the request into a structured saved agent profile and use agent_list, agent_add, agent_update, and agent_remove when needed. If the exact model id or skill id is unclear, use list_models or list_skills first. Before any mutation, briefly summarize the agent fields you are about to apply. If required details are missing, ask a short clarifying question. Keep the resulting agent practical: choose a clear system prompt, only add tool restrictions when they materially improve safety, and prefer the simplest configuration that satisfies the request.',
  '你是 Suora 的智能体编排助手。你的职责是在智能体模块中创建、检查、更新或删除已保存的智能体。不要直接替用户完成其业务任务，而是把需求翻译成结构化的已保存智能体配置，并在需要时使用 agent_list、agent_add、agent_update、agent_remove。如果模型 ID 或技能 ID 不明确，先使用 list_models 或 list_skills 确认。在执行任何增删改之前，先简要总结你将要应用的智能体字段。如果关键信息缺失，先提出一个简短的澄清问题。配置要务实：给出清晰的 system prompt，只在确实能改善安全性时再添加工具限制，并优先采用满足需求的最简配置。',
]

const LEGACY_TIMER_BUILDER_AGENT_NAME = ['Timer builder', '定时任务编排']
const LEGACY_TIMER_BUILDER_AGENT_WHEN_TO_USE = [
  'Use inside the Timer module to turn natural-language scheduling requests into saved timers, update existing timers, and keep the work focused on timer structure instead of completing the end task directly.',
  '在定时任务模块中使用，将自然语言调度需求转换成已保存的定时任务、更新现有定时任务，并把重点放在定时任务结构上，而不是直接替用户完成终局任务。',
]
const LEGACY_TIMER_BUILDER_AGENT_GREETING = [
  'Ready to build timers.',
  '已准备好创建定时任务。',
]
const LEGACY_TIMER_BUILDER_AGENT_SYSTEM_PROMPT = [
  'You are Suora\'s timer builder. Your job is to create, inspect, update, or remove saved timers inside the Timer module. Do not complete the user\'s requested business task directly. Instead, translate the request into a structured saved timer and use timer_list, timer_add, timer_update, and timer_remove when needed. If the timer should run a saved pipeline and the pipeline id is unclear, use pipeline_list to identify it first. Before any mutation, briefly summarize the timer fields you are about to apply. If required details are missing, ask a short clarifying question. Prefer the simplest timer shape that satisfies the request.',
  '你是 Suora 的定时任务编排助手。你的职责是在定时任务模块中创建、检查、更新或删除已保存的定时任务。不要直接替用户完成其业务任务，而是把需求翻译成结构化的已保存定时任务，并在需要时使用 timer_list、timer_add、timer_update、timer_remove。如果定时任务需要运行某个已保存流水线，但流水线 ID 不明确，先使用 pipeline_list 识别目标流水线。在执行任何增删改之前，先简要总结你将要应用的定时任务字段。如果关键信息缺失，先提出一个简短的澄清问题。优先使用能满足需求的最简单定时任务结构。',
]

const LEGACY_DOCUMENT_EDITOR_AGENT_NAME = ['Document editor', '文档编辑']
const LEGACY_DOCUMENT_EDITOR_AGENT_WHEN_TO_USE = [
  'Use inside the Documents module to create new documents, rewrite existing ones, and keep the work focused on saved document content instead of only replying in chat.',
  '在文档模块中使用，用来创建新文档、重写现有文档，并把重点放在已保存的文档内容上，而不是只在聊天里回复结果。',
]
const LEGACY_DOCUMENT_EDITOR_AGENT_GREETING = [
  'Ready to edit documents.',
  '已准备好编辑文档。',
]
const LEGACY_DOCUMENT_EDITOR_AGENT_SYSTEM_PROMPT = [
  'You are Suora\'s document editor. Your job is to create and revise saved documents inside the Documents module. When the user wants a result saved as a document, do not stop at a chat reply. Use list_documents and read_document to inspect existing notes, then use create_document or update_document to write the requested content into the workspace. Before any mutation, briefly summarize the document title, location, and content changes you plan to apply. If the target document or destination is unclear, ask a short clarifying question.',
  '你是 Suora 的文档编辑助手。你的职责是在文档模块中创建和修订已保存文档。当用户希望结果被保存成文档时，不要只停留在聊天回复。先使用 list_documents 和 read_document 检查现有笔记，再使用 create_document 或 update_document 把要求的内容写入工作区。在执行任何增删改之前，先简要总结你将要应用的文档标题、位置和内容变更。如果目标文档或保存位置不明确，先提出一个简短的澄清问题。',
]

const LEGACY_CHANNEL_BUILDER_AGENT_NAME = ['Channel builder', '渠道编排']
const LEGACY_CHANNEL_BUILDER_AGENT_WHEN_TO_USE = [
  'Use inside the Channels module to create, inspect, update, or remove channel integrations and keep the work focused on channel configuration.',
  '在渠道模块中使用，用来创建、检查、更新或删除渠道集成，并把重点放在渠道配置上。',
]
const LEGACY_CHANNEL_BUILDER_AGENT_GREETING = [
  'Ready to build channels.',
  '已准备好创建渠道。',
]
const LEGACY_CHANNEL_BUILDER_AGENT_SYSTEM_PROMPT = [
  'You are Suora\'s channel builder. Your job is to create, inspect, update, or remove saved channel integrations inside the Channels module. Use channel_list, channel_add, channel_update, and channel_remove when needed. Before any mutation, briefly summarize the channel fields you are about to apply. If credentials, platform, target agent, or connection details are missing, ask a short clarifying question. Never invent secrets.',
  '你是 Suora 的渠道编排助手。你的职责是在渠道模块中创建、检查、更新或删除已保存的渠道集成。需要时使用 channel_list、channel_add、channel_update 和 channel_remove。在执行任何增删改之前，先简要总结你将要应用的渠道字段。如果凭据、平台、目标 Agent 或连接细节缺失，先提出一个简短的澄清问题。不要编造密钥。',
]

function buildDefaultAgent(): Agent {
  return {
    id: 'default-assistant',
    name: t('chat.assistant', 'Assistant'),
    avatar: 'agent-robot',
    color: '#6366F1',
    whenToUse: t('agents.defaultAssistantWhenToUse', 'General-purpose tasks, Q&A, and any task not better suited for a specialized agent'),
    systemPrompt: t(
      'agents.defaultAssistantSystemPrompt',
      'You are a helpful, friendly, and knowledgeable AI assistant with access to all available tools and skills. You can help with a wide range of tasks including answering questions, writing, coding, analysis, file operations, sending emails, reading webpages by URL, running shell commands, managing timers, git operations, and much more. Proactively use the most appropriate tool for each task. When a task can benefit from a tool, use it without hesitation. Be clear and concise in your responses. When you are unsure, say so honestly. If the user speaks in Chinese, reply in Chinese; otherwise match the user\'s language.',
    ),
    modelId: '',
    skills: [],
    temperature: 0.7,
    maxTokens: 4096,
    maxTurns: 30,
    enabled: true,
    greeting: t('chat.defaultAssistantGreeting', 'Hi! I\'m your Suora. How can I help you today?'),
    responseStyle: 'balanced',
    allowedTools: [],
    disallowedTools: [],
    memories: [],
    autoLearn: true,
  }
}

function shouldRefreshBuiltinField(value: string | undefined, legacyValues: string[]) {
  return !value || legacyValues.includes(value)
}

function localizeBuiltinAgent(agent: Agent): Agent {
  if (agent.id === 'default-assistant') {
    const localized = buildDefaultAgent()
    return {
      ...localized,
      ...agent,
      name: shouldRefreshBuiltinField(agent.name, LEGACY_DEFAULT_AGENT_NAME) ? localized.name : agent.name,
      whenToUse: shouldRefreshBuiltinField(agent.whenToUse, LEGACY_DEFAULT_AGENT_WHEN_TO_USE) ? localized.whenToUse : agent.whenToUse,
      systemPrompt: shouldRefreshBuiltinField(agent.systemPrompt, LEGACY_DEFAULT_AGENT_SYSTEM_PROMPT) ? localized.systemPrompt : agent.systemPrompt,
      greeting: shouldRefreshBuiltinField(agent.greeting, LEGACY_DEFAULT_AGENT_GREETING) ? localized.greeting : agent.greeting,
    }
  }

  if (agent.id === PIPELINE_BUILDER_AGENT_ID) {
    const localized = buildPipelineBuilderAgent()
    return {
      ...localized,
      ...agent,
      name: shouldRefreshBuiltinField(agent.name, LEGACY_PIPELINE_BUILDER_AGENT_NAME) ? localized.name : agent.name,
      whenToUse: shouldRefreshBuiltinField(agent.whenToUse, LEGACY_PIPELINE_BUILDER_AGENT_WHEN_TO_USE) ? localized.whenToUse : agent.whenToUse,
      systemPrompt: shouldRefreshBuiltinField(agent.systemPrompt, LEGACY_PIPELINE_BUILDER_AGENT_SYSTEM_PROMPT) ? localized.systemPrompt : agent.systemPrompt,
      greeting: shouldRefreshBuiltinField(agent.greeting, LEGACY_PIPELINE_BUILDER_AGENT_GREETING) ? localized.greeting : agent.greeting,
    }
  }

  if (agent.id === AGENT_BUILDER_AGENT_ID) {
    const localized = buildAgentBuilderAgent()
    return {
      ...localized,
      ...agent,
      name: shouldRefreshBuiltinField(agent.name, LEGACY_AGENT_BUILDER_AGENT_NAME) ? localized.name : agent.name,
      whenToUse: shouldRefreshBuiltinField(agent.whenToUse, LEGACY_AGENT_BUILDER_AGENT_WHEN_TO_USE) ? localized.whenToUse : agent.whenToUse,
      systemPrompt: shouldRefreshBuiltinField(agent.systemPrompt, LEGACY_AGENT_BUILDER_AGENT_SYSTEM_PROMPT) ? localized.systemPrompt : agent.systemPrompt,
      greeting: shouldRefreshBuiltinField(agent.greeting, LEGACY_AGENT_BUILDER_AGENT_GREETING) ? localized.greeting : agent.greeting,
    }
  }

  if (agent.id === TIMER_BUILDER_AGENT_ID) {
    const localized = buildTimerBuilderAgent()
    return {
      ...localized,
      ...agent,
      name: shouldRefreshBuiltinField(agent.name, LEGACY_TIMER_BUILDER_AGENT_NAME) ? localized.name : agent.name,
      whenToUse: shouldRefreshBuiltinField(agent.whenToUse, LEGACY_TIMER_BUILDER_AGENT_WHEN_TO_USE) ? localized.whenToUse : agent.whenToUse,
      systemPrompt: shouldRefreshBuiltinField(agent.systemPrompt, LEGACY_TIMER_BUILDER_AGENT_SYSTEM_PROMPT) ? localized.systemPrompt : agent.systemPrompt,
      greeting: shouldRefreshBuiltinField(agent.greeting, LEGACY_TIMER_BUILDER_AGENT_GREETING) ? localized.greeting : agent.greeting,
    }
  }

  if (agent.id === DOCUMENT_EDITOR_AGENT_ID) {
    const localized = buildDocumentEditorAgent()
    return {
      ...localized,
      ...agent,
      name: shouldRefreshBuiltinField(agent.name, LEGACY_DOCUMENT_EDITOR_AGENT_NAME) ? localized.name : agent.name,
      whenToUse: shouldRefreshBuiltinField(agent.whenToUse, LEGACY_DOCUMENT_EDITOR_AGENT_WHEN_TO_USE) ? localized.whenToUse : agent.whenToUse,
      systemPrompt: shouldRefreshBuiltinField(agent.systemPrompt, LEGACY_DOCUMENT_EDITOR_AGENT_SYSTEM_PROMPT) ? localized.systemPrompt : agent.systemPrompt,
      greeting: shouldRefreshBuiltinField(agent.greeting, LEGACY_DOCUMENT_EDITOR_AGENT_GREETING) ? localized.greeting : agent.greeting,
    }
  }

  if (agent.id === CHANNEL_BUILDER_AGENT_ID) {
    const localized = buildChannelBuilderAgent()
    return {
      ...localized,
      ...agent,
      name: shouldRefreshBuiltinField(agent.name, LEGACY_CHANNEL_BUILDER_AGENT_NAME) ? localized.name : agent.name,
      whenToUse: shouldRefreshBuiltinField(agent.whenToUse, LEGACY_CHANNEL_BUILDER_AGENT_WHEN_TO_USE) ? localized.whenToUse : agent.whenToUse,
      systemPrompt: shouldRefreshBuiltinField(agent.systemPrompt, LEGACY_CHANNEL_BUILDER_AGENT_SYSTEM_PROMPT) ? localized.systemPrompt : agent.systemPrompt,
      greeting: shouldRefreshBuiltinField(agent.greeting, LEGACY_CHANNEL_BUILDER_AGENT_GREETING) ? localized.greeting : agent.greeting,
    }
  }

  return agent
}

const DEFAULT_AGENT: Agent = buildDefaultAgent()

function buildAgentBuilderAgent(): Agent {
  return {
    ...buildProfessionalAgent(
      AGENT_BUILDER_AGENT_ID,
      t('agents.agentBuilder', 'Agent builder'),
      'agent-robot',
      '#7C3AED',
      t('agents.agentBuilderWhenToUse', 'Use inside the Agents module to turn natural-language requirements into saved agent profiles, update existing agents, and keep the work focused on agent configuration instead of completing the end task directly.'),
      t('agents.agentBuilderSystemPrompt', 'You are Suora\'s agent builder. Your job is to create, inspect, update, or remove saved agents inside the Agents module. Do not complete the user\'s requested business task directly. Instead, translate the request into a structured saved agent profile and use agent_list, agent_add, agent_update, and agent_remove when needed. If the exact model id or skill id is unclear, use list_models or list_skills first. Before any mutation, briefly summarize the agent fields you are about to apply. If required details are missing, ask a short clarifying question. Keep the resulting agent practical: choose a clear system prompt, only add tool restrictions when they materially improve safety, and prefer the simplest configuration that satisfies the request.'),
      [],
      'acceptEdits',
      0.25,
    ),
    allowedTools: ['agent_list', 'agent_add', 'agent_update', 'agent_remove', 'list_models', 'list_skills'],
    greeting: t('agents.agentBuilderGreeting', 'Ready to build agents.'),
  }
}

const AGENT_BUILDER_AGENT: Agent = buildAgentBuilderAgent()

function buildPipelineBuilderAgent(): Agent {
  return {
    ...buildProfessionalAgent(
      PIPELINE_BUILDER_AGENT_ID,
      t('agents.pipelineBuilder', 'Pipeline builder'),
      'agent-devops',
      '#0F766E',
      t('agents.pipelineBuilderWhenToUse', 'Use inside the Pipeline module to convert natural-language requirements into saved pipelines, update existing pipelines, and keep the work focused on pipeline structure instead of completing the end task directly.'),
      t('agents.pipelineBuilderSystemPrompt', 'You are Suora\'s pipeline builder. Your job is to create, inspect, update, or remove saved pipelines inside the Pipeline module. Do not complete the user\'s requested business task directly. Instead, translate the request into a structured saved pipeline and use pipeline_list, pipeline_add, pipeline_update, and pipeline_remove when needed. Before any mutation, briefly summarize the pipeline fields you are about to apply. If required details are missing, ask a short clarifying question. Prefer existing enabled agents for steps, and only add variables, retries, timeouts, or budgets when they materially improve the pipeline.'),
      [],
      'acceptEdits',
      0.2,
    ),
    allowedTools: ['pipeline_list', 'pipeline_add', 'pipeline_update', 'pipeline_remove'],
    greeting: t('agents.pipelineBuilderGreeting', 'Ready to build pipelines.'),
  }
}

const PIPELINE_BUILDER_AGENT: Agent = buildPipelineBuilderAgent()

function buildTimerBuilderAgent(): Agent {
  return {
    ...buildProfessionalAgent(
      TIMER_BUILDER_AGENT_ID,
      t('agents.timerBuilder', 'Timer builder'),
      'agent-devops',
      '#F97316',
      t('agents.timerBuilderWhenToUse', 'Use inside the Timer module to turn natural-language scheduling requests into saved timers, update existing timers, and keep the work focused on timer structure instead of completing the end task directly.'),
      t('agents.timerBuilderSystemPrompt', 'You are Suora\'s timer builder. Your job is to create, inspect, update, or remove saved timers inside the Timer module. Do not complete the user\'s requested business task directly. Instead, translate the request into a structured saved timer and use timer_list, timer_add, timer_update, and timer_remove when needed. If the timer should run a saved pipeline and the pipeline id is unclear, use pipeline_list to identify it first. Before any mutation, briefly summarize the timer fields you are about to apply. If required details are missing, ask a short clarifying question. Prefer the simplest timer shape that satisfies the request.'),
      [],
      'acceptEdits',
      0.2,
    ),
    allowedTools: ['timer_list', 'timer_add', 'timer_update', 'timer_remove', 'pipeline_list'],
    greeting: t('agents.timerBuilderGreeting', 'Ready to build timers.'),
  }
}

const TIMER_BUILDER_AGENT: Agent = buildTimerBuilderAgent()

function buildDocumentEditorAgent(): Agent {
  return {
    ...buildProfessionalAgent(
      DOCUMENT_EDITOR_AGENT_ID,
      t('agents.documentEditor', 'Document editor'),
      'agent-writer',
      '#2563EB',
      t('agents.documentEditorWhenToUse', 'Use inside the Documents module to create new documents, rewrite existing ones, and keep the work focused on saved document content instead of only replying in chat.'),
      t('agents.documentEditorSystemPrompt', 'You are Suora\'s document editor. Your job is to create and revise saved documents inside the Documents module. When the user wants a result saved as a document, do not stop at a chat reply. Use list_documents and read_document to inspect existing notes, then use create_document or update_document to write the requested content into the workspace. Before any mutation, briefly summarize the document title, location, and content changes you plan to apply. If the target document or destination is unclear, ask a short clarifying question.'),
      [],
      'acceptEdits',
      0.35,
    ),
    allowedTools: ['list_documents', 'read_document', 'create_document', 'update_document'],
    greeting: t('agents.documentEditorGreeting', 'Ready to edit documents.'),
  }
}

const DOCUMENT_EDITOR_AGENT: Agent = buildDocumentEditorAgent()

function buildChannelBuilderAgent(): Agent {
  return {
    ...buildProfessionalAgent(
      CHANNEL_BUILDER_AGENT_ID,
      t('agents.channelBuilder', 'Channel builder'),
      'agent-robot',
      '#0891B2',
      t('agents.channelBuilderWhenToUse', 'Use inside the Channels module to create, inspect, update, or remove channel integrations and keep the work focused on channel configuration.'),
      t('agents.channelBuilderSystemPrompt', 'You are Suora\'s channel builder. Your job is to create, inspect, update, or remove saved channel integrations inside the Channels module. Use channel_list, channel_add, channel_update, and channel_remove when needed. Before any mutation, briefly summarize the channel fields you are about to apply. If credentials, platform, target agent, or connection details are missing, ask a short clarifying question. Never invent secrets.'),
      [],
      'acceptEdits',
      0.25,
    ),
    allowedTools: ['channel_list', 'channel_add', 'channel_update', 'channel_remove', 'agent_list'],
    greeting: t('agents.channelBuilderGreeting', 'Ready to build channels.'),
  }
}

const CHANNEL_BUILDER_AGENT: Agent = buildChannelBuilderAgent()

function buildProfessionalAgent(
  id: string,
  name: string,
  avatar: string,
  color: string,
  whenToUse: string,
  systemPrompt: string,
  skills: string[],
  permissionMode: Agent['permissionMode'] = 'default',
  temperature = 0.5,
): Agent {
  return {
    id,
    name,
    avatar,
    color,
    whenToUse,
    systemPrompt,
    modelId: '',
    skills,
    temperature,
    maxTokens: 4096,
    maxTurns: permissionMode === 'plan' ? 12 : 24,
    enabled: true,
    greeting: `Ready for ${name.toLowerCase()} work.`,
    responseStyle: 'balanced',
    allowedTools: [],
    disallowedTools: [],
    permissionMode,
    memories: [],
    autoLearn: true,
  }
}

// ─── All builtin agents ────────────────────────────────────────────

const BUILTIN_AGENTS: Agent[] = [
  DEFAULT_AGENT,
  AGENT_BUILDER_AGENT,
  PIPELINE_BUILDER_AGENT,
  TIMER_BUILDER_AGENT,
  DOCUMENT_EDITOR_AGENT,
  CHANNEL_BUILDER_AGENT,
  buildProfessionalAgent(
    'builtin-code-expert',
    'Code Expert',
    'agent-developer',
    '#22C55E',
    'Use for coding, debugging, refactoring, TypeScript, React, Electron, tests, builds, and pull-request implementation work.',
    'You are a senior software engineer. Diagnose code precisely, prefer minimal safe changes, keep tests meaningful, and explain tradeoffs clearly.',
    ['builtin-filesystem', 'builtin-shell', 'builtin-git', 'builtin-code-analysis'],
    'acceptEdits',
    0.35,
  ),
  buildProfessionalAgent(
    'builtin-writer',
    'Writing Strategist',
    'agent-writer',
    '#F59E0B',
    'Use for drafting, rewriting, summarizing, documentation, email, product copy, and narrative structure.',
    'You are an expert writing strategist. Produce clear, audience-aware writing with strong structure, concise edits, and a polished voice.',
    ['builtin-filesystem', 'builtin-web', 'builtin-utilities'],
    'default',
    0.65,
  ),
  buildProfessionalAgent(
    'builtin-researcher',
    'Research Analyst',
    'agent-research',
    '#38BDF8',
    'Use for research, source comparison, market analysis, literature review, synthesis, and citation-heavy answers.',
    'You are a rigorous research analyst. Break questions into sub-questions, compare sources, cite provenance, and flag uncertainty.',
    ['builtin-web', 'builtin-memory', 'builtin-utilities'],
    'default',
    0.45,
  ),
  buildProfessionalAgent(
    'builtin-security-auditor',
    'Security Auditor',
    'agent-security',
    '#EF4444',
    'Use for threat modeling, vulnerability review, dependency risk, secrets, permissions, and secure implementation guidance.',
    'You are a pragmatic security auditor. Identify realistic risks, prioritize exploitability, recommend minimal mitigations, and avoid unsafe instructions.',
    ['builtin-filesystem', 'builtin-code-analysis', 'builtin-web'],
    'plan',
    0.25,
  ),
  buildProfessionalAgent(
    'builtin-data-analyst',
    'Data Analyst',
    'agent-database',
    '#A855F7',
    'Use for data analysis, SQL, spreadsheets, metrics, dashboards, experiment analysis, and statistical interpretation.',
    'You are a data analyst. Validate assumptions, explain methods, write clear queries, summarize findings, and call out data quality issues.',
    ['builtin-filesystem', 'builtin-shell', 'builtin-utilities', 'builtin-memory'],
    'default',
    0.4,
  ),
  buildProfessionalAgent(
    'builtin-devops-expert',
    'DevOps Expert',
    'agent-devops',
    '#14B8A6',
    'Use for CI/CD, deployment, Docker, infrastructure, observability, release automation, and operational troubleshooting.',
    'You are a DevOps expert. Design reliable automation, inspect failures from logs, minimize blast radius, and document rollback paths.',
    ['builtin-shell', 'builtin-filesystem', 'builtin-git', 'builtin-event-automation'],
    'acceptEdits',
    0.35,
  ),
]

function mergeBuiltinAgents(existingAgents: Agent[]): Agent[] {
  const existingIds = new Set(existingAgents.map((agent) => agent.id))
  return [
    ...existingAgents.map((agent) => localizeBuiltinAgent(normalizeAgent(agent))),
    ...BUILTIN_AGENTS.filter((agent) => !existingIds.has(agent.id)),
  ]
}

export interface AppStore {
  // Navigation
  activeModule: ActiveModule
  setActiveModule: (module: ActiveModule) => void

  // Sessions (Chat)
  sessions: Session[]
  activeSessionId: string | null
  openSessionTabs: string[]          // IDs of sessions open as tabs (multi-chat)
  addSession: (session: Session) => void
  updateSession: (id: string, data: Partial<Session>) => void
  removeSession: (id: string) => void
  setActiveSession: (id: string | null) => void
  openSessionTab: (id: string) => void
  closeSessionTab: (id: string) => void

  // Documents
  documentGroups: DocumentGroup[]
  documentNodes: DocumentNode[]
  selectedDocumentGroupId: string | null
  selectedDocumentId: string | null
  addDocumentGroup: (group: DocumentGroup) => void
  updateDocumentGroup: (id: string, data: Partial<DocumentGroup>) => void
  removeDocumentGroup: (id: string) => void
  setSelectedDocumentGroup: (id: string | null) => void
  addDocumentFolder: (folder: DocumentFolder) => void
  addDocument: (document: DocumentItem) => void
  updateDocumentNode: (id: string, data: Partial<DocumentNode>) => void
  removeDocumentNode: (id: string) => void
  setSelectedDocument: (id: string | null) => void

  // Models
  models: Model[]
  selectedModel: Model | null
  setSelectedModel: (model: Model | null) => void
  addModel: (model: Model) => void
  updateModel: (id: string, data: Partial<Model>) => void
  removeModel: (id: string) => void

  // Agents
  agents: Agent[]
  selectedAgent: Agent | null
  addAgent: (agent: Agent) => void
  updateAgent: (id: string, agent: Partial<Agent>) => void
  removeAgent: (id: string) => void
  setSelectedAgent: (agent: Agent | null) => void
  restoreAgentVersion: (versionId: string) => void
  addAgentMemory: (agentId: string, memory: AgentMemoryEntry) => void
  removeAgentMemory: (agentId: string, memoryId: string) => void
  clearAgentMemories: (agentId: string) => void

  // Global memories (cross-session, shared across all sessions)
  globalMemories: AgentMemoryEntry[]
  addGlobalMemory: (memory: AgentMemoryEntry) => void
  removeGlobalMemory: (memoryId: string) => void
  clearGlobalMemories: () => void

  // Skills
  skills: Skill[]
  addSkill: (skill: Skill) => void
  updateSkill: (id: string, skill: Partial<Skill>) => void
  removeSkill: (id: string) => void

  // Provider Configurations (dynamic, multi-model per provider)
  providerConfigs: ProviderConfig[]
  addProviderConfig: (config: ProviderConfig) => void
  updateProviderConfig: (id: string, config: Partial<ProviderConfig>) => void
  removeProviderConfig: (id: string) => void
  setProviderConfigs: (configs: ProviderConfig[]) => void
  syncModelsFromConfigs: () => void

  // External Directories
  externalDirectories: ExternalDirectoryConfig[]
  addExternalDirectory: (dir: ExternalDirectoryConfig) => void
  updateExternalDirectory: (path: string, data: Partial<ExternalDirectoryConfig>) => void
  removeExternalDirectory: (path: string) => void

  // Channels (WeChat, Feishu, DingTalk)
  channels: ChannelConfig[]
  addChannel: (channel: ChannelConfig) => void
  updateChannel: (id: string, data: Partial<ChannelConfig>) => void
  removeChannel: (id: string) => void
  setChannels: (channels: ChannelConfig[]) => void

  // Settings
  workspacePath: string
  setWorkspacePath: (path: string) => void
  apiKeys: Record<string, string>
  setApiKey: (provider: string, key: string) => void
  plugins: Record<string, unknown>
  setPlugin: (name: string, config: unknown) => void
  toolSecurity: ToolSecuritySettings
  setToolSecurity: (data: Partial<ToolSecuritySettings>) => void
  marketplace: MarketplaceSettings
  setMarketplace: (data: Partial<MarketplaceSettings>) => void
  theme: ThemeMode
  setTheme: (mode: ThemeMode) => void
  fontSize: FontSize
  setFontSize: (size: FontSize) => void
  codeFont: CodeFont
  setCodeFont: (font: CodeFont) => void
  bubbleStyle: BubbleStyle
  setBubbleStyle: (style: BubbleStyle) => void
  historyRetentionDays: number
  setHistoryRetentionDays: (days: number) => void
  autoSave: boolean
  setAutoSave: (enabled: boolean) => void
  accentColor: string
  setAccentColor: (color: string) => void
  shortcuts: Record<string, string>
  setShortcut: (action: string, shortcut: string) => void
  resetShortcuts: () => void

  // Notifications
  notifications: AppNotification[]
  addNotification: (notification: AppNotification) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void

  // Model Usage Stats
  modelUsageStats: Record<string, ModelUsageStats>
  recordModelUsage: (modelId: string, promptTokens: number, completionTokens: number, latencyMs?: number, isError?: boolean, error?: string, totalTokens?: number) => void
  clearModelUsageStats: () => void

  // Channel Message History
  channelMessages: ChannelHistoryMessage[]
  addChannelMessage: (msg: ChannelHistoryMessage) => void
  clearChannelMessages: (channelId?: string) => void

  // Channel Access Tokens
  channelTokens: Record<string, ChannelAccessToken>
  setChannelToken: (channelId: string, token: ChannelAccessToken) => void
  removeChannelToken: (channelId: string) => void

  // Channel Health
  channelHealth: Record<string, ChannelHealthStatus>
  setChannelHealth: (channelId: string, health: ChannelHealthStatus) => void

  // Channel Users (multi-user tracking per channel)
  channelUsers: Record<string, ChannelUser>  // key: `${channelId}:${senderId}`
  upsertChannelUser: (user: ChannelUser) => void
  removeChannelUser: (key: string) => void
  clearChannelUsers: (channelId?: string) => void

  // Plugin System
  installedPlugins: PluginInfo[]
  addInstalledPlugin: (plugin: PluginInfo) => void
  updateInstalledPlugin: (id: string, data: Partial<PluginInfo>) => void
  removeInstalledPlugin: (id: string) => void
  pluginTools: Record<string, string[]>  // pluginId → tool names registered
  setPluginTools: (pluginId: string, tools: string[]) => void
  removePluginTools: (pluginId: string) => void

  // MCP System
  mcpServers: MCPServerConfig[]
  addMcpServer: (server: MCPServerConfig) => void
  updateMcpServer: (id: string, data: Partial<MCPServerConfig>) => void
  removeMcpServer: (id: string) => void
  setMcpServerStatus: (id: string, status: MCPServerStatus, error?: string) => void

  // Skill Version Management
  skillVersions: SkillVersion[]
  addSkillVersion: (version: SkillVersion) => void
  removeSkillVersions: (skillId: string) => void

  // Agent Version Management
  agentVersions: AgentVersion[]
  addAgentVersion: (version: AgentVersion) => void
  removeAgentVersions: (agentId: string) => void

  // Agent Performance Stats
  agentPerformance: Record<string, AgentPerformanceStats>
  recordAgentPerformance: (agentId: string, responseTimeMs: number, tokens: number, isError?: boolean) => void
  clearAgentPerformance: () => void
  agentSelectionPreferences: AgentSelectionPreference[]
  recordAgentSelectionPreference: (agentId: string, taskText: string) => void

  // Agent Orchestration Pipeline Draft
  agentPipeline: AgentPipelineStep[]
  setAgentPipeline: (pipeline: AgentPipelineStep[]) => void
  clearAgentPipeline: () => void
  agentPipelineName: string
  setAgentPipelineName: (name: string) => void
  selectedAgentPipelineId: string | null
  setSelectedAgentPipelineId: (id: string | null) => void
  agentPipelines: AgentPipeline[]
  setAgentPipelines: (pipelines: AgentPipeline[]) => void
  addAgentPipeline: (pipeline: AgentPipeline) => void
  updateAgentPipeline: (id: string, pipeline: Partial<AgentPipeline>) => void
  removeAgentPipeline: (id: string) => void

  // i18n
  locale: AppLocale
  setLocale: (locale: AppLocale) => void

  // Proxy Settings
  proxySettings: ProxySettings
  setProxySettings: (settings: Partial<ProxySettings>) => void

  // Onboarding
  onboarding: OnboardingState
  setOnboarding: (data: Partial<OnboardingState>) => void

  // Email Configuration
  emailConfig: EmailConfig
  setEmailConfig: (data: Partial<EmailConfig>) => void

  // Environment Variables
  envVariables: EnvVariable[]
  addEnvVariable: (variable: EnvVariable) => void
  updateEnvVariable: (key: string, data: Partial<EnvVariable>) => void
  removeEnvVariable: (key: string) => void
  setEnvVariables: (variables: EnvVariable[]) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get, api) => ({
      ...createUIPreferencesSlice(set, get, api),
      ...createSessionSlice(set, get, api),
      ...createModelConfigSlice(set, get, api),

      // Documents
      documentGroups: [],
      documentNodes: [],
      selectedDocumentGroupId: null,
      selectedDocumentId: null,
      addDocumentGroup: (group) => set((state) => ({
        documentGroups: [group, ...state.documentGroups.filter((item) => item.id !== group.id)],
        selectedDocumentGroupId: group.id,
      })),
      updateDocumentGroup: (id, data) => set((state) => ({
        documentGroups: state.documentGroups.map((group) =>
          group.id === id ? { ...group, ...data, updatedAt: Date.now() } : group
        ),
      })),
      removeDocumentGroup: (id) => set((state) => {
        const remainingGroups = state.documentGroups.filter((group) => group.id !== id)
        const remainingNodes = state.documentNodes.filter((node) => node.groupId !== id)
        const selectedDocumentId = state.selectedDocumentId && remainingNodes.some((node) => node.id === state.selectedDocumentId)
          ? state.selectedDocumentId
          : null
        return {
          documentGroups: remainingGroups,
          documentNodes: remainingNodes,
          selectedDocumentGroupId: state.selectedDocumentGroupId === id ? (remainingGroups[0]?.id ?? null) : state.selectedDocumentGroupId,
          selectedDocumentId,
        }
      }),
      setSelectedDocumentGroup: (id) => set((state) => {
        const selectedDocumentId = state.selectedDocumentId && state.documentNodes.some((node) => node.id === state.selectedDocumentId && node.groupId === id)
          ? state.selectedDocumentId
          : null
        return { selectedDocumentGroupId: id, selectedDocumentId }
      }),
      addDocumentFolder: (folder) => set((state) => ({
        documentNodes: [...state.documentNodes.filter((item) => item.id !== folder.id), folder],
      })),
      addDocument: (document) => set((state) => ({
        documentNodes: [...state.documentNodes.filter((item) => item.id !== document.id), document],
        selectedDocumentGroupId: document.groupId,
        selectedDocumentId: document.id,
      })),
      updateDocumentNode: (id, data) => set((state) => ({
        documentNodes: state.documentNodes.map((node) =>
          node.id === id ? ({ ...node, ...data, updatedAt: Date.now() } as DocumentNode) : node
        ),
      })),
      removeDocumentNode: (id) => set((state) => {
        const collectIds = (targetId: string, ids = new Set<string>()) => {
          ids.add(targetId)
          for (const child of state.documentNodes.filter((node) => node.parentId === targetId)) {
            collectIds(child.id, ids)
          }
          return ids
        }
        const idsToRemove = collectIds(id)
        const remainingNodes = state.documentNodes.filter((node) => !idsToRemove.has(node.id))
        return {
          documentNodes: remainingNodes,
          selectedDocumentId: state.selectedDocumentId && idsToRemove.has(state.selectedDocumentId) ? null : state.selectedDocumentId,
        }
      }),
      setSelectedDocument: (id) => set({ selectedDocumentId: id }),

      // Agents (seeded with built-in agents)
      agents: [...BUILTIN_AGENTS],
      selectedAgent: null,
      addAgent: (agent) => set((state) => ({ agents: [...state.agents, normalizeAgent(agent)] })),
      updateAgent: (id, agent) => set((state) => {
        const normalizedPatch = normalizeAgentPatch(agent)
        const agents = state.agents.map((a) => (a.id === id ? normalizeAgent({ ...a, ...normalizedPatch }) : a))
        return {
          agents,
          selectedAgent: state.selectedAgent?.id === id
            ? agents.find((a) => a.id === id) ?? state.selectedAgent
            : state.selectedAgent,
        }
      }),
      restoreAgentVersion: (versionId) => set((state) => {
        const version = state.agentVersions.find((item) => item.id === versionId)
        if (!version) return state
        const current = state.agents.find((agent) => agent.id === version.agentId)
        const restored = normalizeAgent({ ...version.snapshot, memories: current?.memories ?? [] })
        const agents = current
          ? state.agents.map((agent) => agent.id === version.agentId ? restored : agent)
          : [...state.agents, restored]
        return {
          agents,
          selectedAgent: state.selectedAgent?.id === version.agentId ? restored : state.selectedAgent,
          agentVersions: [
            ...state.agentVersions,
            {
              id: `aver-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
              agentId: version.agentId,
              version: state.agentVersions.filter((item) => item.agentId === version.agentId).length + 1,
              snapshot: version.snapshot,
              createdAt: Date.now(),
              label: `Rollback to v${version.version}`,
              source: 'rollback' as const,
            },
          ].slice(-200),
        }
      }),
      removeAgent: (id) => {
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== id),
          selectedAgent: state.selectedAgent?.id === id ? null : state.selectedAgent,
          sessions: state.sessions.map((s) =>
            s.agentId === id ? { ...s, agentId: undefined } : s
          ),
        }))
      },
      setSelectedAgent: (agent) => set({ selectedAgent: agent ? normalizeAgent(agent) : null }),
      addAgentMemory: (agentId, memory) => set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId ? { ...a, memories: [...(a.memories || []), memory] } : a
        ),
      })),
      removeAgentMemory: (agentId, memoryId) => set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId
            ? { ...a, memories: (a.memories || []).filter((m) => m.id !== memoryId) }
            : a
        ),
      })),
      clearAgentMemories: (agentId) => set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId ? { ...a, memories: [] } : a
        ),
      })),

      // Global memories
      globalMemories: [],
      addGlobalMemory: (memory) => set((state) => ({
        globalMemories: [...state.globalMemories, memory],
      })),
      removeGlobalMemory: (memoryId) => set((state) => ({
        globalMemories: state.globalMemories.filter((m) => m.id !== memoryId),
      })),
      clearGlobalMemories: () => set({ globalMemories: [] }),

      // Skills (seeded with built-in skills)
      skills: [],
      addSkill: (skill) => set((state) => ({ skills: [...state.skills, skill] })),
      updateSkill: (id, skill) => set((state) => ({
        skills: state.skills.map((s) => (s.id === id ? { ...s, ...skill } : s)),
      })),
      removeSkill: (id) => set((state) => ({
        skills: state.skills.filter((s) => s.id !== id),
      })),

      // External Directories
      externalDirectories: [],
      addExternalDirectory: (dir) => set((state) => ({
        externalDirectories: normalizeExternalDirectoriesInStore([...state.externalDirectories, dir]),
      })),
      updateExternalDirectory: (path, data) => set((state) => ({
        externalDirectories: normalizeExternalDirectoriesInStore(
          state.externalDirectories.map((directory) =>
            normalizeExternalDirectoryPathInStore(directory.path) === normalizeExternalDirectoryPathInStore(path)
              ? { ...directory, ...data, path: normalizeExternalDirectoryPathInStore(path) }
              : directory,
          ),
        ),
      })),
      removeExternalDirectory: (path) => set((state) => ({
        externalDirectories: state.externalDirectories.filter(
          (directory) => normalizeExternalDirectoryPathInStore(directory.path) !== normalizeExternalDirectoryPathInStore(path),
        ),
      })),

      // Channels
      channels: [],
      addChannel: (channel) => set((state) => ({
        channels: [...state.channels, channel],
      })),
      updateChannel: (id, data) => set((state) => ({
        channels: state.channels.map((c) => (c.id === id ? { ...c, ...data } : c)),
      })),
      removeChannel: (id) => set((state) => ({
        channels: state.channels.filter((c) => c.id !== id),
      })),
      setChannels: (channels) => set({ channels }),

      // Notifications
      notifications: [],
      addNotification: (notification) => set((state) => ({
        notifications: [notification, ...state.notifications].slice(0, 100),
      })),
      markNotificationRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      })),
      markAllNotificationsRead: () => set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      })),
      clearNotifications: () => set({ notifications: [] }),

      // Model Usage Stats
      modelUsageStats: {},
      recordModelUsage: (modelId, promptTokens, completionTokens, latencyMs, isError, error, totalTokens) => set((state) => {
        const existing = state.modelUsageStats[modelId] ?? { modelId, callCount: 0, totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0, lastUsed: 0, errorCount: 0, latencies: [] }
        const latencies = Number.isFinite(latencyMs) ? [...(existing.latencies ?? []), latencyMs as number] : (existing.latencies ?? [])
        const retainedLatencies = latencies.length > 60 ? latencies.slice(-50) : latencies
        const avgLatencyMs = retainedLatencies.length ? Math.round(retainedLatencies.reduce((sum, value) => sum + value, 0) / retainedLatencies.length) : existing.avgLatencyMs
        const usageTotalTokens = Number.isFinite(totalTokens) ? totalTokens as number : promptTokens + completionTokens
        return {
          modelUsageStats: {
            ...state.modelUsageStats,
            [modelId]: {
              modelId,
              callCount: existing.callCount + 1,
              totalPromptTokens: existing.totalPromptTokens + promptTokens,
              totalCompletionTokens: existing.totalCompletionTokens + completionTokens,
              totalTokens: existing.totalTokens + usageTotalTokens,
              lastUsed: Date.now(),
              avgLatencyMs,
              latencies: retainedLatencies,
              errorCount: (existing.errorCount ?? 0) + (isError ? 1 : 0),
              lastError: error || existing.lastError,
            },
          },
        }
      }),
      clearModelUsageStats: () => set({ modelUsageStats: {} }),

      // Channel Message History
      channelMessages: [],
      addChannelMessage: (msg) => set((state) => ({
        channelMessages: [msg, ...state.channelMessages].slice(0, 500),
      })),
      clearChannelMessages: (channelId) => set((state) => ({
        channelMessages: channelId
          ? state.channelMessages.filter((m) => m.channelId !== channelId)
          : [],
      })),

      // Channel Access Tokens
      channelTokens: {},
      setChannelToken: (channelId, token) => set((state) => ({
        channelTokens: { ...state.channelTokens, [channelId]: token },
      })),
      removeChannelToken: (channelId) => set((state) => {
        const { [channelId]: _, ...rest } = state.channelTokens
        return { channelTokens: rest }
      }),

      // Channel Health
      channelHealth: {},
      setChannelHealth: (channelId, health) => set((state) => ({
        channelHealth: { ...state.channelHealth, [channelId]: health },
      })),

      // Channel Users (multi-user tracking)
      channelUsers: {},
      upsertChannelUser: (user) => set((state) => ({
        channelUsers: { ...state.channelUsers, [user.id]: user },
      })),
      removeChannelUser: (key) => set((state) => {
        const { [key]: _, ...rest } = state.channelUsers
        return { channelUsers: rest }
      }),
      clearChannelUsers: (channelId) => set((state) => ({
        channelUsers: channelId
          ? Object.fromEntries(Object.entries(state.channelUsers).filter(([, u]) => u.channelId !== channelId))
          : {},
      })),

      // Plugin System
      installedPlugins: [],
      addInstalledPlugin: (plugin) => set((state) => ({
        installedPlugins: [...state.installedPlugins, plugin],
      })),
      updateInstalledPlugin: (id, data) => set((state) => ({
        installedPlugins: state.installedPlugins.map((p) => p.id === id ? { ...p, ...data } : p),
      })),
      removeInstalledPlugin: (id) => set((state) => ({
        installedPlugins: state.installedPlugins.filter((p) => p.id !== id),
      })),
      pluginTools: {},
      setPluginTools: (pluginId, tools) => set((state) => ({
        pluginTools: { ...state.pluginTools, [pluginId]: tools },
      })),
      removePluginTools: (pluginId) => set((state) => {
        const { [pluginId]: _, ...rest } = state.pluginTools
        return { pluginTools: rest }
      }),

      // MCP System
      mcpServers: [],
      addMcpServer: (server) => set((state) => ({
        mcpServers: [...state.mcpServers, server],
      })),
      updateMcpServer: (id, data) => set((state) => ({
        mcpServers: state.mcpServers.map((s) => (s.id === id ? { ...s, ...data } : s)),
      })),
      removeMcpServer: (id) => set((state) => ({
        mcpServers: state.mcpServers.filter((s) => s.id !== id),
      })),
      setMcpServerStatus: (id, status, error) => set((state) => ({
        mcpServers: state.mcpServers.map((s) =>
          s.id === id
            ? {
                ...s,
                status,
                error: error || undefined,
                lastConnectedAt: status === 'connected' ? Date.now() : s.lastConnectedAt,
              }
            : s
        ),
      })),

      // Skill Version Management
      skillVersions: [],
      addSkillVersion: (version) => set((state) => ({
        skillVersions: [...state.skillVersions, version].slice(-500),
      })),
      removeSkillVersions: (skillId) => set((state) => ({
        skillVersions: state.skillVersions.filter((v) => v.skillId !== skillId),
      })),

      // Agent Version Management
      agentVersions: [],
      addAgentVersion: (version) => set((state) => ({
        agentVersions: [...state.agentVersions, version].slice(-200),
      })),
      removeAgentVersions: (agentId) => set((state) => ({
        agentVersions: state.agentVersions.filter((v) => v.agentId !== agentId),
      })),

      // Agent Performance Stats
      agentPerformance: {},
      recordAgentPerformance: (agentId, responseTimeMs, tokens, isError) => set((state) => {
        const existing = state.agentPerformance[agentId] ?? { agentId, totalCalls: 0, totalTokens: 0, avgResponseTimeMs: 0, responseTimes: [], lastUsed: 0, errorCount: 0 }
        const newTimes = [...existing.responseTimes, responseTimeMs].slice(-50)
        const newAvg = newTimes.reduce((a, b) => a + b, 0) / newTimes.length
        return {
          agentPerformance: {
            ...state.agentPerformance,
            [agentId]: {
              agentId,
              totalCalls: existing.totalCalls + 1,
              totalTokens: existing.totalTokens + tokens,
              avgResponseTimeMs: Math.round(newAvg),
              responseTimes: newTimes,
              lastUsed: Date.now(),
              errorCount: existing.errorCount + (isError ? 1 : 0),
            },
          },
        }
      }),
      clearAgentPerformance: () => set({ agentPerformance: {} }),
      agentSelectionPreferences: [],
      recordAgentSelectionPreference: (agentId, taskText) => set((state) => {
        const fingerprint = taskFingerprint(taskText)
        if (!fingerprint) return state
        const existing = state.agentSelectionPreferences.find((item) => item.agentId === agentId && item.taskFingerprint === fingerprint)
        const next = existing
          ? state.agentSelectionPreferences.map((item) => item === existing ? { ...item, selectedAt: Date.now(), count: item.count + 1 } : item)
          : [{ agentId, taskFingerprint: fingerprint, selectedAt: Date.now(), count: 1 }, ...state.agentSelectionPreferences]
        return { agentSelectionPreferences: next.slice(0, 200) }
      }),

      // Agent Orchestration Pipeline Draft
      agentPipeline: [],
      setAgentPipeline: (agentPipeline) => set({ agentPipeline }),
      clearAgentPipeline: () => set({ agentPipeline: [] }),
      agentPipelineName: '',
      setAgentPipelineName: (agentPipelineName) => set({ agentPipelineName }),
      selectedAgentPipelineId: null,
      setSelectedAgentPipelineId: (selectedAgentPipelineId) => set({ selectedAgentPipelineId }),
      agentPipelines: [],
      setAgentPipelines: (agentPipelines) => set({ agentPipelines }),
      addAgentPipeline: (pipeline) => set((state) => ({
        agentPipelines: [pipeline, ...state.agentPipelines.filter((item) => item.id !== pipeline.id)],
      })),
      updateAgentPipeline: (id, pipeline) => set((state) => ({
        agentPipelines: state.agentPipelines.map((item) => item.id === id ? { ...item, ...pipeline } : item),
      })),
      removeAgentPipeline: (id) => set((state) => ({
        agentPipelines: state.agentPipelines.filter((item) => item.id !== id),
        selectedAgentPipelineId: state.selectedAgentPipelineId === id ? null : state.selectedAgentPipelineId,
      })),

      // i18n
      locale: 'en' as AppLocale,
      setLocale: (locale) => {
        const nextLocale = normalizeAppLocale(locale)
        setI18nLocale(nextLocale)
        set((state) => {
          const agents = state.agents.map((agent) => localizeBuiltinAgent(normalizeAgent(agent)))
          const selectedAgent = state.selectedAgent
            ? agents.find((agent) => agent.id === state.selectedAgent?.id) ?? localizeBuiltinAgent(normalizeAgent(state.selectedAgent))
            : null
          return { locale: nextLocale, agents, selectedAgent }
        })
      },

      // Proxy Settings
      proxySettings: { enabled: false, type: 'http', host: '', port: 0 } as ProxySettings,
      setProxySettings: (settings) => set((state) => ({
        proxySettings: { ...state.proxySettings, ...settings },
      })),

      // Onboarding
      onboarding: { completed: false, currentStep: 0, skipped: false } as OnboardingState,
      setOnboarding: (data) => set((state) => ({
        onboarding: { ...state.onboarding, ...data },
      })),

      // Email Configuration
      emailConfig: {
        smtpHost: '',
        smtpPort: 587,
        secure: false,
        username: '',
        password: '',
        fromName: '',
        fromAddress: '',
        enabled: false,
      } as EmailConfig,
      setEmailConfig: (data) => set((state) => ({
        emailConfig: { ...state.emailConfig, ...data },
      })),

      // Environment Variables
      envVariables: [] as EnvVariable[],
      addEnvVariable: (variable) => set((state) => {
        if (state.envVariables.some((v) => v.key === variable.key)) return state
        return { envVariables: [...state.envVariables, variable] }
      }),
      updateEnvVariable: (key, data) => set((state) => ({
        envVariables: state.envVariables.map((v) =>
          v.key === key ? { ...v, ...data, updatedAt: Date.now() } : v
        ),
      })),
      removeEnvVariable: (key) => set((state) => ({
        envVariables: state.envVariables.filter((v) => v.key !== key),
      })),
      setEnvVariables: (variables) => set({ envVariables: variables }),
    }),
    {
      name: 'suora-store',
      version: 22,
      storage: createSafePersistStorage<Record<string, unknown>>(fileStateStorage),
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>
        if (version < 2) {
          // Backfill new Agent fields
          state.agents = ((state.agents || []) as Agent[]).map((a) => ({
            ...a,
            memories: a.memories || [],
            autoLearn: a.autoLearn ?? false,
          }))
          // Backfill new Skill fields
          state.skills = ((state.skills || []) as Skill[]).map((s) => ({
            ...s,
            tools: s.tools || [],
          }))
        }
        if (version < 3) {
          state.toolSecurity = {
            allowedDirectories: [],
            blockedCommands: ['rm -rf', 'del /f /q', 'format', 'shutdown'],
            requireConfirmation: false,
          }
        }
        if (version < 4) {
          state.marketplace = {
            source: 'official',
            privateUrl: '',
          }
        }
        if (version < 5) {
          state.workspacePath = state.workspacePath || ''
        }
        if (version < 7) {
          // Migrate old providerConfigs (Record<string, {apiKey, baseUrl, enabledModels}>) to new ProviderConfig[]
          const oldConfigs = (state.providerConfigs || {}) as Record<string, { apiKey?: string; baseUrl?: string; enabledModels?: string[] }>
          const newConfigs: ProviderConfig[] = []
          const providerTypeMap: Record<string, ProviderConfig['providerType']> = {
            anthropic: 'anthropic',
            openai: 'openai',
            google: 'google',
            ollama: 'ollama',
          }
          if (oldConfigs && typeof oldConfigs === 'object' && !Array.isArray(oldConfigs)) {
            for (const [key, cfg] of Object.entries(oldConfigs)) {
              if (!cfg) continue
              newConfigs.push({
                id: key,
                name: key.charAt(0).toUpperCase() + key.slice(1),
                apiKey: cfg.apiKey || '',
                baseUrl: cfg.baseUrl || '',
                providerType: providerTypeMap[key] || 'openai-compatible',
                models: (cfg.enabledModels || []).map((mid: string) => ({ modelId: mid, name: mid, enabled: true })),
              })
            }
          }
          // Also migrate old customModels
          const oldCustom = (state.customModels || []) as Array<{ provider?: string; modelId?: string; name?: string; apiKey?: string; baseUrl?: string }>
          for (const cm of oldCustom) {
            if (!cm.modelId) continue
            newConfigs.push({
              id: `custom-${cm.modelId}`,
              name: cm.name || cm.modelId,
              apiKey: cm.apiKey || '',
              baseUrl: cm.baseUrl || '',
              providerType: 'openai-compatible',
              models: [{ modelId: cm.modelId, name: cm.name || cm.modelId, enabled: true }],
            })
          }
          state.providerConfigs = newConfigs
          delete state.customModels
        }
        if (version < 8) {
          // Default to no confirmation popups for tool execution
          const sec = state.toolSecurity as { requireConfirmation?: boolean } | undefined
          if (sec) sec.requireConfirmation = false
        }
        if (version < 9) {
          // Add globalMemories array and backfill scope on existing agent memories
          if (!state.globalMemories) state.globalMemories = []
          state.agents = ((state.agents || []) as Agent[]).map((a) => ({
            ...a,
            memories: (a.memories || []).map((m) => ({
              ...m,
              scope: 'session' as const,
            })),
          }))
        }
        if (version < 10) {
          if (!state.channelMessages) state.channelMessages = []
          if (!state.channelTokens) state.channelTokens = {}
          if (!state.channelHealth) state.channelHealth = {}
          if (!state.installedPlugins) state.installedPlugins = []
          if (!state.agentVersions) state.agentVersions = []
          if (!state.agentPerformance) state.agentPerformance = {}
          if (!state.locale) state.locale = 'en'
          if (!state.proxySettings) state.proxySettings = { enabled: false, type: 'http', host: '', port: 0 }
          if (!state.onboarding) state.onboarding = { completed: false, currentStep: 0, skipped: false }
        }
        if (version < 11) {
          if (!state.pluginTools) state.pluginTools = {}
          if (!state.skillVersions) state.skillVersions = []
        }
        if (version < 12) {
          if (!state.emailConfig) state.emailConfig = {
            smtpHost: '', smtpPort: 587, secure: false,
            username: '', password: '', fromName: '', fromAddress: '', enabled: false,
          }
        }
        if (version < 13) {
          if (!state.channelUsers) state.channelUsers = {}
        }
        if (version < 14) {
          // No structural migration needed — new ChannelPlatform values ('wechat_official',
          // 'wechat_miniprogram', 'custom') and optional ChannelConfig fields are additive.
          // Existing channels continue to work as before.
        }
        if (version < 15) {
          if (!state.mcpServers) state.mcpServers = []
        }
        if (version < 16) {
          if (!state.agentPipeline) state.agentPipeline = []
        }
        if (version < 17) {
          if (!state.agentPipelineName) state.agentPipelineName = ''
          if (!('selectedAgentPipelineId' in state)) state.selectedAgentPipelineId = null
          if (!state.agentPipelines) state.agentPipelines = []
        }
        if (version < 18) {
          if (!state.sessions) state.sessions = []
        }
        if (version < 19) {
          if (!state.documentGroups) state.documentGroups = []
          if (!state.documentNodes) state.documentNodes = []
          if (!('selectedDocumentGroupId' in state)) state.selectedDocumentGroupId = null
          if (!('selectedDocumentId' in state)) state.selectedDocumentId = null
        }
        if (version < 20) {
          state.agents = mergeBuiltinAgents((state.agents || []) as Agent[])
          if (!state.agentSelectionPreferences)           state.agentSelectionPreferences = []
        }
        if (version < 22) {
          state.sessions = ((state.sessions || []) as Session[]).map((session) => ({
            ...session,
            memories: session.memories || [],
          }))
          state.agents = ((state.agents || []) as Agent[]).map((agent) => ({
            ...agent,
            memories: (agent.memories || []).map((memory) => ({
              ...memory,
              scope: memory.scope === 'global' ? 'global' as const : 'agent' as const,
              targetId: memory.targetId ?? agent.id,
            })),
          }))
          state.skills = ((state.skills || []) as Skill[]).map((skill) => ({
            ...skill,
            memories: skill.memories || [],
          }))
        }
        if (version < 21) {
          const sec = state.toolSecurity as Partial<ToolSecuritySettings> | undefined
          state.toolSecurity = normalizeToolSecuritySettings({
            ...sec,
            sandboxMode: sec?.sandboxMode ?? (sec?.requireConfirmation === false ? 'relaxed' : 'workspace'),
          })
        }
        return state as Record<string, unknown>
      },
      merge: (persisted, current) => {
        const merged = { ...(current as object), ...(persisted as object) } as AppStore
        const nextLocale = normalizeAppLocale(typeof merged.locale === 'string' ? merged.locale : current.locale)
        merged.locale = nextLocale
        setI18nLocale(nextLocale)
        // Filter out legacy builtin skills from persisted state
        merged.skills = merged.skills.filter((s) => s.type !== 'builtin')
        merged.agents = mergeBuiltinAgents(merged.agents)
        const localizedDefaultAgent = buildDefaultAgent()

        // Ensure default agent always present
        if (!merged.agents.some((a) => a.id === localizedDefaultAgent.id)) {
          merged.agents = [localizedDefaultAgent, ...merged.agents]
          // Auto-select if nothing selected
          if (!merged.selectedAgent) {
            merged.selectedAgent = localizedDefaultAgent
          }
        }

        if (merged.selectedAgent) {
          merged.selectedAgent = merged.agents.find((a) => a.id === merged.selectedAgent?.id)
            ?? normalizeAgent(merged.selectedAgent)
        }

        if (!merged.agentPipelines) {
          merged.agentPipelines = []
        }
        if (!merged.documentGroups) {
          merged.documentGroups = []
        }
        if (!merged.documentNodes) {
          merged.documentNodes = []
        }
        if (!merged.agentSelectionPreferences) {
          merged.agentSelectionPreferences = []
        }
        merged.externalDirectories = normalizeExternalDirectoriesInStore(merged.externalDirectories ?? [])
        merged.toolSecurity = normalizeToolSecuritySettings(merged.toolSecurity)

        return merged
      },
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        openSessionTabs: state.openSessionTabs,
        documentGroups: state.documentGroups,
        documentNodes: state.documentNodes,
        selectedDocumentGroupId: state.selectedDocumentGroupId,
        selectedDocumentId: state.selectedDocumentId,
        models: state.models,
        selectedModel: state.selectedModel,
        agents: state.agents,
        selectedAgent: state.selectedAgent,
        skills: state.skills,
        workspacePath: state.workspacePath,
        providerConfigs: state.providerConfigs,
        externalDirectories: state.externalDirectories,
        channels: state.channels,
        apiKeys: state.apiKeys,
        plugins: state.plugins,
        toolSecurity: state.toolSecurity,
        marketplace: state.marketplace,
        theme: state.theme,
        fontSize: state.fontSize,
        globalMemories: state.globalMemories,
        channelMessages: state.channelMessages,
        channelTokens: state.channelTokens,
        installedPlugins: state.installedPlugins,
        agentVersions: state.agentVersions,
        agentPerformance: state.agentPerformance,
        agentSelectionPreferences: state.agentSelectionPreferences,
        agentPipeline: state.agentPipeline,
        agentPipelineName: state.agentPipelineName,
        selectedAgentPipelineId: state.selectedAgentPipelineId,
        agentPipelines: state.agentPipelines,
        locale: state.locale,
        proxySettings: state.proxySettings,
        onboarding: state.onboarding,
        pluginTools: state.pluginTools,
        mcpServers: state.mcpServers,
        codeFont: state.codeFont,
        bubbleStyle: state.bubbleStyle,
        historyRetentionDays: state.historyRetentionDays,
        autoSave: state.autoSave,
        accentColor: state.accentColor,
        shortcuts: state.shortcuts,
        channelHealth: state.channelHealth,
        channelUsers: state.channelUsers,
        notifications: state.notifications,
        modelUsageStats: state.modelUsageStats,
        emailConfig: state.emailConfig,
        envVariables: state.envVariables,
      }),
    }
  )
)

// Register live store accessor so tools.ts reads fresh state (not stale file cache)
setLiveStoreAccessor(() => useAppStore.getState() as unknown as Record<string, unknown>)
setPluginLiveStoreAccessor(() => useAppStore.getState() as unknown as Record<string, unknown>)
setVectorMemoryLiveStoreAccessor(() => useAppStore.getState() as unknown as Record<string, unknown>)
setLiveStoreWriter((updater) => {
  useAppStore.setState((state) => {
    const next = { ...(state as unknown as Record<string, unknown>) }
    updater(next)
    return next as Partial<AppStore>
  })
})

// ─── Standalone async helpers (avoid circular ref in store init) ───

export async function waitForStoreHydration(): Promise<void> {
  if (useAppStore.persist.hasHydrated()) return
  await new Promise<void>((resolve) => {
    const unsubscribe = useAppStore.persist.onFinishHydration(() => {
      unsubscribe()
      resolve()
    })
  })
}

export async function initWorkspacePath(): Promise<string> {
  const state = useAppStore.getState()
  if (state.workspacePath) {
    // Notify main process so fs:* path enforcement is active
    const electron = (window as unknown as { electron?: { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> } }).electron
    if (electron) electron.invoke('workspace:init', state.workspacePath).catch(() => {})
    syncToolSecurityToElectron(state.toolSecurity)
    return state.workspacePath
  }
  const electron = (window as unknown as { electron?: { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> } }).electron
  if (!electron) return ''
  const bootConfig = (await electron.invoke('workspace:getBootConfig')) as { workspacePath?: string }
  const initialPath = typeof bootConfig?.workspacePath === 'string' && bootConfig.workspacePath.trim()
    ? bootConfig.workspacePath
    : (await electron.invoke('system:getDefaultWorkspacePath')) as string
  useAppStore.setState({ workspacePath: initialPath })
  // Notify main process so fs:* path enforcement is active
  await electron.invoke('workspace:init', initialPath).catch(() => {})
  syncToolSecurityToElectron(useAppStore.getState().toolSecurity)
  return initialPath
}

export async function loadSessionsFromWorkspace(): Promise<void> {
  const { workspacePath, historyRetentionDays } = useAppStore.getState()
  if (!workspacePath) return
  const currentSessions = useAppStore.getState().sessions
  if (currentSessions.length === 0) return

  const migratedSessions = currentSessions.map((session) => ({
    ...session,
    messages: session.messages.map((msg) => {
      if (!msg.toolCalls?.length) return msg
      const migratedCalls = msg.toolCalls.map((tc) => {
        const raw = tc as unknown as Record<string, unknown>
        if ('args' in raw && !('input' in raw)) {
          const { args, result, ...rest } = raw
          return { ...rest, input: args, output: result }
        }
        return tc
      })
      return { ...msg, toolCalls: migratedCalls }
    }),
  })) as Session[]

  let merged = migratedSessions.sort((a, b) => b.updatedAt - a.updatedAt)

  // Auto-clean expired sessions based on history retention setting
  if (historyRetentionDays > 0) {
    const cutoff = Date.now() - historyRetentionDays * 86400000
    const expired = merged.filter((session) => session.updatedAt < cutoff).map((session) => session.id)
    if (expired.length > 0) {
      const expiredIds = new Set(expired)
      merged = merged.filter((session) => !expiredIds.has(session.id))
    }
  }

  useAppStore.setState((state) => ({
    sessions: merged,
    openSessionTabs: state.openSessionTabs.filter((tabId) => merged.some((session) => session.id === tabId)),
    activeSessionId: state.activeSessionId && merged.some((session) => session.id === state.activeSessionId)
      ? state.activeSessionId
      : (merged[0]?.id ?? null),
  }))
}

export async function loadSettingsFromWorkspace(): Promise<void> {
  useAppStore.getState().syncModelsFromConfigs()
}

export async function saveSettingsToWorkspace(): Promise<boolean> {
  const state = useAppStore.getState()
  if (!state.workspacePath) return false

  try {
    await flushPendingSplitStoreWrites()
    return true
  } catch {
    return false
  }
}

/**
 * Load external skills and agents from configured directories
 */
export async function loadExternalSkillsAndAgents(): Promise<void> {
  const state = useAppStore.getState()
  if (!state.workspacePath) return

  const externalDirectories = normalizeExternalDirectoriesInStore(state.externalDirectories)

  await syncExternalDirectoryAccess(externalDirectories, ['~/.suora/skills'])

  const [diskSkills, { skills: externalSkills }] = await Promise.all([
    loadAllSkills(state.workspacePath),
    loadExternalResources(externalDirectories),
  ])

  const skillMap = new Map<string, Skill>()
  for (const skill of state.skills) {
    skillMap.set(skill.name.toLowerCase(), skill)
  }
  for (const skill of [...diskSkills, ...externalSkills]) {
    const key = skill.name.toLowerCase()
    const existing = skillMap.get(key)
    skillMap.set(key, {
      ...skill,
      memories: existing?.memories ?? skill.memories ?? [],
    })
  }

  useAppStore.setState((current) => {
    const agentMap = new Map<string, Agent>()
    for (const agent of current.agents) {
      agentMap.set(agent.id, normalizeAgent(agent))
    }

    const allAgents = Array.from(agentMap.values())
    const selectedAgentId = current.selectedAgent?.id

    return {
      externalDirectories,
      skills: Array.from(skillMap.values()),
      agents: allAgents,
      selectedAgent: selectedAgentId
        ? allAgents.find((agent) => agent.id === selectedAgentId) ?? current.selectedAgent
        : current.selectedAgent,
    }
  })
}
