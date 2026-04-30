import { describe, expect, it } from 'vitest'
import type { Agent, Model, Skill } from '@/types'
import { getAgentCapabilityProfile, validateAgentConfiguration } from './agentDiagnostics'

const model: Model = { id: 'model-1', name: 'GPT', provider: 'provider-1', providerType: 'openai', modelId: 'gpt-4.1', enabled: true, isDefault: true }
const skill: Skill = {
  id: 'skill-1',
  name: 'Research',
  description: 'Find and summarize facts',
  enabled: true,
  source: 'project',
  content: 'Use careful research.',
  frontmatter: { name: 'Research', description: 'Find and summarize facts' },
  context: 'inline',
}

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    name: 'Researcher',
    systemPrompt: 'Research clearly',
    modelId: 'model-1',
    skills: ['skill-1'],
    enabled: true,
    memories: [],
    autoLearn: false,
    ...overrides,
  }
}

describe('agentDiagnostics', () => {
  it('reports blocking configuration issues', () => {
    const diagnostics = validateAgentConfiguration(
      agent({ name: ' ', modelId: 'missing', skills: ['missing-skill'], allowedTools: ['readFile'], disallowedTools: ['readFile'] }),
      [model],
      [skill],
    )

    expect(diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining(['missing-name', 'missing-model', 'missing-skills', 'tool-conflict']))
  })

  it('builds a capability profile from model, skills, prompt, and memory', () => {
    const profile = getAgentCapabilityProfile(
      agent({ allowedTools: ['readFile', 'writeFile'], memories: [{ id: 'memory-1', content: 'remember me', type: 'knowledge', scope: 'global', createdAt: 1, source: 'test' }] }),
      [model],
      [skill],
    )

    expect(profile.toolCount).toBe(2)
    expect(profile.enabledSkillCount).toBe(1)
    expect(profile.modelLabel).toBe('GPT / gpt-4.1')
    expect(profile.promptChars).toBe('Research clearly'.length + 'remember me'.length)
  })
})
