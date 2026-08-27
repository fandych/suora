import type { Agent, AgentPipeline, AgentPipelineStep, Model, PipelineRecoveryAction } from '@/types'
import { extractVariableReferences, validateRunIfSyntax } from '@/services/pipelineRunIf'
import { buildIncomingTransitionMap, materializePipelineGraph } from '@/services/pipelineGraph'
import { getPipelineNodeType, nodeTypeRequiresTask, nodeTypeUsesAgentRuntime } from '@/components/pipeline/pipelineNodeBehaviors'
import { readPipelineValidationStoreState } from '@/services/pipelineValidationState'

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

function hasInvalidSuccessStatuses(raw: string | undefined): boolean {
  if (!raw?.trim()) return false
  const tokens = raw.split(/[\s,]+/u).map((token) => token.trim()).filter(Boolean)
  if (tokens.length === 0) return false
  return tokens.some((token) => {
    const value = Number(token)
    return !Number.isInteger(value) || value < 100 || value > 599
  })
}

const VALID_VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

function collectStepExportedVariableNames(step: AgentPipelineStep): Array<{ name: string; label: string }> {
  return [
    { value: step.exportVar, label: 'exportVar' },
    ...(step.codeOutputSchema !== undefined ? step.codeOutputSchema.split(',').map((value) => ({ value, label: 'code output variable' })) : []),
    ...((step.variableAssignments ?? []).map((assignment) => ({ value: assignment.variable, label: 'variable assignment' }))),
    { value: step.httpResponseBodyVar, label: 'response variable' },
    { value: step.httpResponseStatusVar, label: 'response variable' },
    { value: step.httpResponseHeadersVar, label: 'response variable' },
    { value: step.httpResponseSizeVar, label: 'response variable' },
    { value: step.webhookResponseBodyVar, label: 'response variable' },
    { value: step.webhookResponseStatusVar, label: 'response variable' },
    { value: step.webhookResponseHeadersVar, label: 'response variable' },
    { value: step.webhookResponseSizeVar, label: 'response variable' },
  ]
    .filter((entry) => entry.value !== undefined)
    .map((entry) => ({ name: entry.value?.trim() ?? '', label: entry.label }))
}

function collectReachableStepIds(entryStepId: string | null, adjacency: Map<string, string[]>): Set<string> {
  const visited = new Set<string>()
  if (!entryStepId) return visited
  const stack = [entryStepId]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || visited.has(current)) continue
    visited.add(current)
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) stack.push(next)
    }
  }
  return visited
}

function hasCycleFrom(
  stepId: string,
  adjacency: Map<string, string[]>,
  visiting: Set<string>,
  visited: Set<string>,
): boolean {
  if (visiting.has(stepId)) return true
  if (visited.has(stepId)) return false
  visiting.add(stepId)
  for (const next of adjacency.get(stepId) ?? []) {
    if (hasCycleFrom(next, adjacency, visiting, visited)) return true
  }
  visiting.delete(stepId)
  visited.add(stepId)
  return false
}

export function validateAgentPipeline(
  pipeline: Pick<AgentPipeline, 'name' | 'steps' | 'variables' | 'budget'>,
  agents: Agent[],
  models: Model[],
): PipelineValidationResult {
  const issues: PipelineValidationIssue[] = []
  const { emailConfig, channels, installedPlugins, pluginTools, documentGroups, agentPipelines } = readPipelineValidationStoreState()
  const graphSteps = materializePipelineGraph(pipeline.steps)
  const enabledSteps = graphSteps.filter((step) => step.enabled !== false)
  const incomingByStepId = buildIncomingTransitionMap(graphSteps)
  const seenStepIds = new Set<string>()
  const adjacency = new Map(graphSteps.map((step) => [step.id, step.transitions.map((transition) => transition.targetStepId)]))
  const entryStepId = graphSteps.find((step) => getPipelineNodeType(step) === 'start')?.id ?? graphSteps[0]?.id ?? null
  const reachableStepIds = collectReachableStepIds(entryStepId, adjacency)
  const cycleVisited = new Set<string>()

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

  // Names that earlier steps will publish via `exportVar`. Treated as
  // declared from the perspective of any later step's `{{vars.X}}` /
  // `runIf` references, so a step can produce a value its successor uses.
  const exportedVariableNames = new Set<string>()

  graphSteps.forEach((step: AgentPipelineStep, index) => {
    if (step.enabled === false) return
    if (step.id && seenStepIds.has(step.id)) {
      issues.push({ severity: 'error', code: 'duplicate-step-id', stepIndex: index, message: `Step ${index + 1} reuses a workflow node id.` })
    }
    if (step.id) {
      seenStepIds.add(step.id)
    }
    const nodeType = getPipelineNodeType(step)
    const agent = nodeTypeUsesAgentRuntime(nodeType) ? agents.find((item) => item.id === step.agentId) : undefined
    if (nodeTypeRequiresTask(nodeType) && !step.task.trim()) {
      issues.push({ severity: 'error', code: 'empty-task', stepIndex: index, message: `Step ${index + 1} has an empty task.` })
    }
    if (nodeTypeUsesAgentRuntime(nodeType) && !agent) {
      issues.push({
        severity: 'error',
        code: 'missing-agent',
        stepIndex: index,
        message: `Step ${index + 1} references a missing agent.`,
        recoveryActions: [{ id: 'edit-pipeline', label: 'Choose another agent', stepIndex: index }],
      })
    } else if (agent) {
      const model = agent.modelId
        ? models.find((item) => item.id === agent.modelId && item.enabled !== false)
        : models.find((item) => item.isDefault && item.enabled !== false) ?? models.find((item) => item.enabled !== false)
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

    if (nodeType === 'condition') {
      if (step.conditionMode !== undefined && step.conditionMode !== 'all' && step.conditionMode !== 'any') {
        issues.push({ severity: 'error', code: 'invalid-condition-mode', stepIndex: index, message: `Step ${index + 1} condition mode must be either "all" or "any".` })
      }
    }

    if (nodeType === 'start') {
      if ((incomingByStepId.get(step.id ?? '')?.length ?? 0) > 0) {
        issues.push({ severity: 'error', code: 'start-has-incoming', stepIndex: index, message: `Step ${index + 1} start node cannot have incoming workflow edges.` })
      }
      if (!step.startParams || step.startParams.length === 0 || step.startParams.some((param) => !param.key.trim())) {
        issues.push({ severity: 'error', code: 'missing-start-params', stepIndex: index, message: `Step ${index + 1} start node must declare at least one parameter.` })
      }
    }

    if (nodeType === 'end') {
      if ((step.transitions?.length ?? 0) > 0) {
        issues.push({ severity: 'error', code: 'end-has-outgoing', stepIndex: index, message: `Step ${index + 1} end node cannot have outgoing workflow edges.` })
      }
      if (!step.endOutputs || step.endOutputs.length === 0 || step.endOutputs.some((output) => !output.key.trim() || !output.value?.trim())) {
        issues.push({ severity: 'error', code: 'missing-end-outputs', stepIndex: index, message: `Step ${index + 1} end node must map at least one workflow output.` })
      }
    }

    step.transitions?.forEach((transition) => {
      if (!graphSteps.some((candidate) => candidate.id === transition.targetStepId)) {
        issues.push({ severity: 'error', code: 'missing-transition-target', stepIndex: index, message: `Step ${index + 1} points to a workflow node that does not exist.` })
      }
    })

    if (!reachableStepIds.has(step.id ?? '')) {
      issues.push({ severity: 'warning', code: 'unreachable-node', stepIndex: index, message: `Step ${index + 1} is not reachable from the workflow entry path.` })
    }

    if (nodeType === 'pipeline' && !(step.pipelineTargetId?.trim())) {
      issues.push({ severity: 'error', code: 'missing-pipeline-target', stepIndex: index, message: `Step ${index + 1} must reference a target pipeline id.` })
    } else if (nodeType === 'pipeline' && step.pipelineTargetId?.trim()) {
      const targetReference = step.pipelineTargetId.trim().toLowerCase()
      if (!agentPipelines.some((pipeline) => pipeline.id === step.pipelineTargetId?.trim() || pipeline.name.toLowerCase() === targetReference)) {
        issues.push({ severity: 'warning', code: 'unknown-pipeline-target', stepIndex: index, message: `Step ${index + 1} references a child pipeline that is not currently saved in this workspace.` })
      }
    }

    if (nodeType === 'script' && !(step.scriptPath?.trim())) {
      issues.push({ severity: 'error', code: 'missing-script-path', stepIndex: index, message: `Step ${index + 1} must provide a script path.` })
    }
    if (nodeType === 'script' && step.scriptRuntime && !['javascript', 'typescript', 'nodejs', 'python', 'shell'].includes(step.scriptRuntime)) {
      issues.push({ severity: 'error', code: 'unsupported-script-runtime', stepIndex: index, message: `Step ${index + 1} script runtime is not supported by the current executor.` })
    }
    if (nodeType === 'code') {
      if (!(step.codeSource?.trim())) {
        issues.push({ severity: 'error', code: 'missing-code-source', stepIndex: index, message: `Step ${index + 1} must provide inline code.` })
      }
      if (step.codeLanguage && step.codeLanguage !== 'javascript') {
        issues.push({ severity: 'error', code: 'unsupported-code-language', stepIndex: index, message: `Step ${index + 1} code language is not supported by the current executor.` })
      }
      if (step.codeOutputSchema !== undefined && step.codeOutputSchema.split(',').map((value) => value.trim()).filter(Boolean).some((value) => !VALID_VARIABLE_NAME.test(value))) {
        issues.push({ severity: 'error', code: 'invalid-code-output-schema', stepIndex: index, message: `Step ${index + 1} code output variables must use valid workflow variable names.` })
      }
    }
    if (nodeType === 'template' && !(step.templateBody?.trim())) {
      issues.push({ severity: 'error', code: 'missing-template-body', stepIndex: index, message: `Step ${index + 1} must provide template content.` })
    }
    if (nodeType === 'variable') {
      if (!step.variableAssignments || step.variableAssignments.length === 0) {
        issues.push({ severity: 'error', code: 'missing-variable-assignments', stepIndex: index, message: `Step ${index + 1} must define at least one variable assignment.` })
      } else {
        step.variableAssignments.forEach((assignment, assignmentIndex) => {
          if (!assignment.variable.trim()) {
            issues.push({ severity: 'error', code: 'invalid-variable-assignment', stepIndex: index, message: `Step ${index + 1} assignment #${assignmentIndex + 1} must target a variable name.` })
          }
          if (!['overwrite', 'append', 'extend', 'clear'].includes(assignment.mode)) {
            issues.push({ severity: 'error', code: 'invalid-variable-assignment', stepIndex: index, message: `Step ${index + 1} assignment #${assignmentIndex + 1} uses an unsupported update mode.` })
          }
        })
      }
    }
    if (nodeType === 'iteration') {
      if (!(step.iterationSource?.trim())) {
        issues.push({ severity: 'error', code: 'missing-iteration-source', stepIndex: index, message: `Step ${index + 1} must provide an array source.` })
      }
      const targetPipelineId = step.iterationPipelineTargetId?.trim()
      if (!targetPipelineId) {
        issues.push({ severity: 'error', code: 'missing-iteration-target', stepIndex: index, message: `Step ${index + 1} must choose a child pipeline.` })
      } else if (!agentPipelines.some((pipeline) => pipeline.id === targetPipelineId || pipeline.name.toLowerCase() === targetPipelineId.toLowerCase())) {
        issues.push({ severity: 'warning', code: 'unknown-iteration-target', stepIndex: index, message: `Step ${index + 1} references an iteration child pipeline that is not currently saved in this workspace.` })
      }
      if (step.iterationMode && !['sequential', 'parallel'].includes(step.iterationMode)) {
        issues.push({ severity: 'error', code: 'invalid-iteration-mode', stepIndex: index, message: `Step ${index + 1} iteration mode must be sequential or parallel.` })
      }
      if (step.iterationErrorMode && !['terminate', 'continue', 'remove-failed'].includes(step.iterationErrorMode)) {
        issues.push({ severity: 'error', code: 'invalid-iteration-error-mode', stepIndex: index, message: `Step ${index + 1} iteration error handling must be terminate, continue, or remove-failed.` })
      }
      if (step.iterationItemVar && !VALID_VARIABLE_NAME.test(step.iterationItemVar)) {
        issues.push({ severity: 'error', code: 'invalid-iteration-item-var', stepIndex: index, message: `Step ${index + 1} iteration item variable must be a valid workflow variable name.` })
      }
      if (step.iterationIndexVar && !VALID_VARIABLE_NAME.test(step.iterationIndexVar)) {
        issues.push({ severity: 'error', code: 'invalid-iteration-index-var', stepIndex: index, message: `Step ${index + 1} iteration index variable must be a valid workflow variable name.` })
      }
      if (targetPipelineId && targetPipelineId === step.id) {
        issues.push({ severity: 'warning', code: 'iteration-self-reference', stepIndex: index, message: `Step ${index + 1} appears to reference itself as an iteration target.` })
      }
    }

    if (nodeType === 'http') {
      if (!(step.httpUrl?.trim())) {
        issues.push({ severity: 'error', code: 'missing-http-url', stepIndex: index, message: `Step ${index + 1} must provide a request URL.` })
      }
      if (step.httpMethod !== undefined && !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(step.httpMethod)) {
        issues.push({ severity: 'error', code: 'invalid-http-method', stepIndex: index, message: `Step ${index + 1} must use a valid HTTP method.` })
      }
      if (step.httpBodyType && !['json', 'form', 'raw'].includes(step.httpBodyType)) {
        issues.push({ severity: 'error', code: 'invalid-http-body-type', stepIndex: index, message: `Step ${index + 1} must use a supported HTTP body type.` })
      }
      if (hasInvalidSuccessStatuses(step.httpSuccessStatuses)) {
        issues.push({ severity: 'error', code: 'invalid-http-success-statuses', stepIndex: index, message: `Step ${index + 1} success status codes must be integers between 100 and 599.` })
      }
    }

    if (nodeType === 'webhook') {
      if (!(step.webhookChannelId?.trim()) && !(step.webhookUrl?.trim())) {
        issues.push({ severity: 'error', code: 'missing-webhook-target', stepIndex: index, message: `Step ${index + 1} must provide a saved webhook target or a custom webhook URL.` })
      }
      if (step.webhookChannelId?.trim() && !channels.some((channel) => channel.id === step.webhookChannelId)) {
        issues.push({ severity: 'error', code: 'invalid-webhook-target', stepIndex: index, message: `Step ${index + 1} references a missing saved webhook target.` })
      }
      if (step.webhookBodyType && !['json', 'form', 'raw'].includes(step.webhookBodyType)) {
        issues.push({ severity: 'error', code: 'invalid-webhook-body-type', stepIndex: index, message: `Step ${index + 1} must use a supported webhook body type.` })
      }
      if (hasInvalidSuccessStatuses(step.webhookSuccessStatuses)) {
        issues.push({ severity: 'error', code: 'invalid-webhook-success-statuses', stepIndex: index, message: `Step ${index + 1} success status codes must be integers between 100 and 599.` })
      }
    }

    if (nodeType === 'toolset') {
      const toolsetId = step.toolsetId?.trim()
      if (!toolsetId) {
        issues.push({ severity: 'error', code: 'missing-toolset', stepIndex: index, message: `Step ${index + 1} must choose a toolset.` })
      } else if (!installedPlugins.some((plugin) => plugin.id === toolsetId)) {
        issues.push({ severity: 'error', code: 'invalid-toolset', stepIndex: index, message: `Step ${index + 1} references a toolset that is not installed.` })
      }
      if (!(step.toolName?.trim())) {
        issues.push({ severity: 'error', code: 'missing-tool-name', stepIndex: index, message: `Step ${index + 1} must choose a specific tool from the selected toolset.` })
      } else if (toolsetId && !(pluginTools[toolsetId] ?? []).includes(step.toolName.trim())) {
        issues.push({ severity: 'error', code: 'invalid-tool-name', stepIndex: index, message: `Step ${index + 1} references a tool that does not belong to the selected toolset.` })
      }
    }

    if (nodeType === 'rag') {
      const knowledgeBaseIds = new Set([...(step.ragKnowledgeBaseIds ?? []).map((value) => value.trim()).filter(Boolean), step.ragKnowledgeBaseId?.trim() ?? ''])
      knowledgeBaseIds.delete('')
      if (knowledgeBaseIds.size === 0) {
        issues.push({ severity: 'error', code: 'missing-rag-knowledge-base', stepIndex: index, message: `Step ${index + 1} must choose a knowledge base.` })
      } else if ([...knowledgeBaseIds].some((id) => !documentGroups.some((group) => group.id === id))) {
        issues.push({ severity: 'error', code: 'invalid-rag-knowledge-base', stepIndex: index, message: `Step ${index + 1} references a knowledge base that does not exist.` })
      }
      if (!(step.ragQuery?.trim())) {
        issues.push({ severity: 'error', code: 'missing-rag-query', stepIndex: index, message: `Step ${index + 1} must provide a retrieval query.` })
      }
    }

    if (nodeType === 'wiki') {
      const wikiIds = new Set([...(step.wikiIds ?? []).map((value) => value.trim()).filter(Boolean), step.wikiId?.trim() ?? ''])
      wikiIds.delete('')
      if (wikiIds.size === 0) {
        issues.push({ severity: 'error', code: 'missing-wiki-id', stepIndex: index, message: `Step ${index + 1} must choose a wiki.` })
      } else if ([...wikiIds].some((id) => !documentGroups.some((group) => group.id === id))) {
        issues.push({ severity: 'error', code: 'invalid-wiki-id', stepIndex: index, message: `Step ${index + 1} references a wiki that does not exist.` })
      }
      if (!(step.wikiQuery?.trim())) {
        issues.push({ severity: 'error', code: 'missing-wiki-query', stepIndex: index, message: `Step ${index + 1} must provide a wiki search query.` })
      }
    }

    if (nodeType === 'condition') {
      const branchKeys = (step.conditionBranches ?? []).map((branch) => branch.key.trim()).filter(Boolean)
      if (branchKeys.length > 0 && new Set(branchKeys).size !== branchKeys.length) {
        issues.push({ severity: 'error', code: 'duplicate-condition-branch', stepIndex: index, message: `Step ${index + 1} condition branches must use unique keys.` })
      }
    }

    if (nodeType === 'email') {
      if (!(step.emailTo?.trim())) {
        issues.push({ severity: 'error', code: 'missing-email-to', stepIndex: index, message: `Step ${index + 1} must provide at least one recipient.` })
      }
      if (!(step.emailSubject?.trim())) {
        issues.push({ severity: 'error', code: 'missing-email-subject', stepIndex: index, message: `Step ${index + 1} must provide an email subject.` })
      }
      if (!emailConfig.enabled || !emailConfig.smtpHost || !emailConfig.fromAddress) {
        issues.push({ severity: 'warning', code: 'smtp-unavailable', stepIndex: index, message: `Step ${index + 1} email delivery is configured, but workspace SMTP settings are incomplete.` })
      }
    }

    if (nodeType === 'parallel' && step.parallelBranches !== undefined && (!Number.isInteger(step.parallelBranches) || step.parallelBranches < 2)) {
      issues.push({ severity: 'error', code: 'invalid-parallel-branches', stepIndex: index, message: `Step ${index + 1} parallel branch count must be an integer of at least 2.` })
    }

    if (nodeType === 'join' && step.joinStrategy !== undefined && !['wait-all', 'first-success', 'merge-output'].includes(step.joinStrategy)) {
      issues.push({ severity: 'error', code: 'invalid-join-strategy', stepIndex: index, message: `Step ${index + 1} join strategy must be one of wait-all, first-success, or merge-output.` })
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
      if (!declaredVariableNames.has(variableName) && !exportedVariableNames.has(variableName)) {
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

    for (const { name: exportName, label: exportLabel } of collectStepExportedVariableNames(step)) {
      if (!exportName) {
        issues.push({
          severity: 'error',
          code: 'invalid-export-var',
          stepIndex: index,
          message: `Step ${index + 1} ${exportLabel} is empty — remove the field or provide a name.`,
        })
      } else if (!VALID_VARIABLE_NAME.test(exportName)) {
        issues.push({
          severity: 'error',
          code: 'invalid-export-var',
          stepIndex: index,
          message: `Step ${index + 1} ${exportLabel} "${exportName}" must match /^[A-Za-z_][A-Za-z0-9_]*$/.`,
        })
      } else if (declaredVariableNames.has(exportName)) {
        // Overwriting a declared variable's default mid-run is legal but is
        // almost always a footgun (the supplied value disappears once the step
        // runs), so surface it as a warning.
        issues.push({
          severity: 'warning',
          code: 'export-var-collision',
          stepIndex: index,
          message: `Step ${index + 1} ${exportLabel} "${exportName}" overwrites a declared pipeline variable; the supplied value will be replaced once this step succeeds.`,
        })
        exportedVariableNames.add(exportName)
      } else {
        exportedVariableNames.add(exportName)
      }
    }

    if ((step.maxInputChars ?? 0) > 120_000 || (step.maxOutputChars ?? 0) > 120_000) {
      issues.push({ severity: 'warning', code: 'large-budget', stepIndex: index, message: `Step ${index + 1} has a very large context budget.` })
    }
  })

  for (const step of graphSteps) {
    if (hasCycleFrom(step.id, adjacency, new Set<string>(), cycleVisited)) {
      issues.push({ severity: 'error', code: 'cycle-detected', message: 'Workflow graph contains a cycle. Add loop support or remove the circular edge before running.' })
      break
    }
  }

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
