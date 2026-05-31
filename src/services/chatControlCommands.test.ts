import { describe, expect, it } from 'vitest'
import { parseChatControlCommand, resolveAgentControlReference, resolveModelControlReference } from './chatControlCommands'
import type { Agent, Model } from '@/types'

const models: Model[] = [
  {
    id: 'model-1',
    name: 'GPT Test',
    provider: 'openai',
    providerType: 'openai',
    modelId: 'gpt-test',
    apiKey: 'test-key',
    enabled: true,
  },
]

const agents: Agent[] = [
  {
    id: 'agent-1',
    name: 'Research Agent',
    systemPrompt: 'Research',
    modelId: 'model-1',
    skills: [],
    enabled: true,
    memories: [],
    autoLearn: false,
  },
]

describe('chatControlCommands', () => {
  it('parses clear, model, and fixed agent commands', () => {
    expect(parseChatControlCommand('/clear')).toEqual({ type: 'clear', raw: '/clear' })
    expect(parseChatControlCommand('/help')).toEqual({ type: 'help', raw: '/help' })
    expect(parseChatControlCommand('/?')).toEqual({ type: 'help', raw: '/?' })
    expect(parseChatControlCommand('/model user GPT Test')).toMatchObject({
      type: 'model',
      reference: 'GPT Test',
    })
    expect(parseChatControlCommand('/model use model-1')).toMatchObject({
      type: 'model',
      reference: 'model-1',
    })
    expect(parseChatControlCommand('/agent use $Research Agent')).toMatchObject({
      type: 'agent',
      reference: 'Research Agent',
    })
    expect(parseChatControlCommand('/AGENT  USE   research agent')).toMatchObject({
      type: 'agent',
      reference: 'research agent',
    })
  })

  it('rejects model commands that only contain a verb with no reference', () => {
    expect(parseChatControlCommand('/model use')).toBeNull()
    expect(parseChatControlCommand('/model set')).toBeNull()
    expect(parseChatControlCommand('/model')).toBeNull()
  })

  it('does not parse shortcut-style agent actions as control commands', () => {
    expect(parseChatControlCommand('/agent create research bot')).toBeNull()
    expect(parseChatControlCommand('/agent update Research Agent')).toBeNull()
    expect(parseChatControlCommand('/agent delete Research Agent')).toBeNull()
  })

  it('resolves models and agents by id or name', () => {
    expect(resolveModelControlReference('GPT Test', models)?.id).toBe('model-1')
    expect(resolveModelControlReference('model-1', models)?.name).toBe('GPT Test')
    expect(resolveAgentControlReference('Research Agent', agents)?.id).toBe('agent-1')
    expect(resolveAgentControlReference('agent-1', agents)?.name).toBe('Research Agent')
  })
})
