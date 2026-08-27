import { describe, expect, it } from 'vitest'
import { materializePipelineGraph, removePipelineTransition, upsertPipelineTransition } from './pipelineGraph'
import type { AgentPipelineStep } from '@/types'

describe('pipelineGraph', () => {
  it('adds and removes persisted transitions in the editable graph model', () => {
    const steps: AgentPipelineStep[] = [
      { id: 'start', agentId: 'agent-1', task: '', nodeType: 'start', startParams: [{ key: 'topic', defaultValue: 'launch' }] },
      { id: 'draft', agentId: 'agent-1', task: 'Draft' },
      { id: 'end', agentId: 'agent-1', task: '', nodeType: 'end', endOutputs: [{ key: 'result', value: '{{previous.output}}' }] },
    ]

    const connected = upsertPipelineTransition(steps, 0, 1)
    expect(materializePipelineGraph(connected)[0].transitions).toEqual([{ targetStepId: 'draft' }])

    const disconnected = removePipelineTransition(connected, 0, 1)
    expect(materializePipelineGraph(disconnected)[0].transitions).toEqual([])
  })
})
