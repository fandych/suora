import type { AgentPipeline, AgentPipelineBudget, AgentPipelineStep, AgentPipelineVariable } from '@/types'
import { generateId } from '@/utils/helpers'

/**
 * Stable schema version for exported pipelines. Increment when the export
 * shape changes incompatibly so importers can migrate or reject old payloads.
 */
export const PIPELINE_EXPORT_SCHEMA_VERSION = 1

export interface PipelineExportEnvelope {
  schemaVersion: number
  exportedAt: number
  exportedBy: 'suora'
  pipeline: ExportedPipeline
}

export interface ExportedPipeline {
  name: string
  description?: string
  steps: AgentPipelineStep[]
  variables?: AgentPipelineVariable[]
  budget?: AgentPipelineBudget
}

export interface ImportPipelineOptions {
  /** Optional override for the imported pipeline name (e.g. when duplicating). */
  name?: string
  /**
   * If true (default), assigns a fresh `id` and `createdAt`/`updatedAt` so the
   * import does not collide with an existing pipeline. Set to false only when
   * round-tripping internally.
   */
  regenerateId?: boolean
}

export interface ImportPipelineResult {
  pipeline: AgentPipeline
  warnings: string[]
}

export class PipelineImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PipelineImportError'
  }
}

/**
 * Strip runtime-specific fields (id, timestamps) from a pipeline so the
 * exported JSON is portable across workspaces.
 */
export function buildPipelineExport(pipeline: AgentPipeline): PipelineExportEnvelope {
  const exported: ExportedPipeline = {
    name: pipeline.name,
    ...(pipeline.description ? { description: pipeline.description } : {}),
    steps: pipeline.steps.map(cloneStep),
    ...(pipeline.variables && pipeline.variables.length > 0
      ? { variables: pipeline.variables.map((variable) => ({ ...variable })) }
      : {}),
    ...(pipeline.budget && hasBudgetValues(pipeline.budget) ? { budget: { ...pipeline.budget } } : {}),
  }

  return {
    schemaVersion: PIPELINE_EXPORT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    exportedBy: 'suora',
    pipeline: exported,
  }
}

export function serializePipelineExport(pipeline: AgentPipeline): string {
  return JSON.stringify(buildPipelineExport(pipeline), null, 2)
}

/**
 * Parse a JSON string into an importable pipeline. Tolerates two shapes:
 * the wrapped envelope produced by `buildPipelineExport`, or a bare
 * `AgentPipeline`-shaped object (so a copy/paste from disk also works).
 *
 * Throws `PipelineImportError` with a human-readable message on any failure.
 */
export function parsePipelineImport(rawJson: string, options: ImportPipelineOptions = {}): ImportPipelineResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch (error) {
    throw new PipelineImportError(`Invalid JSON: ${(error as Error).message}`)
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new PipelineImportError('Pipeline payload must be an object.')
  }

  const warnings: string[] = []
  const candidate = (parsed as Record<string, unknown>).pipeline ?? parsed
  if (!candidate || typeof candidate !== 'object') {
    throw new PipelineImportError('Could not find a pipeline object in the payload.')
  }

  const envelope = parsed as Partial<PipelineExportEnvelope>
  if (typeof envelope.schemaVersion === 'number' && envelope.schemaVersion > PIPELINE_EXPORT_SCHEMA_VERSION) {
    warnings.push(`Payload uses pipeline schema v${envelope.schemaVersion}; this build supports up to v${PIPELINE_EXPORT_SCHEMA_VERSION}. Unknown fields will be ignored.`)
  }

  const source = candidate as Partial<AgentPipeline>
  if (typeof source.name !== 'string' || !source.name.trim()) {
    throw new PipelineImportError('Pipeline is missing a "name".')
  }
  if (!Array.isArray(source.steps) || source.steps.length === 0) {
    throw new PipelineImportError('Pipeline must include at least one step.')
  }

  const sanitizedSteps = source.steps.map((step, index) => sanitizeStep(step, index, warnings))
  const sanitizedVariables = Array.isArray(source.variables)
    ? source.variables.map((variable, index) => sanitizeVariable(variable, index, warnings)).filter(Boolean) as AgentPipelineVariable[]
    : []
  const sanitizedBudget = sanitizeBudget(source.budget, warnings)

  const now = Date.now()
  const importedName = options.name?.trim() || source.name.trim()
  const pipeline: AgentPipeline = {
    id: options.regenerateId === false && typeof source.id === 'string' && source.id ? source.id : generateId('pipeline'),
    name: importedName,
    ...(typeof source.description === 'string' && source.description.trim() ? { description: source.description.trim() } : {}),
    steps: sanitizedSteps,
    ...(sanitizedVariables.length > 0 ? { variables: sanitizedVariables } : {}),
    ...(sanitizedBudget ? { budget: sanitizedBudget } : {}),
    createdAt: now,
    updatedAt: now,
  }

  return { pipeline, warnings }
}

function cloneStep(step: AgentPipelineStep): AgentPipelineStep {
  // Strip undefined keys so the export stays compact.
  const cleaned: AgentPipelineStep = { agentId: step.agentId, task: step.task }
  if (step.name !== undefined) cleaned.name = step.name
  if (step.enabled !== undefined) cleaned.enabled = step.enabled
  if (step.continueOnError !== undefined) cleaned.continueOnError = step.continueOnError
  if (step.retryCount !== undefined) cleaned.retryCount = step.retryCount
  if (step.retryBackoffMs !== undefined) cleaned.retryBackoffMs = step.retryBackoffMs
  if (step.retryBackoffStrategy !== undefined) cleaned.retryBackoffStrategy = step.retryBackoffStrategy
  if (step.timeoutMs !== undefined) cleaned.timeoutMs = step.timeoutMs
  if (step.maxInputChars !== undefined) cleaned.maxInputChars = step.maxInputChars
  if (step.maxOutputChars !== undefined) cleaned.maxOutputChars = step.maxOutputChars
  if (step.outputType !== undefined) cleaned.outputType = step.outputType
  if (step.runIf !== undefined) cleaned.runIf = step.runIf
  return cleaned
}

function sanitizeStep(value: unknown, index: number, warnings: string[]): AgentPipelineStep {
  if (!value || typeof value !== 'object') {
    throw new PipelineImportError(`Step ${index + 1} is not an object.`)
  }
  const candidate = value as Record<string, unknown>
  const agentId = typeof candidate.agentId === 'string' ? candidate.agentId : ''
  const task = typeof candidate.task === 'string' ? candidate.task : ''
  if (!agentId) {
    warnings.push(`Step ${index + 1} is missing an agentId — assign one before saving.`)
  }
  if (!task.trim()) {
    warnings.push(`Step ${index + 1} has an empty task — fill it in before running.`)
  }
  const sanitized: AgentPipelineStep = { agentId, task }
  if (typeof candidate.name === 'string') sanitized.name = candidate.name
  if (typeof candidate.enabled === 'boolean') sanitized.enabled = candidate.enabled
  if (typeof candidate.continueOnError === 'boolean') sanitized.continueOnError = candidate.continueOnError
  if (typeof candidate.retryCount === 'number' && Number.isFinite(candidate.retryCount)) {
    sanitized.retryCount = Math.max(0, Math.trunc(candidate.retryCount))
  }
  if (typeof candidate.retryBackoffMs === 'number' && Number.isFinite(candidate.retryBackoffMs)) {
    sanitized.retryBackoffMs = Math.max(0, Math.trunc(candidate.retryBackoffMs))
  }
  if (candidate.retryBackoffStrategy === 'fixed' || candidate.retryBackoffStrategy === 'exponential') {
    sanitized.retryBackoffStrategy = candidate.retryBackoffStrategy
  }
  if (typeof candidate.timeoutMs === 'number' && Number.isFinite(candidate.timeoutMs) && candidate.timeoutMs > 0) {
    sanitized.timeoutMs = Math.trunc(candidate.timeoutMs)
  }
  if (typeof candidate.maxInputChars === 'number' && Number.isFinite(candidate.maxInputChars) && candidate.maxInputChars > 0) {
    sanitized.maxInputChars = Math.trunc(candidate.maxInputChars)
  }
  if (typeof candidate.maxOutputChars === 'number' && Number.isFinite(candidate.maxOutputChars) && candidate.maxOutputChars > 0) {
    sanitized.maxOutputChars = Math.trunc(candidate.maxOutputChars)
  }
  if (candidate.outputType === 'text' || candidate.outputType === 'json' || candidate.outputType === 'file' || candidate.outputType === 'table') {
    sanitized.outputType = candidate.outputType
  }
  if (typeof candidate.runIf === 'string') sanitized.runIf = candidate.runIf
  return sanitized
}

function sanitizeVariable(value: unknown, index: number, warnings: string[]): AgentPipelineVariable | null {
  if (!value || typeof value !== 'object') {
    warnings.push(`Variable #${index + 1} is malformed and will be ignored.`)
    return null
  }
  const candidate = value as Record<string, unknown>
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : ''
  if (!name) {
    warnings.push(`Variable #${index + 1} is missing a name and will be ignored.`)
    return null
  }
  const sanitized: AgentPipelineVariable = { name }
  if (typeof candidate.label === 'string') sanitized.label = candidate.label
  if (typeof candidate.description === 'string') sanitized.description = candidate.description
  if (typeof candidate.defaultValue === 'string') sanitized.defaultValue = candidate.defaultValue
  if (typeof candidate.required === 'boolean') sanitized.required = candidate.required
  return sanitized
}

function sanitizeBudget(value: unknown, warnings: string[]): AgentPipelineBudget | undefined {
  if (value == null) return undefined
  if (typeof value !== 'object') {
    warnings.push('Pipeline budget is malformed and will be ignored.')
    return undefined
  }
  const candidate = value as Record<string, unknown>
  const sanitized: AgentPipelineBudget = {}
  for (const key of ['maxTotalDurationMs', 'maxTotalTokens', 'maxStepCount'] as const) {
    const raw = candidate[key]
    if (raw === undefined) continue
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
      warnings.push(`Pipeline budget "${key}" must be a non-negative number; ignoring.`)
      continue
    }
    sanitized[key] = Math.trunc(raw)
  }
  return hasBudgetValues(sanitized) ? sanitized : undefined
}

function hasBudgetValues(budget: AgentPipelineBudget): boolean {
  return budget.maxTotalDurationMs !== undefined
    || budget.maxTotalTokens !== undefined
    || budget.maxStepCount !== undefined
}
