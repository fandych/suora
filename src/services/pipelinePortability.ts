import type { AgentPipeline, AgentPipelineBudget, AgentPipelineStep, AgentPipelineVariable } from '@/types'
import { generateId } from '@/utils/helpers'
import { safeParse, safeStringify } from '@/utils/safeJson'

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
  return safeStringify(buildPipelineExport(pipeline), 2)
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
    parsed = safeParse(rawJson)
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
  if (step.nodeType !== undefined) cleaned.nodeType = step.nodeType
  if (step.id !== undefined) cleaned.id = step.id
  if (step.name !== undefined) cleaned.name = step.name
  if (step.transitions !== undefined) cleaned.transitions = step.transitions.map((transition) => ({ ...transition }))
  if (step.startParams !== undefined) cleaned.startParams = step.startParams.map((param) => ({ ...param }))
  if (step.endOutputs !== undefined) cleaned.endOutputs = step.endOutputs.map((output) => ({ ...output }))
  if (step.conditionMode !== undefined) cleaned.conditionMode = step.conditionMode
  if (step.conditionTrueLabel !== undefined) cleaned.conditionTrueLabel = step.conditionTrueLabel
  if (step.conditionFalseLabel !== undefined) cleaned.conditionFalseLabel = step.conditionFalseLabel
  if (step.conditionBranches !== undefined) cleaned.conditionBranches = step.conditionBranches.map((branch) => ({ ...branch }))
  if (step.pipelineTargetId !== undefined) cleaned.pipelineTargetId = step.pipelineTargetId
  if (step.pipelineInputMapping !== undefined) cleaned.pipelineInputMapping = step.pipelineInputMapping
  if (step.scriptRuntime !== undefined) cleaned.scriptRuntime = step.scriptRuntime
  if (step.scriptPath !== undefined) cleaned.scriptPath = step.scriptPath
  if (step.scriptArgs !== undefined) cleaned.scriptArgs = step.scriptArgs
  if (step.scriptInputMapping !== undefined) cleaned.scriptInputMapping = step.scriptInputMapping
  if (step.scriptOutputSchema !== undefined) cleaned.scriptOutputSchema = step.scriptOutputSchema
  if (step.codeLanguage !== undefined) cleaned.codeLanguage = step.codeLanguage
  if (step.codeSource !== undefined) cleaned.codeSource = step.codeSource
  if (step.codeInputMapping !== undefined) cleaned.codeInputMapping = step.codeInputMapping
  if (step.codeOutputSchema !== undefined) cleaned.codeOutputSchema = step.codeOutputSchema
  if (step.templateBody !== undefined) cleaned.templateBody = step.templateBody
  if (step.templateInputMapping !== undefined) cleaned.templateInputMapping = step.templateInputMapping
  if (step.variableAssignments !== undefined) cleaned.variableAssignments = step.variableAssignments.map((assignment) => ({ ...assignment }))
  if (step.iterationSource !== undefined) cleaned.iterationSource = step.iterationSource
  if (step.iterationPipelineTargetId !== undefined) cleaned.iterationPipelineTargetId = step.iterationPipelineTargetId
  if (step.iterationInputMapping !== undefined) cleaned.iterationInputMapping = step.iterationInputMapping
  if (step.iterationItemVar !== undefined) cleaned.iterationItemVar = step.iterationItemVar
  if (step.iterationIndexVar !== undefined) cleaned.iterationIndexVar = step.iterationIndexVar
  if (step.iterationMode !== undefined) cleaned.iterationMode = step.iterationMode
  if (step.iterationErrorMode !== undefined) cleaned.iterationErrorMode = step.iterationErrorMode
  if (step.httpMethod !== undefined) cleaned.httpMethod = step.httpMethod
  if (step.httpUrl !== undefined) cleaned.httpUrl = step.httpUrl
  if (step.httpHeaders !== undefined) cleaned.httpHeaders = step.httpHeaders
  if (step.httpAuthType !== undefined) cleaned.httpAuthType = step.httpAuthType
  if (step.httpAuthHeader !== undefined) cleaned.httpAuthHeader = step.httpAuthHeader
  if (step.httpAuthValue !== undefined) cleaned.httpAuthValue = step.httpAuthValue
  if (step.httpBody !== undefined) cleaned.httpBody = step.httpBody
  if (step.httpBodyType !== undefined) cleaned.httpBodyType = step.httpBodyType
  if (step.httpAsync !== undefined) cleaned.httpAsync = step.httpAsync
  if (step.httpCaptureResponse !== undefined) cleaned.httpCaptureResponse = step.httpCaptureResponse
  if (step.httpTreatNon2xxAsError !== undefined) cleaned.httpTreatNon2xxAsError = step.httpTreatNon2xxAsError
  if (step.httpSuccessStatuses !== undefined) cleaned.httpSuccessStatuses = step.httpSuccessStatuses
  if (step.httpResponseBodyVar !== undefined) cleaned.httpResponseBodyVar = step.httpResponseBodyVar
  if (step.httpResponseStatusVar !== undefined) cleaned.httpResponseStatusVar = step.httpResponseStatusVar
  if (step.httpResponseHeadersVar !== undefined) cleaned.httpResponseHeadersVar = step.httpResponseHeadersVar
  if (step.httpResponseSizeVar !== undefined) cleaned.httpResponseSizeVar = step.httpResponseSizeVar
  if (step.emailTo !== undefined) cleaned.emailTo = step.emailTo
  if (step.emailCc !== undefined) cleaned.emailCc = step.emailCc
  if (step.emailSubject !== undefined) cleaned.emailSubject = step.emailSubject
  if (step.webhookChannelId !== undefined) cleaned.webhookChannelId = step.webhookChannelId
  if (step.webhookUrl !== undefined) cleaned.webhookUrl = step.webhookUrl
  if (step.webhookMethod !== undefined) cleaned.webhookMethod = step.webhookMethod
  if (step.webhookHeaders !== undefined) cleaned.webhookHeaders = step.webhookHeaders
  if (step.webhookAuthType !== undefined) cleaned.webhookAuthType = step.webhookAuthType
  if (step.webhookAuthHeader !== undefined) cleaned.webhookAuthHeader = step.webhookAuthHeader
  if (step.webhookAuthValue !== undefined) cleaned.webhookAuthValue = step.webhookAuthValue
  if (step.webhookBody !== undefined) cleaned.webhookBody = step.webhookBody
  if (step.webhookBodyType !== undefined) cleaned.webhookBodyType = step.webhookBodyType
  if (step.webhookAsync !== undefined) cleaned.webhookAsync = step.webhookAsync
  if (step.webhookCaptureResponse !== undefined) cleaned.webhookCaptureResponse = step.webhookCaptureResponse
  if (step.webhookTreatNon2xxAsError !== undefined) cleaned.webhookTreatNon2xxAsError = step.webhookTreatNon2xxAsError
  if (step.webhookSuccessStatuses !== undefined) cleaned.webhookSuccessStatuses = step.webhookSuccessStatuses
  if (step.webhookResponseBodyVar !== undefined) cleaned.webhookResponseBodyVar = step.webhookResponseBodyVar
  if (step.webhookResponseStatusVar !== undefined) cleaned.webhookResponseStatusVar = step.webhookResponseStatusVar
  if (step.webhookResponseHeadersVar !== undefined) cleaned.webhookResponseHeadersVar = step.webhookResponseHeadersVar
  if (step.webhookResponseSizeVar !== undefined) cleaned.webhookResponseSizeVar = step.webhookResponseSizeVar
  if (step.toolsetId !== undefined) cleaned.toolsetId = step.toolsetId
  if (step.toolName !== undefined) cleaned.toolName = step.toolName
  if (step.toolInput !== undefined) cleaned.toolInput = step.toolInput
  if (step.ragKnowledgeBaseId !== undefined) cleaned.ragKnowledgeBaseId = step.ragKnowledgeBaseId
  if (step.ragKnowledgeBaseIds !== undefined) cleaned.ragKnowledgeBaseIds = [...step.ragKnowledgeBaseIds]
  if (step.ragQuery !== undefined) cleaned.ragQuery = step.ragQuery
  if (step.ragTopK !== undefined) cleaned.ragTopK = step.ragTopK
  if (step.ragScoreThreshold !== undefined) cleaned.ragScoreThreshold = step.ragScoreThreshold
  if (step.ragMetadataFilter !== undefined) cleaned.ragMetadataFilter = step.ragMetadataFilter
  if (step.wikiId !== undefined) cleaned.wikiId = step.wikiId
  if (step.wikiIds !== undefined) cleaned.wikiIds = [...step.wikiIds]
  if (step.wikiQuery !== undefined) cleaned.wikiQuery = step.wikiQuery
  if (step.wikiTopK !== undefined) cleaned.wikiTopK = step.wikiTopK
  if (step.wikiScoreThreshold !== undefined) cleaned.wikiScoreThreshold = step.wikiScoreThreshold
  if (step.wikiMetadataFilter !== undefined) cleaned.wikiMetadataFilter = step.wikiMetadataFilter
  if (step.parallelBranches !== undefined) cleaned.parallelBranches = step.parallelBranches
  if (step.parallelJoinStrategy !== undefined) cleaned.parallelJoinStrategy = step.parallelJoinStrategy
  if (step.joinStrategy !== undefined) cleaned.joinStrategy = step.joinStrategy
  if (step.enabled !== undefined) cleaned.enabled = step.enabled
  if (step.continueOnError !== undefined) cleaned.continueOnError = step.continueOnError
  if (step.retryCount !== undefined) cleaned.retryCount = step.retryCount
  if (step.retryBackoffMs !== undefined) cleaned.retryBackoffMs = step.retryBackoffMs
  if (step.retryBackoffStrategy !== undefined) cleaned.retryBackoffStrategy = step.retryBackoffStrategy
  if (step.timeoutMs !== undefined) cleaned.timeoutMs = step.timeoutMs
  if (step.maxInputChars !== undefined) cleaned.maxInputChars = step.maxInputChars
  if (step.maxOutputChars !== undefined) cleaned.maxOutputChars = step.maxOutputChars
  if (step.outputType !== undefined) cleaned.outputType = step.outputType
  if (step.modelId !== undefined) cleaned.modelId = step.modelId
  if (step.outputTransform !== undefined) cleaned.outputTransform = step.outputTransform
  if (step.outputTransformPath !== undefined) cleaned.outputTransformPath = step.outputTransformPath
  if (step.exportVar !== undefined) cleaned.exportVar = step.exportVar
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
  if (
    candidate.nodeType === 'start' || candidate.nodeType === 'end' || candidate.nodeType === 'condition' || candidate.nodeType === 'agent'
    || candidate.nodeType === 'pipeline' || candidate.nodeType === 'script' || candidate.nodeType === 'code' || candidate.nodeType === 'template'
    || candidate.nodeType === 'variable' || candidate.nodeType === 'iteration' || candidate.nodeType === 'http' || candidate.nodeType === 'email' || candidate.nodeType === 'parallel'
    || candidate.nodeType === 'join' || candidate.nodeType === 'webhook' || candidate.nodeType === 'toolset' || candidate.nodeType === 'rag' || candidate.nodeType === 'wiki'
  ) {
    sanitized.nodeType = candidate.nodeType
  }
  if (typeof candidate.id === 'string' && candidate.id.trim()) sanitized.id = candidate.id.trim()
  if (typeof candidate.name === 'string') sanitized.name = candidate.name
  if (Array.isArray(candidate.transitions)) {
    sanitized.transitions = candidate.transitions.flatMap((transition) => {
      if (!transition || typeof transition !== 'object') return []
      const raw = transition as Record<string, unknown>
      const targetStepId = typeof raw.targetStepId === 'string' ? raw.targetStepId.trim() : ''
      if (!targetStepId) return []
      return [{
        targetStepId,
        ...(typeof raw.label === 'string' && raw.label.trim() ? { label: raw.label.trim() } : {}),
        ...(typeof raw.sourceHandle === 'string' && raw.sourceHandle.trim() ? { sourceHandle: raw.sourceHandle.trim() } : {}),
      }]
    })
  }
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
  if (typeof candidate.modelId === 'string' && candidate.modelId.trim()) {
    sanitized.modelId = candidate.modelId.trim()
  }
  if (
    candidate.outputTransform === 'trim'
    || candidate.outputTransform === 'first-line'
    || candidate.outputTransform === 'last-line'
    || candidate.outputTransform === 'json-path'
  ) {
    sanitized.outputTransform = candidate.outputTransform
  }
  if (typeof candidate.outputTransformPath === 'string' && candidate.outputTransformPath.trim()) {
    sanitized.outputTransformPath = candidate.outputTransformPath
  }
  if (typeof candidate.exportVar === 'string' && candidate.exportVar.trim()) {
    sanitized.exportVar = candidate.exportVar.trim()
  }
  if (typeof candidate.runIf === 'string') sanitized.runIf = candidate.runIf
  if (candidate.codeLanguage === 'javascript') sanitized.codeLanguage = candidate.codeLanguage
  if (typeof candidate.codeSource === 'string') sanitized.codeSource = candidate.codeSource
  if (typeof candidate.codeInputMapping === 'string') sanitized.codeInputMapping = candidate.codeInputMapping
  if (typeof candidate.codeOutputSchema === 'string') sanitized.codeOutputSchema = candidate.codeOutputSchema
  if (typeof candidate.templateBody === 'string') sanitized.templateBody = candidate.templateBody
  if (typeof candidate.templateInputMapping === 'string') sanitized.templateInputMapping = candidate.templateInputMapping
  if (Array.isArray(candidate.variableAssignments)) {
    sanitized.variableAssignments = candidate.variableAssignments.flatMap((assignment) => {
      if (!assignment || typeof assignment !== 'object') return []
      const raw = assignment as Record<string, unknown>
      const variable = typeof raw.variable === 'string' ? raw.variable.trim() : ''
      if (!variable) return []
      const mode = raw.mode === 'append' || raw.mode === 'extend' || raw.mode === 'clear' ? raw.mode : 'overwrite'
      return [{
        variable,
        mode,
        ...(typeof raw.value === 'string' ? { value: raw.value } : {}),
      }]
    })
  }
  if (typeof candidate.iterationSource === 'string') sanitized.iterationSource = candidate.iterationSource
  if (typeof candidate.iterationPipelineTargetId === 'string') sanitized.iterationPipelineTargetId = candidate.iterationPipelineTargetId
  if (typeof candidate.iterationInputMapping === 'string') sanitized.iterationInputMapping = candidate.iterationInputMapping
  if (typeof candidate.iterationItemVar === 'string') sanitized.iterationItemVar = candidate.iterationItemVar
  if (typeof candidate.iterationIndexVar === 'string') sanitized.iterationIndexVar = candidate.iterationIndexVar
  if (candidate.iterationMode === 'sequential' || candidate.iterationMode === 'parallel') sanitized.iterationMode = candidate.iterationMode
  if (candidate.iterationErrorMode === 'terminate' || candidate.iterationErrorMode === 'continue' || candidate.iterationErrorMode === 'remove-failed') sanitized.iterationErrorMode = candidate.iterationErrorMode
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
