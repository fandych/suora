import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'
import type { AgentPipelineStep } from '@/types'
import type { AgentPipelineProgressStep } from '@/services/agentPipelineService'

export type StepStatus = AgentPipelineProgressStep['status']

export interface StepNodeData {
  stepIndex: number
  stepName: string
  agentName: string
  task: string
  status: StepStatus
  retryCount: number
  continueOnError: boolean
  attempts?: number
  hasCondition: boolean
  condition?: string
  enabled: boolean
  durationMs?: number
  [key: string]: unknown
}

export interface TerminalNodeData {
  label: string
  [key: string]: unknown
}

const NODE_WIDTH = 260
const NODE_HEIGHT = 120
const TERMINAL_WIDTH = 100
const TERMINAL_HEIGHT = 44
const RANK_SEP = 60
const NODE_SEP = 40

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1)}…`
}

export function convertStepsToFlow(
  steps: AgentPipelineStep[],
  progressSteps: AgentPipelineProgressStep[],
  agentNameMap: Record<string, string>,
  direction: 'TB' | 'LR' = 'TB',
): { nodes: Node[]; edges: Edge[] } {
  const progressByIndex = new Map(progressSteps.map((s) => [s.stepIndex, s]))

  const nodes: Node[] = []
  const edges: Edge[] = []

  // Start node
  nodes.push({
    id: 'start',
    type: 'terminal',
    data: { label: 'Start' } satisfies TerminalNodeData,
    position: { x: 0, y: 0 },
  })

  // Step nodes
  for (const [index, step] of steps.entries()) {
    const progress = progressByIndex.get(index)
    const status: StepStatus = progress?.status ?? (step.enabled === false ? 'skipped' : 'pending')
    const retryCount = Number.isFinite(step.retryCount) ? Math.max(0, Math.trunc(step.retryCount ?? 0)) : 0

    nodes.push({
      id: `step-${index}`,
      type: 'pipelineStep',
      data: {
        stepIndex: index,
        stepName: step.name?.trim() || `Step ${index + 1}`,
        agentName: progress?.agentName || agentNameMap[step.agentId] || step.agentId,
        task: truncate(step.task || 'No task configured', 100),
        status,
        retryCount,
        continueOnError: step.continueOnError !== false,
        attempts: progress?.attempts,
        hasCondition: !!step.runIf?.trim(),
        condition: step.runIf?.trim(),
        enabled: step.enabled !== false,
        durationMs: progress?.durationMs,
      } satisfies StepNodeData,
      position: { x: 0, y: 0 },
    })
  }

  // End node
  nodes.push({
    id: 'end',
    type: 'terminal',
    data: { label: 'Finish' } satisfies TerminalNodeData,
    position: { x: 0, y: 0 },
  })

  // Edges
  if (steps.length === 0) {
    edges.push({
      id: 'start-end',
      source: 'start',
      target: 'end',
      type: 'pipelineEdge',
    })
  } else {
    // Start → first step
    edges.push({
      id: 'start-step-0',
      source: 'start',
      target: 'step-0',
      type: 'pipelineEdge',
      data: { condition: steps[0]?.runIf?.trim() },
    })

    // Step → Step
    for (let i = 0; i < steps.length - 1; i++) {
      const successOnly = steps[i].continueOnError === false
      const nextCondition = steps[i + 1]?.runIf?.trim()
      edges.push({
        id: `step-${i}-step-${i + 1}`,
        source: `step-${i}`,
        target: `step-${i + 1}`,
        type: 'pipelineEdge',
        data: {
          successOnly,
          condition: nextCondition,
        },
      })
    }

    // Last step → end
    edges.push({
      id: `step-${steps.length - 1}-end`,
      source: `step-${steps.length - 1}`,
      target: 'end',
      type: 'pipelineEdge',
    })
  }

  // Auto-layout with dagre
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: direction,
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
    marginx: 20,
    marginy: 20,
  })
  g.setDefaultEdgeLabel(() => ({}))

  for (const node of nodes) {
    const isTerminal = node.type === 'terminal'
    g.setNode(node.id, {
      width: isTerminal ? TERMINAL_WIDTH : NODE_WIDTH,
      height: isTerminal ? TERMINAL_HEIGHT : NODE_HEIGHT,
    })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  for (const node of nodes) {
    const layoutNode = g.node(node.id)
    const isTerminal = node.type === 'terminal'
    const w = isTerminal ? TERMINAL_WIDTH : NODE_WIDTH
    const h = isTerminal ? TERMINAL_HEIGHT : NODE_HEIGHT
    node.position = {
      x: layoutNode.x - w / 2,
      y: layoutNode.y - h / 2,
    }
  }

  return { nodes, edges }
}
