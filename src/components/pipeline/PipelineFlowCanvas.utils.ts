import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'
import type { AgentPipelineStep } from '@/types'
import type { AgentPipelineProgressStep } from '@/services/agentPipelineService'
import { buildIncomingTransitionMap, materializePipelineGraph } from '@/services/pipelineGraph'
import type { PipelineValidationIssue } from '@/services/pipelineValidation'
import type { PipelineNodeType } from './pipelineNodeLibrary'
import { getMissingNodeRequirements, isNodeConfigurationReady } from './pipelineNodeBehaviors'

export type StepStatus = AgentPipelineProgressStep['status']

export interface StepNodeData {
  nodeType?: NonNullable<AgentPipelineStep['nodeType']>
  stepIndex: number
  stepName: string
  agentName: string
  agentLabel?: string
  task: string
  onSelect?: () => void
  isSelected?: boolean
  canInsertAfter?: boolean
  onInsertAfter?: (nodeType: PipelineNodeType) => void
  status: StepStatus
  retryCount: number
  continueOnError: boolean
  attempts?: number
  hasCondition: boolean
  condition?: string
  enabled: boolean
  durationMs?: number
  configReady?: boolean
  missingRequirements?: string[]
  isUnreachable?: boolean
  [key: string]: unknown
}

const NODE_WIDTH = 300
const NODE_HEIGHT = 196
const RANK_SEP = 130
const NODE_SEP = 96

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1)}…`
}

function getNodeSubtitle(step: AgentPipelineStep, agentNameMap: Record<string, string>, fallbackAgentName?: string): string {
  const resolvedAgentName = fallbackAgentName || agentNameMap[step.agentId] || step.agentId

  switch (step.nodeType) {
    case 'condition':
      return 'Conditional branch'
    case 'pipeline':
      return 'Nested pipeline call'
    case 'toolset':
      return 'Workspace tool execution'
    case 'script':
      return 'Local script execution'
    case 'code':
      return 'Sandboxed code transform'
    case 'template':
      return 'Template rendering'
    case 'variable':
      return 'Workflow variable assignment'
    case 'iteration':
      return 'Array iteration with child pipeline'
    case 'http':
      return 'External API request'
    case 'webhook':
      return 'Outgoing webhook delivery'
    case 'email':
      return 'Email delivery step'
    case 'rag':
      return 'Knowledge base retrieval'
    case 'wiki':
      return 'Wiki/document search'
    case 'parallel':
      return 'Parallel branch fan-out'
    case 'join':
      return 'Branch merge point'
    case 'start':
      return 'Workflow entry'
    case 'end':
      return 'Workflow exit'
    case 'agent':
    default:
      return resolvedAgentName
  }
}

export function convertStepsToFlow(
  steps: AgentPipelineStep[],
  progressSteps: AgentPipelineProgressStep[],
  agentNameMap: Record<string, string>,
  direction: 'TB' | 'LR' = 'TB',
  selectedStepIndex?: number,
  validationIssues: PipelineValidationIssue[] = [],
): { nodes: Node[]; edges: Edge[] } {
  const materializedSteps = materializePipelineGraph(steps)
  const progressByIndex = new Map(progressSteps.map((s) => [s.stepIndex, s]))
  const stepIndexById = new Map(materializedSteps.map((step, index) => [step.id, index]))
  const incomingByStepId = buildIncomingTransitionMap(materializedSteps)
  const unreachableStepIndices = new Set(validationIssues.filter((issue) => issue.code === 'unreachable-node' && typeof issue.stepIndex === 'number').map((issue) => issue.stepIndex as number))

  const nodes: Node[] = []
  const edges: Edge[] = []

  // Step nodes
  for (const [index, step] of materializedSteps.entries()) {
    const progress = progressByIndex.get(index)
    const status: StepStatus = progress?.status ?? (step.enabled === false ? 'skipped' : 'pending')
    const retryCount = Number.isFinite(step.retryCount) ? Math.max(0, Math.trunc(step.retryCount ?? 0)) : 0

    const resolvedAgentName = progress?.agentName || agentNameMap[step.agentId] || step.agentId
    const missingRequirements = getMissingNodeRequirements(step)

    nodes.push({
      id: `step-${index}`,
      type: 'pipelineStep',
      data: {
        nodeType: step.nodeType ?? 'agent',
        stepIndex: index,
        stepName: step.name?.trim() || `Step ${index + 1}`,
        agentName: getNodeSubtitle(step, agentNameMap, resolvedAgentName),
        agentLabel: resolvedAgentName,
        task: truncate(step.task || 'No task configured', 100),
        isSelected: selectedStepIndex === index,
        status,
        retryCount,
        continueOnError: step.continueOnError !== false,
        attempts: progress?.attempts,
        hasCondition: !!step.runIf?.trim(),
        condition: step.runIf?.trim(),
        enabled: step.enabled !== false,
        durationMs: progress?.durationMs,
        configReady: isNodeConfigurationReady(step),
        missingRequirements,
        isUnreachable: unreachableStepIndices.has(index),
      } satisfies StepNodeData,
      position: { x: 0, y: 0 },
    })
  }

  // Edges
  for (const [index, step] of materializedSteps.entries()) {
    step.transitions.forEach((transition, transitionIndex) => {
      const targetIndex = stepIndexById.get(transition.targetStepId)
      if (targetIndex === undefined) return
      const targetStep = materializedSteps[targetIndex]
      const label = step.nodeType === 'condition'
        ? ((step.conditionBranches ?? []).find((branch) => branch.key === transition.sourceHandle)?.label
          ?? (transition.sourceHandle === 'false' ? step.conditionFalseLabel ?? 'False' : step.conditionTrueLabel ?? 'True'))
        : transition.sourceHandle === 'error'
          ? 'Failure'
        : transition.label
      edges.push({
        id: `step-${index}-step-${targetIndex}${transitionIndex > 0 ? `-${transitionIndex}` : ''}`,
        source: `step-${index}`,
        target: `step-${targetIndex}`,
        type: 'pipelineEdge',
        data: {
          successOnly: step.continueOnError === false,
          condition: targetStep.runIf?.trim(),
          label,
          isErrorPath: transition.sourceHandle === 'error',
          inboundCount: incomingByStepId.get(targetStep.id)?.length ?? 0,
        },
      })
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
    g.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  for (const node of nodes) {
    const layoutNode = g.node(node.id)
    node.position = {
      x: layoutNode.x - NODE_WIDTH / 2,
      y: layoutNode.y - NODE_HEIGHT / 2,
    }
  }

  return { nodes, edges }
}
