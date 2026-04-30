import type { AgentPipelineStep } from '@/types'
import type { AgentPipelineProgressStep } from '@/services/agentPipelineService'

type MermaidStepStatus = AgentPipelineProgressStep['status']

export interface BuildPipelineMermaidOptions {
  pipelineName?: string
  description?: string
  direction?: 'TD' | 'LR'
  agentNameMap?: Record<string, string>
  progressSteps?: AgentPipelineProgressStep[]
}

const STATUS_CLASS: Record<MermaidStepStatus, string> = {
  pending: 'pending',
  running: 'running',
  success: 'success',
  error: 'error',
  skipped: 'skipped',
}

function normalizeLabel(value: string, fallback: string): string {
  const normalized = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/[`"\\[\]{}|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || fallback
}

function truncateLabel(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}...`
}

function buildStepLabel(
  step: AgentPipelineStep,
  index: number,
  agentNameMap: Record<string, string>,
  progressStep?: AgentPipelineProgressStep,
): string {
  const stepName = normalizeLabel(step.name ?? '', `Step ${index + 1}`)
  const agentName = normalizeLabel(agentNameMap[step.agentId] ?? progressStep?.agentName ?? step.agentId, 'Unknown agent')
  const status = progressStep?.status ?? (step.enabled === false ? 'skipped' : 'pending')
  const retryCount = Number.isFinite(step.retryCount) ? Math.max(0, Math.trunc(step.retryCount ?? 0)) : 0
  const policy = step.continueOnError === false ? 'stop on error' : 'continue on error'
  const task = truncateLabel(normalizeLabel(step.task, 'No task configured'), 82)
  const condition = step.runIf?.trim()
    ? `if ${truncateLabel(normalizeLabel(step.runIf, ''), 60)}`
    : undefined
  const details = [status, retryCount > 0 ? `${retryCount} retry` : undefined, policy, condition]
    .filter(Boolean)
    .join(' · ')

  return `${index + 1}. ${stepName}<br/>${agentName}<br/>${task}<br/>${details}`
}

export function buildPipelineMermaidSource(
  steps: AgentPipelineStep[],
  options: BuildPipelineMermaidOptions = {},
): string {
  const direction = options.direction ?? 'TD'
  const agentNameMap = options.agentNameMap ?? {}
  const progressByIndex = new Map(options.progressSteps?.map((step) => [step.stepIndex, step]) ?? [])
  const title = normalizeLabel(options.pipelineName ?? '', 'Draft Pipeline')
  const description = normalizeLabel(options.description ?? '', '')
  const lines = [
    `flowchart ${direction}`,
    `  %% ${title}`,
  ]

  if (description) {
    lines.push(`  %% ${truncateLabel(description, 140)}`)
  }

  lines.push(
    '  start([Start])',
    '  finish([Finish])',
  )

  if (steps.length === 0) {
    lines.push('  start --> finish')
  } else {
    for (const [index, step] of steps.entries()) {
      const progressStep = progressByIndex.get(index)
      const nodeId = `step${index + 1}`
      lines.push(`  ${nodeId}["${buildStepLabel(step, index, agentNameMap, progressStep)}"]`)
    }

    lines.push(`  start --> step1`)
    for (let index = 0; index < steps.length - 1; index += 1) {
      const current = `step${index + 1}`
      const next = `step${index + 2}`
      const conditional = steps[index + 1]?.runIf?.trim()
      const successOnly = steps[index].continueOnError === false
      const labelParts = [
        successOnly ? 'success' : '',
        conditional ? `if ${truncateLabel(normalizeLabel(conditional, ''), 36)}` : '',
      ].filter(Boolean)
      const edgeLabel = labelParts.length > 0 ? `|${labelParts.join(' / ')}|` : ''
      lines.push(`  ${current} -->${edgeLabel} ${next}`)
    }
    lines.push(`  step${steps.length} --> finish`)
  }

  lines.push(
    '  classDef pending fill:#334155,stroke:#64748b,color:#e2e8f0',
    '  classDef running fill:#92400e,stroke:#f59e0b,color:#fffbeb',
    '  classDef success fill:#065f46,stroke:#10b981,color:#ecfdf5',
    '  classDef error fill:#7f1d1d,stroke:#ef4444,color:#fef2f2',
    '  classDef skipped fill:#1f2937,stroke:#6b7280,color:#d1d5db',
  )

  for (const [index, step] of steps.entries()) {
    const status = progressByIndex.get(index)?.status ?? (step.enabled === false ? 'skipped' : 'pending')
    lines.push(`  class step${index + 1} ${STATUS_CLASS[status]};`)
  }

  return lines.join('\n')
}