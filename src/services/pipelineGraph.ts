import { getPipelineNodeType } from '@/components/pipeline/pipelineNodeBehaviors'
import type { AgentPipelineStep, AgentPipelineStepTransition } from '@/types'
import { generateId } from '@/utils/helpers'

export interface MaterializedAgentPipelineStep extends AgentPipelineStep {
  id: string
  transitions: AgentPipelineStepTransition[]
}

function sanitizeTransition(transition: AgentPipelineStepTransition | null | undefined): AgentPipelineStepTransition | null {
  if (!transition?.targetStepId?.trim()) return null
  return {
    targetStepId: transition.targetStepId.trim(),
    ...(transition.label?.trim() ? { label: transition.label.trim() } : {}),
    ...(transition.sourceHandle?.trim() ? { sourceHandle: transition.sourceHandle.trim() } : {}),
  }
}

function buildDefaultLinearTransitions(steps: Array<Pick<AgentPipelineStep, 'id'>>): AgentPipelineStepTransition[][] {
  return steps.map((step, index) => {
    const nextStep = steps[index + 1]
    if (!step.id || !nextStep?.id) return []
    return [{ targetStepId: nextStep.id }]
  })
}

export function getPipelineStepId(step: Pick<AgentPipelineStep, 'id'>, index: number): string {
  return step.id?.trim() || `legacy-step-${index}`
}

export function materializePipelineGraph(steps: AgentPipelineStep[]): MaterializedAgentPipelineStep[] {
  const withIds: MaterializedAgentPipelineStep[] = steps.map((step, index) => ({
    ...step,
    id: getPipelineStepId(step, index),
    transitions: [],
  }))

  const hasExplicitTransitions = steps.some((step) => Array.isArray(step.transitions))
  const defaultTransitions = buildDefaultLinearTransitions(withIds)

  return withIds.map((step, index) => {
    const rawTransitions = Array.isArray((steps[index] as AgentPipelineStep).transitions)
      ? ((steps[index] as AgentPipelineStep).transitions ?? []).map(sanitizeTransition).filter(Boolean) as AgentPipelineStepTransition[]
      : []

    return {
      ...step,
      transitions: hasExplicitTransitions ? rawTransitions : defaultTransitions[index],
    }
  })
}

export function ensureEditablePipelineGraph(steps: AgentPipelineStep[]): AgentPipelineStep[] {
  const withIds = steps.map((step) => ({
    ...step,
    id: step.id?.trim() || generateId('pipe-node'),
  }))
  const materialized = materializePipelineGraph(withIds)
  return materialized.map((step) => ({
    ...step,
    transitions: step.transitions.map((transition) => ({ ...transition })),
  }))
}

export function buildIncomingTransitionMap(steps: AgentPipelineStep[]): Map<string, string[]> {
  const materialized = materializePipelineGraph(steps)
  const incoming = new Map<string, string[]>()

  materialized.forEach((step) => {
    step.transitions.forEach((transition) => {
      const entries = incoming.get(transition.targetStepId) ?? []
      entries.push(step.id)
      incoming.set(transition.targetStepId, entries)
    })
  })

  return incoming
}

export function getPipelineEntryStepId(steps: AgentPipelineStep[]): string | null {
  const materialized = materializePipelineGraph(steps)
  const start = materialized.find((step) => getPipelineNodeType(step) === 'start')
  return start?.id ?? materialized[0]?.id ?? null
}

function getConditionBranchHandles(step: AgentPipelineStep): string[] {
  const configured = (step.conditionBranches ?? [])
    .map((branch) => branch.key.trim())
    .filter(Boolean)

  return configured.length > 0 ? configured : ['true', 'false']
}

export function upsertPipelineTransition(
  steps: AgentPipelineStep[],
  sourceIndex: number,
  targetIndex: number,
): AgentPipelineStep[] {
  if (sourceIndex === targetIndex || sourceIndex < 0 || targetIndex < 0 || sourceIndex >= steps.length || targetIndex >= steps.length) {
    return ensureEditablePipelineGraph(steps)
  }

  const materialized = ensureEditablePipelineGraph(steps) as MaterializedAgentPipelineStep[]
  const sourceStep = materialized[sourceIndex]
  const targetStep = materialized[targetIndex]
  const nodeType = getPipelineNodeType(sourceStep)
  const existing = sourceStep.transitions.filter((transition) => transition.targetStepId !== targetStep.id)

  if (nodeType === 'end') {
    return materialized
  }

  if (nodeType === 'parallel') {
    sourceStep.transitions = [...existing, { targetStepId: targetStep.id }]
  } else if (nodeType === 'condition') {
    const branchHandles = getConditionBranchHandles(sourceStep)
    const limited = [...existing, { targetStepId: targetStep.id }].slice(-branchHandles.length)
    sourceStep.transitions = limited.map((transition, index) => ({
      ...transition,
      sourceHandle: branchHandles[index] ?? branchHandles[branchHandles.length - 1] ?? `branch-${index + 1}`,
    }))
  } else if (nodeType === 'webhook') {
    const successTransitions = existing.filter((transition) => transition.sourceHandle !== 'error')
    const errorTransitions = existing.filter((transition) => transition.sourceHandle === 'error')
    if (successTransitions.length === 0) {
      sourceStep.transitions = [{ targetStepId: targetStep.id }, ...errorTransitions.slice(0, 1)]
    } else {
      sourceStep.transitions = [successTransitions[0], { targetStepId: targetStep.id, sourceHandle: 'error', label: 'Failure' }]
    }
  } else {
    sourceStep.transitions = [{ targetStepId: targetStep.id }]
  }

  return materialized.map((step) => ({
    ...step,
    transitions: step.transitions.map((transition) => ({ ...transition })),
  }))
}

export function removePipelineTransition(
  steps: AgentPipelineStep[],
  sourceIndex: number,
  targetIndex: number,
): AgentPipelineStep[] {
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex >= steps.length || targetIndex >= steps.length) {
    return ensureEditablePipelineGraph(steps)
  }

  const materialized = ensureEditablePipelineGraph(steps) as MaterializedAgentPipelineStep[]
  const sourceStep = materialized[sourceIndex]
  const targetStep = materialized[targetIndex]
  sourceStep.transitions = sourceStep.transitions.filter((transition) => transition.targetStepId !== targetStep.id)

  return materialized.map((step) => ({
    ...step,
    transitions: step.transitions.map((transition) => ({ ...transition })),
  }))
}

export function getIncomingSourceStepIds(steps: AgentPipelineStep[], targetStepId: string): string[] {
  return buildIncomingTransitionMap(steps).get(targetStepId) ?? []
}