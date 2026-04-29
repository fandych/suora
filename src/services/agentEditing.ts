import type { ModelMessage } from 'ai'
import type { Agent, Model, Skill } from '@/types'
import { generateResponse, initializeProvider, validateModelConfig } from '@/services/aiService'
import { buildSystemPrompt, getSkillSystemPrompts, mergeSkillsWithBuiltins } from '@/services/tools'

export type AgentEditTarget = 'document' | 'skill'

export interface AgentEditRequest {
  target: AgentEditTarget
  title: string
  currentContent: string
  instruction: string
  agent: Agent
  model: Model
  skills: Skill[]
}

function stripMarkdownFence(value: string): string {
  const trimmed = value.trim()
  const match = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(trimmed)
  return (match?.[1] ?? trimmed).trim()
}

function targetLabel(target: AgentEditTarget): string {
  return target === 'skill' ? 'SKILL.md instruction body' : 'Markdown document'
}

export async function runAgentEdit(request: AgentEditRequest): Promise<string> {
  const validation = validateModelConfig(request.model)
  if (!validation.valid) {
    throw new Error(`Model configuration error: ${validation.error}`)
  }

  initializeProvider(
    request.model.providerType,
    request.model.apiKey || (request.model.providerType === 'ollama' ? 'ollama' : ''),
    request.model.baseUrl,
    request.model.provider,
  )

  const allSkills = mergeSkillsWithBuiltins(request.skills)
  const skillPrompts = await getSkillSystemPrompts(request.agent.skills, allSkills)
  const baseSystemPrompt = buildSystemPrompt({
    agentPrompt: request.agent.systemPrompt,
    responseStyle: request.agent.responseStyle,
    memories: request.agent.memories,
    skillPrompts,
    permissionMode: request.agent.permissionMode,
  })

  const systemPrompt = [
    baseSystemPrompt,
    `You are editing a ${targetLabel(request.target)} inside Suora.`,
    'Return only the complete revised Markdown content. Do not wrap it in code fences, do not explain your changes, and do not include diff markers.',
    request.target === 'skill'
      ? 'Preserve the skill as reusable agent instructions. Keep headings, constraints, trigger guidance, and examples clear for future model use.'
      : 'Preserve valid Markdown and existing document intent unless the user asks for structural changes.',
  ].filter(Boolean).join('\n\n')

  const messages: ModelMessage[] = [
    {
      role: 'user',
      content: [
        `Title: ${request.title || 'Untitled'}`,
        '',
        'Edit instruction:',
        request.instruction.trim(),
        '',
        'Current content:',
        request.currentContent || '',
      ].join('\n'),
    },
  ]

  const response = await generateResponse(
    `${request.model.provider}:${request.model.modelId}`,
    messages,
    systemPrompt,
    request.model.apiKey,
    request.model.baseUrl,
  )
  const result = stripMarkdownFence(typeof response === 'string' ? response : '')

  if (!result) {
    throw new Error('Agent returned empty content.')
  }

  return result
}
