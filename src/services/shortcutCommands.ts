import {
  AGENT_BUILDER_AGENT_ID,
  CHANNEL_BUILDER_AGENT_ID,
  DOCUMENT_EDITOR_AGENT_ID,
  PIPELINE_BUILDER_AGENT_ID,
  TIMER_BUILDER_AGENT_ID,
} from '@/store/appStore'

export type ShortcutCommandDomain = 'agent' | 'channel' | 'document' | 'pipeline' | 'timer'
export type ShortcutCommandAction = 'create' | 'update' | 'delete' | 'list' | 'manage'

export interface ShortcutCommand {
  domain: ShortcutCommandDomain
  action: ShortcutCommandAction
  request: string
  raw: string
  agentId: string
}

const DOMAIN_ALIASES: Record<string, ShortcutCommandDomain> = {
  agent: 'agent',
  agents: 'agent',
  channel: 'channel',
  channels: 'channel',
  document: 'document',
  documents: 'document',
  doc: 'document',
  docs: 'document',
  pipeline: 'pipeline',
  pipelines: 'pipeline',
  workflow: 'pipeline',
  workflows: 'pipeline',
  timer: 'timer',
  timers: 'timer',
  schedule: 'timer',
  schedules: 'timer',
}

const ACTION_ALIASES: Record<string, ShortcutCommandAction> = {
  add: 'create',
  create: 'create',
  new: 'create',
  make: 'create',
  edit: 'update',
  modify: 'update',
  update: 'update',
  change: 'update',
  delete: 'delete',
  remove: 'delete',
  rm: 'delete',
  list: 'list',
  show: 'list',
  view: 'list',
  manage: 'manage',
}

const AGENT_BY_DOMAIN: Record<ShortcutCommandDomain, string> = {
  agent: AGENT_BUILDER_AGENT_ID,
  channel: CHANNEL_BUILDER_AGENT_ID,
  document: DOCUMENT_EDITOR_AGENT_ID,
  pipeline: PIPELINE_BUILDER_AGENT_ID,
  timer: TIMER_BUILDER_AGENT_ID,
}

export function parseShortcutCommand(input: string): ShortcutCommand | null {
  const trimmed = input.trim()
  const match = trimmed.match(/^\/([a-z][\w-]*)(?:\s+([a-z][\w-]*))?(?:\s+([\s\S]*))?$/)
  if (!match) return null

  const domain = DOMAIN_ALIASES[match[1].toLowerCase()]
  if (!domain) return null

  const actionToken = match[2]?.toLowerCase()
  const action = actionToken ? ACTION_ALIASES[actionToken] : undefined
  if (!action) return null

  const request = match[3]?.trim() ?? ''

  return {
    domain,
    action,
    request,
    raw: trimmed,
    agentId: AGENT_BY_DOMAIN[domain],
  }
}

export function buildShortcutCommandPrompt(command: ShortcutCommand): string {
  const request = command.request || '(no additional details provided)'
  return [
    `The user invoked the shortcut command "${command.raw}".`,
    `Resource: ${command.domain}`,
    `Action: ${command.action}`,
    '',
    'Use your specialized role and available tools to satisfy this request. If required details are missing, ask one concise clarifying question instead of guessing.',
    '',
    'User request:',
    request,
  ].join('\n')
}
