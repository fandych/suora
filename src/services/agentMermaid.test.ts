import { describe, expect, it } from 'vitest'
import { buildAgentFlowNodes, buildAgentMermaidSource } from './agentMermaid'
import type { Agent } from '@/types'

function createAgent(patch: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    name: 'Researcher',
    avatar: 'agent-research',
    systemPrompt: 'Investigate the request and produce a careful answer.',
    modelId: 'openai:gpt-4.1',
    skills: ['skill-research'],
    temperature: 0.4,
    maxTokens: 4096,
    enabled: true,
    responseStyle: 'detailed',
    allowedTools: ['web_search'],
    disallowedTools: ['shell'],
    maxTurns: 8,
    permissionMode: 'default',
    memories: [],
    autoLearn: true,
    ...patch,
  }
}

describe('agentMermaid', () => {
  it('builds a Mermaid graph for an agent runtime flow', () => {
    const source = buildAgentMermaidSource(createAgent(), {
      modelLabel: 'OpenAI / GPT 4.1',
      skillNames: ['Research'],
      availableToolNames: ['web_search'],
    })

    expect(source).toContain('flowchart TD')
    expect(source).toContain('%% Agent: Researcher')
    expect(source).toContain('identity --> memory')
    expect(source).toContain('memory --> prompt')
    expect(source).toContain('output -. learn .-> memory')
    expect(source).toContain('Researcher<br/>Agent is enabled and can be selected.<br/>detailed')
    expect(source).toContain('OpenAI / GPT 4.1; temp 0.4; max turns 8')
    expect(source).toContain('class runtime active;')
  })

  it('marks incomplete agent configuration as warnings or disabled nodes', () => {
    const agent = createAgent({
      enabled: false,
      systemPrompt: '',
      modelId: '',
      skills: [],
      autoLearn: false,
      allowedTools: [],
      disallowedTools: [],
    })

    const nodes = buildAgentFlowNodes(agent, { skillNames: [] })
    const source = buildAgentMermaidSource(agent, { skillNames: [] })

    expect(nodes.find((node) => node.id === 'identity')?.state).toBe('disabled')
    expect(nodes.find((node) => node.id === 'prompt')?.state).toBe('warning')
    expect(nodes.find((node) => node.id === 'skills')?.state).toBe('warning')
    expect(nodes.find((node) => node.id === 'runtime')?.state).toBe('warning')
    expect(nodes.find((node) => node.id === 'memory')?.state).toBe('disabled')
    expect(source).toContain('output -. optional .-> memory')
    expect(source).toContain('class identity disabled;')
  })
})