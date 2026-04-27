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

function permissionDetail(agent: Agent, availableToolNames: string[]): string {
  const allowedTools = agent.allowedTools ?? []
  const disallowedTools = agent.disallowedTools ?? []

  if (agent.permissionMode === 'bypassPermissions') {
    return `Bypass permissions; ${disallowedTools.length} blocked`
  }

  if (agent.permissionMode === 'plan') {
    return `Plan approval; ${allowedTools.length || availableToolNames.length || 0} tool hints`
  }

  if (allowedTools.length > 0) {
    return `${allowedTools.length} allowed; ${disallowedTools.length} blocked`
  }

  return `All selected-skill tools; ${disallowedTools.length} blocked`
}

export function buildAgentFlowNodes(agent: Agent, options: BuildAgentFlowOptions = {}): AgentFlowNode[] {
  const skillNames = options.skillNames ?? []
  const availableToolNames = options.availableToolNames ?? []
  const hasSystemPrompt = agent.systemPrompt.trim().length > 0
  const hasModel = Boolean(agent.modelId)
  const skillPreview = formatListPreview(skillNames, 'No skills selected')
  const memoryCount = agent.memories?.length ?? 0

  return [
    {
      id: 'input',
      title: 'User input',
      detail: agent.whenToUse?.trim() || 'Manual or routed request enters this agent.',
      state: 'terminal',
      icon: 'ui-user',
    },
    {
      id: 'identity',
      title: normalizeLabel(agent.name, 'Untitled agent'),
      detail: agent.enabled ? 'Agent is enabled and can be selected.' : 'Agent is currently disabled.',
      state: agent.enabled ? 'active' : 'disabled',
      icon: agent.avatar || 'agent-robot',
      badges: [agent.responseStyle ?? 'balanced'],
    },
    {
      id: 'memory',
      title: 'Memory loop',
      detail: agent.autoLearn ? `Auto-learn enabled; ${memoryCount} retained memories.` : `${memoryCount} retained memories; auto-learn off.`,
      state: agent.autoLearn ? 'active' : 'disabled',
      icon: 'skill-memory',
    },
    {
      id: 'prompt',
      title: 'System prompt',
      detail: hasSystemPrompt ? `${agent.systemPrompt.trim().length} characters of operating instructions.` : 'Prompt is empty.',
      state: hasSystemPrompt ? 'active' : 'warning',
      icon: 'ui-prompt',
    },
    {
      id: 'skills',
      title: 'Skills context',
      detail: `${skillNames.length} selected: ${skillPreview}`,
      state: skillNames.length > 0 ? 'active' : 'warning',
      icon: 'action-skills',
    },
    {
      id: 'tools',
      title: 'Tool permissions',
      detail: permissionDetail(agent, availableToolNames),
      state: agent.permissionMode === 'bypassPermissions' ? 'warning' : 'active',
      icon: 'ui-shield',
      badges: [agent.permissionMode ?? 'default'],
    },
    {
      id: 'runtime',
      title: 'Model runtime',
      detail: hasModel ? `${options.modelLabel || agent.modelId}; temp ${agent.temperature ?? 0.7}; max turns ${Math.max(2, agent.maxTurns ?? 20)}` : 'No model selected.',
      state: hasModel ? 'active' : 'warning',
      icon: 'action-models',
    },
    {
      id: 'output',
      title: 'Assistant output',
      detail: agent.greeting?.trim() || 'Final response is returned to the active chat or channel.',
      state: 'terminal',
      icon: 'ui-chat',
    },
  ]
}

function buildNodeLabel(node: AgentFlowNode, index: number): string {
  const title = normalizeLabel(node.title, `Node ${index + 1}`)
  const detail = truncateLabel(normalizeLabel(node.detail, 'No detail'), 92)
  const badges = node.badges?.length ? `<br/>${node.badges.map((badge) => normalizeLabel(badge, '')).filter(Boolean).join(' · ')}` : ''
  return `${index + 1}. ${title}<br/>${detail}${badges}`
}

export function buildAgentMermaidSource(agent: Agent, options: BuildAgentFlowOptions = {}): string {
  const nodes = buildAgentFlowNodes(agent, options)
  const title = normalizeLabel(agent.name, 'Untitled Agent')
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
    lines.push('  output -. learn .-> memory')
  } else {
    lines.push('  output -. optional .-> memory')
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