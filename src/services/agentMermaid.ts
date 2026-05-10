import { t } from '@/services/i18n'
import type { Agent } from '@/types'

export type AgentFlowNodeState = 'active' | 'warning' | 'disabled' | 'terminal'

export interface AgentFlowNode {
  id: string
  title: string
  detail: string
  state: AgentFlowNodeState
  icon: string
  badges?: string[]
}

export interface BuildAgentFlowOptions {
  modelLabel?: string
  skillNames?: string[]
  availableToolNames?: string[]
}

const STATE_CLASS: Record<AgentFlowNodeState, string> = {
  active: 'active',
  warning: 'warning',
  disabled: 'disabled',
  terminal: 'terminal',
}

function translateTemplate(key: string, fallback: string, values: Record<string, string | number> = {}): string {
  let message = t(key, fallback)
  for (const [name, value] of Object.entries(values)) {
    message = message.replaceAll(`{${name}}`, String(value))
  }
  return message
}

function normalizeLabel(value: string, fallback: string): string {
  const normalized = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/[`"\\[\]{}|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || fallback
}

function truncateLabel(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}...`
}

function formatListPreview(values: string[], fallback: string, maxItems = 3): string {
  if (values.length === 0) return fallback
  const visible = values.slice(0, maxItems).join(', ')
  const hiddenCount = values.length - maxItems
  return hiddenCount > 0 ? `${visible} +${hiddenCount}` : visible
}

function responseStyleBadge(responseStyle: Agent['responseStyle'] | undefined): string {
  switch (responseStyle) {
    case 'concise':
      return t('agents.flowStyleConcise', 'concise')
    case 'detailed':
      return t('agents.flowStyleDetailed', 'detailed')
    case 'balanced':
    default:
      return t('agents.flowStyleBalanced', 'balanced')
  }
}

function permissionModeBadge(permissionMode: Agent['permissionMode'] | undefined): string {
  switch (permissionMode) {
    case 'plan':
      return t('agents.flowModePlan', 'plan')
    case 'acceptEdits':
      return t('agents.flowModeAcceptEdits', 'accept edits')
    case 'bypassPermissions':
      return t('agents.flowModeBypass', 'bypass')
    case 'default':
    default:
      return t('agents.flowModeDefault', 'default')
  }
}

function permissionDetail(agent: Agent, availableToolNames: string[]): string {
  const allowedTools = agent.allowedTools ?? []
  const disallowedTools = agent.disallowedTools ?? []

  if (agent.permissionMode === 'bypassPermissions') {
    return translateTemplate('agents.flowPermissionsBypass', 'Bypass permissions; {count} blocked', { count: disallowedTools.length })
  }

  if (agent.permissionMode === 'plan') {
    return translateTemplate('agents.flowPermissionsPlan', 'Plan approval; {count} tool hints', { count: allowedTools.length || availableToolNames.length || 0 })
  }

  if (allowedTools.length > 0) {
    return translateTemplate('agents.flowPermissionsAllowed', '{allowed} allowed; {blocked} blocked', {
      allowed: allowedTools.length,
      blocked: disallowedTools.length,
    })
  }

  return translateTemplate('agents.flowPermissionsSelectedSkillTools', 'All selected-skill tools; {blocked} blocked', { blocked: disallowedTools.length })
}

export function buildAgentFlowNodes(agent: Agent, options: BuildAgentFlowOptions = {}): AgentFlowNode[] {
  const skillNames = options.skillNames ?? []
  const availableToolNames = options.availableToolNames ?? []
  const hasSystemPrompt = agent.systemPrompt.trim().length > 0
  const hasModel = Boolean(agent.modelId)
  const skillPreview = formatListPreview(skillNames, t('agents.flowNoSkillsSelected', 'No skills selected'))
  const memoryCount = agent.memories?.length ?? 0

  return [
    {
      id: 'input',
      title: t('agents.flowInputTitle', 'User input'),
      detail: agent.whenToUse?.trim() || t('agents.flowInputDetail', 'Manual or routed request enters this agent.'),
      state: 'terminal',
      icon: 'ui-user',
    },
    {
      id: 'identity',
      title: normalizeLabel(agent.name, t('agents.flowUntitledAgent', 'Untitled agent')),
      detail: agent.enabled
        ? t('agents.flowIdentityEnabled', 'Agent is enabled and can be selected.')
        : t('agents.flowIdentityDisabled', 'Agent is currently disabled.'),
      state: agent.enabled ? 'active' : 'disabled',
      icon: agent.avatar || 'agent-robot',
      badges: [responseStyleBadge(agent.responseStyle)],
    },
    {
      id: 'memory',
      title: t('agents.flowMemoryTitle', 'Memory loop'),
      detail: agent.autoLearn
        ? translateTemplate('agents.flowMemoryAutoLearn', 'Auto-learn enabled; {count} retained memories.', { count: memoryCount })
        : translateTemplate('agents.flowMemoryStored', '{count} retained memories; auto-learn off.', { count: memoryCount }),
      state: agent.autoLearn ? 'active' : 'disabled',
      icon: 'skill-memory',
    },
    {
      id: 'prompt',
      title: t('agents.systemPrompt', 'System Prompt'),
      detail: hasSystemPrompt
        ? translateTemplate('agents.flowPromptChars', '{count} characters of operating instructions.', { count: agent.systemPrompt.trim().length })
        : t('agents.flowPromptEmpty', 'Prompt is empty.'),
      state: hasSystemPrompt ? 'active' : 'warning',
      icon: 'ui-prompt',
    },
    {
      id: 'skills',
      title: t('agents.flowSkillsTitle', 'Skills context'),
      detail: translateTemplate('agents.flowSkillsDetail', '{count} selected: {skills}', { count: skillNames.length, skills: skillPreview }),
      state: skillNames.length > 0 ? 'active' : 'warning',
      icon: 'action-skills',
    },
    {
      id: 'tools',
      title: t('agents.flowToolsTitle', 'Tool permissions'),
      detail: permissionDetail(agent, availableToolNames),
      state: agent.permissionMode === 'bypassPermissions' ? 'warning' : 'active',
      icon: 'ui-shield',
      badges: [permissionModeBadge(agent.permissionMode)],
    },
    {
      id: 'runtime',
      title: t('agents.flowRuntimeTitle', 'Model runtime'),
      detail: hasModel
        ? translateTemplate('agents.flowRuntimeDetail', '{model}; temp {temperature}; max turns {turns}', {
            model: options.modelLabel || agent.modelId || '',
            temperature: agent.temperature ?? 0.7,
            turns: Math.max(2, agent.maxTurns ?? 20),
          })
        : t('agents.flowNoModelSelected', 'No model selected.'),
      state: hasModel ? 'active' : 'warning',
      icon: 'action-models',
    },
    {
      id: 'output',
      title: t('agents.flowOutputTitle', 'Assistant output'),
      detail: agent.greeting?.trim() || t('agents.flowOutputDetail', 'Final response is returned to the active chat or channel.'),
      state: 'terminal',
      icon: 'ui-chat',
    },
  ]
}

function buildNodeLabel(node: AgentFlowNode, index: number): string {
  const title = normalizeLabel(node.title, translateTemplate('agents.flowNodeFallback', 'Node {number}', { number: index + 1 }))
  const detail = truncateLabel(normalizeLabel(node.detail, t('agents.flowNoDetail', 'No detail')), 92)
  const badges = node.badges?.length ? `<br/>${node.badges.map((badge) => normalizeLabel(badge, '')).filter(Boolean).join(' · ')}` : ''
  return `${index + 1}. ${title}<br/>${detail}${badges}`
}

export function buildAgentMermaidSource(agent: Agent, options: BuildAgentFlowOptions = {}): string {
  const nodes = buildAgentFlowNodes(agent, options)
  const title = normalizeLabel(agent.name, t('agents.untitled', 'Untitled Agent'))
  const lines = [
    'flowchart TD',
    `  %% Agent: ${title}`,
  ]

  for (const [index, node] of nodes.entries()) {
    const shape = node.id === 'input' || node.id === 'output' ? `(["${buildNodeLabel(node, index)}"])` : `["${buildNodeLabel(node, index)}"]`
    lines.push(`  ${node.id}${shape}`)
  }

  lines.push(
    '  input --> identity',
    '  identity --> memory',
    '  memory --> prompt',
    '  prompt --> skills',
    '  skills --> tools',
    '  tools --> runtime',
    '  runtime --> output',
  )

  if (agent.autoLearn) {
    lines.push(`  output -. ${t('agents.flowConnectorLearn', 'learn')} .-> memory`)
  } else {
    lines.push(`  output -. ${t('agents.flowConnectorOptional', 'optional')} .-> memory`)
  }

  lines.push(
    '  classDef active fill:#064e3b,stroke:#10b981,color:#ecfdf5',
    '  classDef warning fill:#78350f,stroke:#f59e0b,color:#fffbeb',
    '  classDef disabled fill:#1f2937,stroke:#6b7280,color:#d1d5db',
    '  classDef terminal fill:#1e3a8a,stroke:#60a5fa,color:#eff6ff',
  )

  for (const node of nodes) {
    lines.push(`  class ${node.id} ${STATE_CLASS[node.state]};`)
  }

  return lines.join('\n')
}