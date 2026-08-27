import { describe, expect, it } from 'vitest'

import { convertStepsToFlow } from './PipelineFlowCanvas.utils'

describe('convertStepsToFlow', () => {
  it('creates a minimal start-to-finish graph for empty pipelines', () => {
    const graph = convertStepsToFlow([], [], {})

    expect(graph.nodes).toHaveLength(0)
    expect(graph.edges).toHaveLength(0)
  })

  it('marks conditional and success-only edges for multi-step pipelines', () => {
    const graph = convertStepsToFlow([
      {
        agentId: 'agent-1',
        task: '',
        name: 'Start',
        nodeType: 'start',
        startParams: [{ key: 'topic', defaultValue: 'launch' }],
        enabled: true,
        continueOnError: true,
        retryCount: 0,
      },
      {
        agentId: 'agent-1',
        task: 'Draft the summary',
        name: 'Draft summary',
        enabled: true,
        continueOnError: false,
        retryCount: 0,
      },
      {
        agentId: 'agent-2',
        task: 'Review the summary',
        name: 'Review summary',
        enabled: true,
        continueOnError: true,
        retryCount: 1,
        runIf: "previous.status == 'success'",
      },
      {
        agentId: 'agent-2',
        task: '',
        name: 'End',
        nodeType: 'end',
        endOutputs: [{ key: 'result', value: '{{previous.output}}' }],
        enabled: true,
        continueOnError: true,
        retryCount: 0,
      },
    ], [], { 'agent-1': 'Writer', 'agent-2': 'Reviewer' })

    expect(graph.nodes.map((node) => node.id)).toEqual(['step-0', 'step-1', 'step-2', 'step-3'])
    expect(graph.edges).toHaveLength(3)
    expect(graph.edges[1]).toMatchObject({
      id: 'step-1-step-2',
      source: 'step-1',
      target: 'step-2',
      data: {
        successOnly: true,
        condition: "previous.status == 'success'",
      },
    })
  })

  it('keeps a visible vertical gap between auto-laid out workflow cards', () => {
    const graph = convertStepsToFlow([
      {
        agentId: 'agent-1',
        task: 'Draft the summary',
        name: 'Draft summary',
        enabled: true,
        continueOnError: true,
        retryCount: 0,
      },
      {
        agentId: 'agent-2',
        task: 'Review the summary',
        name: 'Review summary',
        enabled: true,
        continueOnError: true,
        retryCount: 0,
      },
      {
        agentId: 'agent-3',
        task: 'Send the final summary',
        name: 'Send summary',
        enabled: true,
        continueOnError: true,
        retryCount: 0,
      },
    ], [], { 'agent-1': 'Writer', 'agent-2': 'Reviewer', 'agent-3': 'Sender' })

    const stepNodes = graph.nodes.filter((node) => node.type === 'pipelineStep')
    expect(stepNodes).toHaveLength(3)

    const sortedByY = [...stepNodes].sort((left, right) => left.position.y - right.position.y)
    const firstGap = sortedByY[1].position.y - sortedByY[0].position.y
    const secondGap = sortedByY[2].position.y - sortedByY[1].position.y

    expect(firstGap).toBeGreaterThanOrEqual(300)
    expect(secondGap).toBeGreaterThanOrEqual(300)
  })
})