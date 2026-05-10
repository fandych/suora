import type { Agent, Model, Skill } from '@/types'
import { t } from '@/services/i18n'
import { BUILTIN_TOOL_DESCRIPTIONS } from '@/services/tools'

export type AgentDiagnosticSeverity = 'error' | 'warning' | 'info'

export interface AgentDiagnostic {
  severity: AgentDiagnosticSeverity
  code: string
  message: string
}

export interface AgentCapabilityProfile {
  toolCount: number
  enabledSkillCount: number
  disabledSkillCount: number
  permissionMode: Agent['permissionMode']
  modelLabel: string
  promptChars: number
}

function translateTemplate(key: string, fallback: string, values: Record<string, string | number> = {}): string {
  let message = t(key, fallback)
  for (const [name, value] of Object.entries(values)) {
    message = message.replaceAll(`{${name}}`, String(value))
  }
  return message
}

export function validateAgentConfiguration(agent: Agent, models: Model[], skills: Skill[]): AgentDiagnostic[] {
  const diagnostics: AgentDiagnostic[] = []
  const builtinToolNames = new Set(Object.keys(BUILTIN_TOOL_DESCRIPTIONS))
  const selectedSkills = skills.filter((skill) => agent.skills.includes(skill.id))
  const missingSkills = agent.skills.filter((skillId) => !skills.some((skill) => skill.id === skillId))
  const disabledSkills = selectedSkills.filter((skill) => skill.enabled === false)

  if (!agent.name.trim()) diagnostics.push({ severity: 'error', code: 'missing-name', message: t('agents.agentNameRequired', 'Agent name is required.') })
  if (agent.modelId && !models.some((model) => model.id === agent.modelId)) diagnostics.push({ severity: 'error', code: 'missing-model', message: t('agents.diagnosticMissingModel', 'Selected model does not exist.') })
  if (!agent.modelId) diagnostics.push({ severity: 'warning', code: 'no-model', message: t('agents.diagnosticNoModel', 'Agent will fall back to the session or global default model.') })
  if (agent.systemPrompt.length > 16_000) diagnostics.push({ severity: 'warning', code: 'long-prompt', message: t('agents.diagnosticLongPrompt', 'System prompt is long and may crowd out task context.') })
  if ((agent.memories?.reduce((sum, memory) => sum + memory.content.length, 0) ?? 0) > 12_000) diagnostics.push({ severity: 'warning', code: 'long-memory', message: t('agents.diagnosticLongMemory', 'Agent memories are large and may increase prompt cost.') })
  if (disabledSkills.length > 0) diagnostics.push({ severity: 'warning', code: 'disabled-skills', message: translateTemplate('agents.diagnosticDisabledSkills', '{count} assigned skill(s) are disabled.', { count: disabledSkills.length }) })
  if (missingSkills.length > 0) diagnostics.push({ severity: 'error', code: 'missing-skills', message: translateTemplate('agents.diagnosticMissingSkills', '{count} assigned skill(s) are missing.', { count: missingSkills.length }) })

  for (const toolName of [...(agent.allowedTools ?? []), ...(agent.disallowedTools ?? [])]) {
    if (!builtinToolNames.has(toolName)) diagnostics.push({ severity: 'warning', code: 'unknown-tool', message: translateTemplate('agents.diagnosticUnknownTool', 'Unknown tool name: {name}', { name: toolName }) })
  }
  for (const toolName of agent.allowedTools ?? []) {
    if (agent.disallowedTools?.includes(toolName)) diagnostics.push({ severity: 'error', code: 'tool-conflict', message: translateTemplate('agents.diagnosticToolConflict', 'Tool is both allowed and disallowed: {name}', { name: toolName }) })
  }
  if (agent.permissionMode === 'bypassPermissions') diagnostics.push({ severity: 'warning', code: 'bypass-permissions', message: t('agents.diagnosticBypassPermissions', 'Bypass permission mode can perform high-risk actions without confirmation.') })

  return diagnostics
}

export function getAgentCapabilityProfile(agent: Agent, models: Model[], skills: Skill[]): AgentCapabilityProfile {
  const selectedSkills = skills.filter((skill) => agent.skills.includes(skill.id))
  const enabledSkillCount = selectedSkills.filter((skill) => skill.enabled !== false).length
  const model = models.find((item) => item.id === agent.modelId)
  const toolCount = agent.allowedTools?.length
    ? agent.allowedTools.length
    : Math.max(0, Object.keys(BUILTIN_TOOL_DESCRIPTIONS).length - (agent.disallowedTools?.length ?? 0))

  return {
    toolCount,
    enabledSkillCount,
    disabledSkillCount: selectedSkills.length - enabledSkillCount,
    permissionMode: agent.permissionMode,
    modelLabel: model ? `${model.name} / ${model.modelId}` : t('agents.defaultModelFallback', 'Default model fallback'),
    promptChars: agent.systemPrompt.length + (agent.memories?.reduce((sum, memory) => sum + memory.content.length, 0) ?? 0),
  }
}