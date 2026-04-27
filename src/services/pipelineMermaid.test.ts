import { describe, expect, it } from 'vitest'
import { buildPipelineMermaidSource } from './pipelineMermaid'
import type { AgentPipelineStep } from '@/types'
import type { AgentPipelineProgressStep } from './agentPipelineService'

describe('pipelineMermaid', () => {
  it('builds a valid empty pipeline graph', () => {
    const source = buildPipelineMermaidSource([], { pipelineName: 'Draft' })

    expect(source).toContain('flowchart TD')
    expect(source).toContain('start --> finish')
  })

  it('includes step labels, agents, retry policy, and stop-on-error edges', () => {
    const steps: AgentPipelineStep[] = [
      { agentId: 'agent-1', name: 'Draft', task: 'Write the report', retryCount: 2, continueOnError: false },
      { agentId: 'agent-2', name: 'Review', task: 'Review {{steps[1].output}}', enabled: false },
    ]

    const source = buildPipelineMermaidSource(steps, {
      pipelineName: 'Morning Run',
      agentNameMap: {
        'agent-1': 'Writer',
        'agent-2': 'Reviewer',
      },
    })

    expect(source).toContain('%% Morning Run')
    expect(source).toContain('1. Draft<br/>Writer<br/>Write the report<br/>pending · 2 retry · stop on error')
    expect(source).toContain('2. Review<br/>Reviewer<br/>Review steps1.output<br/>skipped · continue on error')
    expect(source).toContain('step1 -->|success| step2')
    expect(source).toContain('class step2 skipped;')
  })

  it('uses execution progress statuses when available', () => {
    const steps: AgentPipelineStep[] = [
      { agentId: 'agent-1', task: 'Draft' },
      { agentId: 'agent-2', task: 'Review' },
    ]
    const progressSteps: AgentPipelineProgressStep[] = [
      { stepIndex: 0, agentId: 'agent-1', task: 'Draft', input: 'Draft', output: 'done', status: 'success' },
      { stepIndex: 1, agentId: 'agent-2', task: 'Review', input: 'Review', error: 'failed', status: 'error' },
    ]

    const source = buildPipelineMermaidSource(steps, { progressSteps })

    expect(source).toContain('success · continue on error')
    expect(source).toContain('error · continue on error')
    expect(source).toContain('class step1 success;')
    expect(source).toContain('class step2 error;')
  })
})