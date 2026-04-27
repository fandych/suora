import type { Agent, Model, Skill } from '@/types'
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

export function validateAgentConfiguration(agent: Agent, models: Model[], skills: Skill[]): AgentDiagnostic[] {
  const diagnostics: AgentDiagnostic[] = []
  const builtinToolNames = new Set(Object.keys(BUILTIN_TOOL_DESCRIPTIONS))
  const selectedSkills = skills.filter((skill) => agent.skills.includes(skill.id))
  const missingSkills = agent.skills.filter((skillId) => !skills.some((skill) => skill.id === skillId))
  const disabledSkills = selectedSkills.filter((skill) => skill.enabled === false)

  if (!agent.name.trim()) diagnostics.push({ severity: 'error', code: 'missing-name', message: 'Agent name is required.' })
  if (agent.modelId && !models.some((model) => model.id === agent.modelId)) diagnostics.push({ severity: 'error', code: 'missing-model', message: 'Selected model does not exist.' })
  if (!agent.modelId) diagnostics.push({ severity: 'warning', code: 'no-model', message: 'Agent will fall back to the session or global default model.' })
  if (agent.systemPrompt.length > 16_000) diagnostics.push({ severity: 'warning', code: 'long-prompt', message: 'System prompt is long and may crowd out task context.' })
  if ((agent.memories?.reduce((sum, memory) => sum + memory.content.length, 0) ?? 0) > 12_000) diagnostics.push({ severity: 'warning', code: 'long-memory', message: 'Agent memories are large and may increase prompt cost.' })
  if (disabledSkills.length > 0) diagnostics.push({ severity: 'warning', code: 'disabled-skills', message: `${disabledSkills.length} assigned skill(s) are disabled.` })
  if (missingSkills.length > 0) diagnostics.push({ severity: 'error', code: 'missing-skills', message: `${missingSkills.length} assigned skill(s) are missing.` })

  for (const toolName of [...(agent.allowedTools ?? []), ...(agent.disallowedTools ?? [])]) {
    if (!builtinToolNames.has(toolName)) diagnostics.push({ severity: 'warning', code: 'unknown-tool', message: `Unknown tool name: ${toolName}` })
  }
  for (const toolName of agent.allowedTools ?? []) {
    if (agent.disallowedTools?.includes(toolName)) diagnostics.push({ severity: 'error', code: 'tool-conflict', message: `Tool is both allowed and disallowed: ${toolName}` })
  }
  if (agent.permissionMode === 'bypassPermissions') diagnostics.push({ severity: 'warning', code: 'bypass-permissions', message: 'Bypass permission mode can perform high-risk actions without confirmation.' })

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
    modelLabel: model ? `${model.name} / ${model.modelId}` : 'Default model fallback',
    promptChars: agent.systemPrompt.length + (agent.memories?.reduce((sum, memory) => sum + memory.content.length, 0) ?? 0),
  }
}