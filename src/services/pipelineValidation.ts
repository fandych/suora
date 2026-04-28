import type { Agent, AgentPipeline, AgentPipelineStep, Model, PipelineRecoveryAction } from '@/types'
import { extractVariableReferences, validateRunIfSyntax } from '@/services/pipelineRunIf'

export type PipelineValidationSeverity = 'error' | 'warning'

export interface PipelineValidationIssue {
  severity: PipelineValidationSeverity
  code: string
  message: string
  stepIndex?: number
  recoveryActions?: PipelineRecoveryAction[]
}

export interface PipelineValidationResult {
  valid: boolean
  issues: PipelineValidationIssue[]
  warnings: PipelineValidationIssue[]
  errors: PipelineValidationIssue[]
  enabledSteps: number
}

const STEP_REFERENCE_PATTERN = /\{\{\s*(?:steps\[(\d+)\]|step(\d+))\.(output|input|task|status|error)\s*\}\}/gi

function hasInvalidBudget(value: unknown): boolean {
  return value !== undefined && (!Number.isFinite(value) || Number(value) <= 0)
}

const VALID_VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

export function validateAgentPipeline(
  pipeline: Pick<AgentPipeline, 'name' | 'steps' | 'variables' | 'budget'>,
  agents: Agent[],
  models: Model[],
): PipelineValidationResult {
  const issues: PipelineValidationIssue[] = []
  const enabledSteps = pipeline.steps.filter((step) => step.enabled !== false)

  if (enabledSteps.length === 0) {
    issues.push({ severity: 'error', code: 'empty-pipeline', message: 'Pipeline has no enabled steps.' })
  }

  if (pipeline.budget) {
    const budgetKeys = ['maxTotalDurationMs', 'maxTotalTokens', 'maxStepCount'] as const
    for (const key of budgetKeys) {
      const value = pipeline.budget[key]
      if (value === undefined) continue
      if (!Number.isFinite(value) || (value as number) < 0 || !Number.isInteger(value)) {
        issues.push({
          severity: 'error',
          code: 'invalid-budget',
          message: `Pipeline budget "${key}" must be a non-negative integer.`,
        })
      }
    }
    const stepCap = pipeline.budget.maxStepCount
    if (typeof stepCap === 'number' && stepCap > 0 && enabledSteps.length > stepCap) {
      issues.push({
        severity: 'warning',
        code: 'budget-step-count-too-low',
        message: `Pipeline budget caps execution at ${stepCap} step(s) but ${enabledSteps.length} are enabled — later steps will be skipped.`,
      })
    }
  }

  const declaredVariableNames = new Set<string>()
  ;(pipeline.variables ?? []).forEach((variable, variableIndex) => {
    if (!variable.name || !VALID_VARIABLE_NAME.test(variable.name)) {
      issues.push({
        severity: 'error',
        code: 'invalid-variable-name',
        message: `Variable #${variableIndex + 1} has an invalid name. Use letters, digits, and underscores only.`,
      })
      return
    }
    if (declaredVariableNames.has(variable.name)) {
      issues.push({
        severity: 'error',
        code: 'duplicate-variable',
        message: `Variable "${variable.name}" is declared more than once.`,
      })
      return
    }
    declaredVariableNames.add(variable.name)
  })

  pipeline.steps.forEach((step: AgentPipelineStep, index) => {
    if (step.enabled === false) return
    const agent = agents.find((item) => item.id === step.agentId)
    if (!step.task.trim()) {
      issues.push({ severity: 'error', code: 'empty-task', stepIndex: index, message: `Step ${index + 1} has an empty task.` })
    }
    if (!agent) {
      issues.push({
        severity: 'error',
        code: 'missing-agent',
        stepIndex: index,
        message: `Step ${index + 1} references a missing agent.`,
        recoveryActions: [{ id: 'edit-pipeline', label: 'Choose another agent', stepIndex: index }],
      })
    } else {
      const model = agent.modelId ? models.find((item) => item.id === agent.modelId) : models.find((item) => item.isDefault) ?? models[0]
      if (!model) {
        issues.push({
          severity: 'error',
          code: 'missing-model',
          stepIndex: index,
          message: `Step ${index + 1} agent "${agent.name}" has no runnable model.`,
          recoveryActions: [{ id: 'open-agent', label: 'Open agent configuration', agentId: agent.id, stepIndex: index }],
        })
      }
    }

    if (hasInvalidBudget(step.timeoutMs)) issues.push({ severity: 'error', code: 'invalid-timeout', stepIndex: index, message: `Step ${index + 1} timeout must be a positive number.` })
    if (hasInvalidBudget(step.maxInputChars)) issues.push({ severity: 'error', code: 'invalid-max-input', stepIndex: index, message: `Step ${index + 1} max input chars must be positive.` })
    if (hasInvalidBudget(step.maxOutputChars)) issues.push({ severity: 'error', code: 'invalid-max-output', stepIndex: index, message: `Step ${index + 1} max output chars must be positive.` })

    if (step.modelId) {
      const overridden = models.find((model) => model.id === step.modelId)
      if (!overridden) {
        issues.push({
          severity: 'error',
          code: 'invalid-step-model',
          stepIndex: index,
          message: `Step ${index + 1} references an unknown model.`,
          recoveryActions: [{ id: 'edit-pipeline', label: 'Choose a model', stepIndex: index }],
        })
      } else if (overridden.enabled === false) {
        issues.push({
          severity: 'warning',
          code: 'disabled-step-model',
          stepIndex: index,
          message: `Step ${index + 1} model "${overridden.name}" is disabled — the agent's default model will be used.`,
        })
      }
    }

    if (step.outputTransform !== undefined) {
      const validTransforms = ['trim', 'first-line', 'last-line', 'json-path'] as const
      if (!(validTransforms as readonly string[]).includes(step.outputTransform)) {
        issues.push({
          severity: 'error',
          code: 'invalid-output-transform',
          stepIndex: index,
          message: `Step ${index + 1} output transform must be one of ${validTransforms.join(', ')}.`,
        })
      } else if (step.outputTransform === 'json-path' && !(step.outputTransformPath?.trim())) {
        issues.push({
          severity: 'error',
          code: 'missing-transform-path',
          stepIndex: index,
          message: `Step ${index + 1} json-path transform requires an outputTransformPath (e.g. "data.items.0.name").`,
        })
      }
    }

    if (step.retryBackoffMs !== undefined) {
      if (!Number.isFinite(step.retryBackoffMs) || step.retryBackoffMs < 0) {
        issues.push({
          severity: 'error',
          code: 'invalid-retry-backoff',
          stepIndex: index,
          message: `Step ${index + 1} retry backoff must be zero or a positive number of milliseconds.`,
        })
      } else if (step.retryBackoffMs > 60_000) {
        issues.push({
          severity: 'warning',
          code: 'long-retry-backoff',
          stepIndex: index,
          message: `Step ${index + 1} retry backoff exceeds 60s and will be capped by the runtime.`,
        })
      }
    }

    if (step.retryBackoffStrategy !== undefined && step.retryBackoffStrategy !== 'fixed' && step.retryBackoffStrategy !== 'exponential') {
      issues.push({
        severity: 'error',
        code: 'invalid-retry-strategy',
        stepIndex: index,
        message: `Step ${index + 1} retry strategy must be either "fixed" or "exponential".`,
      })
    }

    for (const match of step.task.matchAll(STEP_REFERENCE_PATTERN)) {
      const referenceIndex = Number(match[1] ?? match[2])
      if (!Number.isFinite(referenceIndex) || referenceIndex < 1 || referenceIndex > pipeline.steps.length) {
        issues.push({ severity: 'error', code: 'invalid-reference', stepIndex: index, message: `Step ${index + 1} references a step that does not exist.` })
      } else if (referenceIndex - 1 >= index) {
        issues.push({ severity: 'error', code: 'forward-reference', stepIndex: index, message: `Step ${index + 1} references a future step.` })
      }
    }

    // Validate `{{vars.X}}` references in the task body and runIf condition.
    const referencedVariables = new Set<string>([
      ...extractVariableReferences(step.task),
      ...extractVariableReferences(step.runIf),
    ])
    for (const variableName of referencedVariables) {
      if (!declaredVariableNames.has(variableName)) {
        issues.push({
          severity: 'error',
          code: 'unknown-variable',
          stepIndex: index,
          message: `Step ${index + 1} references undeclared variable "${variableName}".`,
          recoveryActions: [{ id: 'edit-pipeline', label: 'Declare variable', stepIndex: index }],
        })
      }
    }

    // Validate runIf syntax.
    const runIfError = validateRunIfSyntax(step.runIf)
    if (runIfError) {
      issues.push({
        severity: 'error',
        code: 'invalid-run-if',
        stepIndex: index,
        message: `Step ${index + 1} has an invalid runIf condition: ${runIfError}`,
        recoveryActions: [{ id: 'edit-pipeline', label: 'Edit condition', stepIndex: index }],
      })
    }

    if ((step.maxInputChars ?? 0) > 120_000 || (step.maxOutputChars ?? 0) > 120_000) {
      issues.push({ severity: 'warning', code: 'large-budget', stepIndex: index, message: `Step ${index + 1} has a very large context budget.` })
    }
  })

  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')
  return { valid: errors.length === 0, issues, errors, warnings, enabledSteps: enabledSteps.length }
}

export function buildPipelineRecoveryActions(stepIndex: number, agentId?: string, modelId?: string): PipelineRecoveryAction[] {
  return [
    { id: 'retry-step', label: 'Retry this step', stepIndex },
    { id: 'rerun-from-step', label: 'Rerun from this step', stepIndex },
    { id: 'skip-step', label: 'Skip and continue', stepIndex },
    ...(agentId ? [{ id: 'open-agent' as const, label: 'Open agent configuration', stepIndex, agentId }] : []),
    ...(modelId ? [{ id: 'open-model' as const, label: 'Open model settings', stepIndex, modelId }] : []),
  ]
}