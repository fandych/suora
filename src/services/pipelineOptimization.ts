import type { AgentPipeline, AgentPipelineStep } from '@/types'
import type { PipelineValidationResult } from '@/services/pipelineValidation'

export type PipelineOptimizationIterationStatus = 'configured' | 'recommended' | 'warning'

export interface PipelineOptimizationIteration {
  iteration: number
  title: string
  status: PipelineOptimizationIterationStatus
  detail: string
}

type PipelineOptimizationInput = Pick<AgentPipeline, 'name' | 'description' | 'steps' | 'variables' | 'budget'>
type PipelineOptimizationValidation = Pick<PipelineValidationResult, 'errors' | 'warnings' | 'enabledSteps'> | undefined

const VARIABLE_REFERENCE_PATTERN = /\{\{\s*vars\.[A-Za-z_][A-Za-z0-9_]*\s*\}\}/
const STEP_REFERENCE_PATTERN = /\{\{\s*(?:previous|last|steps\[\d+\]|step\d+)\.(?:output|input|task|status|error)\s*\}\}/i

function enabledSteps(steps: AgentPipelineStep[]): AgentPipelineStep[] {
  return steps.filter((step) => step.enabled !== false)
}

function countSteps(steps: AgentPipelineStep[], predicate: (step: AgentPipelineStep) => boolean): number {
  return steps.reduce((count, step) => count + (predicate(step) ? 1 : 0), 0)
}

function countDuplicateTasks(steps: AgentPipelineStep[]): number {
  const normalizedTasks = steps.map((step) => step.task.trim().toLowerCase()).filter(Boolean)
  return normalizedTasks.length - new Set(normalizedTasks).size
}

function makeIteration(
  iteration: number,
  title: string,
  status: PipelineOptimizationIterationStatus,
  detail: string,
): PipelineOptimizationIteration {
  return { iteration, title, status, detail }
}

export function buildPipelineOptimizationIterations(
  pipeline: PipelineOptimizationInput,
  validation?: PipelineOptimizationValidation,
): PipelineOptimizationIteration[] {
  const activeSteps = enabledSteps(pipeline.steps)
  const activeStepCount = validation?.enabledSteps ?? activeSteps.length
  const disabledStepCount = pipeline.steps.length - activeSteps.length
  const duplicateTaskCount = countDuplicateTasks(activeSteps)
  const hasBudget = Boolean(pipeline.budget?.maxTotalDurationMs || pipeline.budget?.maxTotalTokens || pipeline.budget?.maxStepCount)
  const declaredVariableCount = pipeline.variables?.length ?? 0
  const stepReferenceCount = countSteps(activeSteps, (step) => STEP_REFERENCE_PATTERN.test(step.task))
  const variableReferenceCount = countSteps(activeSteps, (step) => VARIABLE_REFERENCE_PATTERN.test(step.task) || Boolean(step.runIf?.includes('vars.')))
  const runIfCount = countSteps(activeSteps, (step) => Boolean(step.runIf?.trim()))
  const retryCount = countSteps(activeSteps, (step) => (step.retryCount ?? 0) > 0)
  const backoffCount = countSteps(activeSteps, (step) => (step.retryBackoffMs ?? 0) > 0)
  const timeoutCount = countSteps(activeSteps, (step) => (step.timeoutMs ?? 0) > 0)
  const inputBudgetCount = countSteps(activeSteps, (step) => (step.maxInputChars ?? 0) > 0)
  const outputBudgetCount = countSteps(activeSteps, (step) => (step.maxOutputChars ?? 0) > 0)
  const modelOverrideCount = countSteps(activeSteps, (step) => Boolean(step.modelId))
  const transformCount = countSteps(activeSteps, (step) => Boolean(step.outputTransform))
  const exportVarCount = countSteps(activeSteps, (step) => Boolean(step.exportVar?.trim()))
  const stopOnErrorCount = countSteps(activeSteps, (step) => step.continueOnError === false)
  const warningCount = validation?.warnings.length ?? 0
  const errorCount = validation?.errors.length ?? 0

  return [
    makeIteration(
      1,
      'Name and intent',
      pipeline.name.trim() && pipeline.description?.trim() ? 'configured' : 'recommended',
      pipeline.name.trim() && pipeline.description?.trim()
        ? `Pipeline "${pipeline.name.trim()}" has a description that explains its intent.`
        : 'Add a concise name and description so saved runs, timers, and handoffs remain understandable.',
    ),
    makeIteration(
      2,
      'Step coverage',
      activeStepCount > 0 ? 'configured' : 'warning',
      activeStepCount > 0
        ? `${activeStepCount} enabled step(s) are ready to execute.`
        : 'Enable at least one step before running the pipeline.',
    ),
    makeIteration(
      3,
      'Validation blockers',
      errorCount === 0 ? 'configured' : 'warning',
      errorCount === 0
        ? 'No blocking validation errors were found.'
        : `Fix ${errorCount} validation error(s) before saving or running.`,
    ),
    makeIteration(
      4,
      'Validation warnings',
      warningCount === 0 ? 'configured' : 'recommended',
      warningCount === 0
        ? 'No validation warnings are currently reported.'
        : `Review ${warningCount} warning(s) to avoid surprising runtime behavior.`,
    ),
    makeIteration(
      5,
      'Variable design',
      declaredVariableCount > 0 ? 'configured' : 'recommended',
      declaredVariableCount > 0
        ? `${declaredVariableCount} runtime variable(s) are declared for reusable inputs.`
        : 'Declare variables for inputs that change between manual, timer, and chat-triggered runs.',
    ),
    makeIteration(
      6,
      'Variable usage',
      variableReferenceCount > 0 || declaredVariableCount === 0 ? 'configured' : 'recommended',
      variableReferenceCount > 0
        ? `${variableReferenceCount} step(s) reference pipeline variables.`
        : declaredVariableCount === 0
          ? 'No variables are declared, so there are no unused variable references to review.'
          : 'Use declared variables in task templates or runIf conditions to make the pipeline dynamic.',
    ),
    makeIteration(
      7,
      'Upstream references',
      stepReferenceCount > 0 || activeStepCount <= 1 ? 'configured' : 'recommended',
      stepReferenceCount > 0
        ? `${stepReferenceCount} step(s) explicitly reference upstream outputs.`
        : activeStepCount <= 1
          ? 'Single-step pipelines do not need upstream handoff references.'
          : 'Insert explicit step references when downstream prompts need a specific upstream result.',
    ),
    makeIteration(
      8,
      'Conditional branching',
      runIfCount > 0 || activeStepCount <= 1 ? 'configured' : 'recommended',
      runIfCount > 0
        ? `${runIfCount} step(s) use runIf conditions for branching.`
        : activeStepCount <= 1
          ? 'Branch conditions are optional for a single-step pipeline.'
          : 'Add runIf conditions to skip expensive or irrelevant downstream work.',
    ),
    makeIteration(
      9,
      'Retry resilience',
      retryCount > 0 ? 'configured' : 'recommended',
      retryCount > 0
        ? `${retryCount} step(s) retry transient provider failures.`
        : 'Configure retries for network-sensitive or tool-heavy steps.',
    ),
    makeIteration(
      10,
      'Retry pacing',
      backoffCount > 0 || retryCount === 0 ? 'configured' : 'recommended',
      backoffCount > 0
        ? `${backoffCount} step(s) include retry backoff pacing.`
        : retryCount === 0
          ? 'No retrying steps need backoff pacing yet.'
          : 'Add fixed or exponential backoff so retries do not hammer providers.',
    ),
    makeIteration(
      11,
      'Timeout limits',
      timeoutCount > 0 ? 'configured' : 'recommended',
      timeoutCount > 0
        ? `${timeoutCount} step(s) define explicit timeout limits.`
        : 'Set timeouts for long-running steps to keep failed runs bounded.',
    ),
    makeIteration(
      12,
      'Input budgets',
      inputBudgetCount > 0 ? 'configured' : 'recommended',
      inputBudgetCount > 0
        ? `${inputBudgetCount} step(s) cap prompt input size.`
        : 'Set max input sizes for steps that consume large upstream outputs.',
    ),
    makeIteration(
      13,
      'Output budgets',
      outputBudgetCount > 0 ? 'configured' : 'recommended',
      outputBudgetCount > 0
        ? `${outputBudgetCount} step(s) cap downstream output size.`
        : 'Set max output sizes to avoid oversized handoffs and saved histories.',
    ),
    makeIteration(
      14,
      'Model routing',
      modelOverrideCount > 0 ? 'configured' : 'recommended',
      modelOverrideCount > 0
        ? `${modelOverrideCount} step(s) override the agent model for cost or capability control.`
        : 'Use model overrides when some steps can run on cheaper or specialized models.',
    ),
    makeIteration(
      15,
      'Output transforms',
      transformCount > 0 ? 'configured' : 'recommended',
      transformCount > 0
        ? `${transformCount} step(s) normalize output before handoff.`
        : 'Add output transforms to extract concise lines or JSON fields for downstream prompts.',
    ),
    makeIteration(
      16,
      'Exported variables',
      exportVarCount > 0 ? 'configured' : 'recommended',
      exportVarCount > 0
        ? `${exportVarCount} step(s) publish outputs as named variables.`
        : 'Export important outputs into variables when several later steps reuse the same value.',
    ),
    makeIteration(
      17,
      'Failure policy',
      stopOnErrorCount > 0 ? 'configured' : 'recommended',
      stopOnErrorCount > 0
        ? `${stopOnErrorCount} step(s) stop the run on failure.`
        : 'Mark critical steps as stop-on-error so invalid upstream results do not cascade.',
    ),
    makeIteration(
      18,
      'Disabled step cleanup',
      disabledStepCount === 0 ? 'configured' : 'recommended',
      disabledStepCount === 0
        ? 'No disabled steps are lingering in the pipeline.'
        : `Review ${disabledStepCount} disabled step(s): remove stale work or re-enable planned branches.`,
    ),
    makeIteration(
      19,
      'Duplicate task review',
      duplicateTaskCount === 0 ? 'configured' : 'recommended',
      duplicateTaskCount === 0
        ? 'Enabled step tasks are unique after trimming.'
        : `Review ${duplicateTaskCount} duplicate task(s) to avoid redundant model calls.`,
    ),
    makeIteration(
      20,
      'Whole-run budget',
      hasBudget ? 'configured' : 'recommended',
      hasBudget
        ? 'Whole-pipeline budget caps are configured for duration, tokens, or step count.'
        : 'Add total duration, token, or step caps to protect long automated runs.',
    ),
  ]
}
