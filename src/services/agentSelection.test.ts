import { describe, expect, it } from 'vitest'
import type { Agent, AgentPerformanceStats, Skill } from '@/types'
import { scoreAgentsForTask, selectBestAgentForTask } from './agentSelection'

function agent(id: string, name: string, whenToUse: string, skills: string[] = []): Agent {
  return { id, name, whenToUse, systemPrompt: whenToUse, modelId: 'model-1', skills, enabled: true, memories: [], autoLearn: false }
}

const codingSkill: Skill = {
  id: 'skill-code',
  name: 'Code Review',
  description: 'Fix TypeScript React bugs and tests',
  enabled: true,
  source: 'project',
  content: 'Review code.',
  frontmatter: { name: 'Code Review', description: 'Fix TypeScript React bugs and tests', whenToUse: 'coding bug fix' },
  context: 'inline',
}

describe('agentSelection', () => {
  it('scores agents by when-to-use guidance and assigned skills', () => {
    const agents = [
      agent('writer', 'Writer', 'Draft clean prose and summaries'),
      agent('coder', 'Coder', 'Fix TypeScript React bugs', ['skill-code']),
    ]

    const best = selectBestAgentForTask('Please fix this React TypeScript test bug', agents, [codingSkill])

    expect(best?.agent.id).toBe('coder')
    expect(best?.reasons.join(' ')).toContain('matches skill')
  })

  it('uses historical success rate as a tie breaker', () => {
    const agents = [agent('a', 'Alpha', 'database query migration'), agent('b', 'Beta', 'database query migration')]
    const performance: Record<string, AgentPerformanceStats> = {
      a: { agentId: 'a', totalCalls: 10, errorCount: 8, totalTokens: 0, avgResponseTimeMs: 0, responseTimes: [], lastUsed: 1 },
      b: { agentId: 'b', totalCalls: 10, errorCount: 0, totalTokens: 0, avgResponseTimeMs: 0, responseTimes: [], lastUsed: 2 },
    }

    const scores = scoreAgentsForTask('database migration query', agents, [], performance)

    expect(scores[0].agent.id).toBe('b')
    expect(scores[0].reasons).toContain('100% historical success')
  })

  it('uses previous manual routing choices for similar tasks', () => {
    const agents = [agent('writer', 'Writer', 'Draft clean prose'), agent('coder', 'Coder', 'Fix TypeScript React bugs')]

    const scores = scoreAgentsForTask('Please fix this React TypeScript bug', agents, [], {}, [
      { agentId: 'writer', taskFingerprint: 'please fix this react typescript bug', selectedAt: Date.now(), count: 3 },
    ])

    expect(scores[0].agent.id).toBe('writer')
    expect(scores[0].reasons).toContain('matches your previous routing choice')
  })
})
