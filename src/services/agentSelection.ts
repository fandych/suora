import type { Agent, AgentPerformanceStats, Skill } from '@/types'

export interface AgentSelectionScore {
  agent: Agent
  score: number
  reasons: string[]
}

const KEYWORD_WEIGHTS: Array<[RegExp, string, number]> = [
  [/\b(code|bug|fix|typescript|react|electron|test|build|lint)\b/i, 'coding task keywords', 18],
  [/\b(write|draft|copy|article|email|summary|summarize)\b/i, 'writing task keywords', 12],
  [/\b(sql|database|schema|query|migration)\b/i, 'database task keywords', 14],
  [/\bdeploy|ci|docker|server|ops\b/i, 'operations task keywords', 14],
  [/分析|总结|写|修复|测试|部署|数据库|流水线/u, 'localized task keywords', 10],
]

function textScore(input: string, text: string | undefined): number {
  if (!text) return 0
  const normalizedInput = input.toLowerCase()
  const normalizedText = text.toLowerCase()
  let score = 0
  for (const token of normalizedInput.split(/[^\p{L}\p{N}_-]+/u).filter((item) => item.length >= 3)) {
    if (normalizedText.includes(token)) score += 3
  }
  return Math.min(score, 24)
}

export function scoreAgentsForTask(
  input: string,
  agents: Agent[],
  skills: Skill[],
  performance: Record<string, AgentPerformanceStats> = {},
): AgentSelectionScore[] {
  const enabledAgents = agents.filter((agent) => agent.enabled !== false)
  return enabledAgents
    .map((agent) => {
      const reasons: string[] = []
      let score = agent.id === 'default-assistant' ? 6 : 0

      const whenToUseScore = textScore(input, agent.whenToUse)
      if (whenToUseScore > 0) {
        score += whenToUseScore
        reasons.push('matches when-to-use guidance')
      }

      const promptScore = textScore(input, agent.systemPrompt) / 2
      if (promptScore > 0) score += promptScore

      const assignedSkills = skills.filter((skill) => agent.skills.includes(skill.id) && skill.enabled !== false)
      for (const skill of assignedSkills) {
        const skillScore = textScore(input, `${skill.name} ${skill.description} ${skill.frontmatter?.whenToUse ?? ''}`)
        if (skillScore > 0) {
          score += Math.min(12, skillScore)
          reasons.push(`matches skill: ${skill.name}`)
        }
      }

      for (const [pattern, reason, weight] of KEYWORD_WEIGHTS) {
        if (pattern.test(input) && pattern.test(`${agent.name} ${agent.whenToUse ?? ''} ${agent.systemPrompt}`)) {
          score += weight
          reasons.push(reason)
        }
      }

      const stats = performance[agent.id]
      if (stats?.totalCalls) {
        const successRate = Math.max(0, (stats.totalCalls - stats.errorCount) / stats.totalCalls)
        score += Math.round(successRate * 12)
        reasons.push(`${Math.round(successRate * 100)}% historical success`)
      }

      return { agent, score: Math.round(score), reasons: reasons.slice(0, 4) }
    })
    .sort((left, right) => right.score - left.score)
}

export function selectBestAgentForTask(
  input: string,
  agents: Agent[],
  skills: Skill[],
  performance: Record<string, AgentPerformanceStats> = {},
): AgentSelectionScore | null {
  return scoreAgentsForTask(input, agents, skills, performance)[0] ?? null
}