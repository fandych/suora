import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SidePanel } from '@/components/layout/SidePanel'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { PipelineFlowDiagram } from '@/components/pipeline/PipelineFlowDiagram'
import { useResizablePanel } from '@/hooks/useResizablePanel'
import { useI18n } from '@/hooks/useI18n'
import { useAppStore } from '@/store/appStore'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { executeAgentPipeline, dryRunAgentPipeline, type AgentPipelineProgressStep, type DryRunResult } from '@/services/agentPipelineService'
import { validateAgentPipeline } from '@/services/pipelineValidation'
import { buildPipelineMermaidSource } from '@/services/pipelineMermaid'
import { deletePipelineFromDisk, loadPipelineExecutionsFromDisk, loadPipelinesFromDisk, savePipelineToDisk } from '@/services/pipelineFiles'
import { PipelineImportError, parsePipelineImport, serializePipelineExport } from '@/services/pipelinePortability'
import { confirm } from '@/services/confirmDialog'
import type { AgentPipeline, AgentPipelineBudget, AgentPipelineExecution, AgentPipelineExecutionStep, AgentPipelineStep, AgentPipelineVariable, PipelineStepUsage } from '@/types'
import { generateId } from '@/utils/helpers'

const PIPELINE_HEADER_BACKGROUND = 'bg-[radial-gradient(circle_at_top_left,rgba(var(--t-accent-rgb),0.18),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.03),transparent_55%)]'

function formatDuration(durationMs?: number, t?: (key: string, defaultValue?: string) => string) {
  if (durationMs === undefined) return t?.('agents.pipelinePendingDuration', 'Waiting...') ?? 'Waiting...'
  if (durationMs < 1000) return `${durationMs}ms`
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)}s`
  return `${(durationMs / 60_000).toFixed(1)}m`
}

function buildStepOutputToken(stepIndex: number) {
  return `{{steps[${stepIndex + 1}].output}}`
}

function formatTriggerLabel(trigger: AgentPipelineExecution['trigger'], t: (key: string, defaultValue?: string) => string) {
  if (trigger === 'timer') return t('agents.pipelineTriggeredByTimer', 'Triggered by timer')
  if (trigger === 'chat') return t('agents.pipelineTriggeredByChat', 'Triggered from chat')
  return t('agents.pipelineTriggeredManually', 'Triggered manually')
}

function statusStyles(status: AgentPipelineProgressStep['status'] | AgentPipelineExecution['status']) {
  switch (status) {
    case 'running':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/20'
    case 'success':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
    case 'error':
      return 'bg-red-500/15 text-red-300 border-red-500/20'
    case 'skipped':
      return 'bg-slate-500/15 text-text-muted border-border-subtle'
    case 'pending':
    default:
      return 'bg-surface-3 text-text-secondary border-border-subtle'
  }
}

function normalizeRetryCount(value?: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(Math.trunc(value ?? 0), 3))
}

function buildDefaultVariableValues(variables: AgentPipelineVariable[] | undefined): Record<string, string> {
  if (!variables) return {}
  const next: Record<string, string> = {}
  for (const variable of variables) {
    if (!variable.name) continue
    next[variable.name] = variable.defaultValue ?? ''
  }
  return next
}

function mapExecutionStep(step: AgentPipelineExecutionStep, agentNameMap: Record<string, string>): AgentPipelineProgressStep {
  return {
    stepIndex: step.stepIndex,
    agentId: step.agentId,
    agentName: agentNameMap[step.agentId],
    name: step.name,
    task: step.task,
    input: step.input,
    output: step.output,
    status: step.status,
    startedAt: step.startedAt,
    completedAt: step.completedAt,
    durationMs: step.durationMs,
    attempts: step.attempts,
    error: step.error,
    ...(step.usage ? { usage: step.usage } : {}),
    ...(step.skipReason ? { skipReason: step.skipReason } : {}),
  }
}

function formatTokenCount(value?: number): string {
  if (!Number.isFinite(value) || !value) return '0'
  if (value < 1000) return String(value)
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`
  return `${(value / 1_000_000).toFixed(1)}M`
}

function formatUsageLabel(usage: PipelineStepUsage | undefined, t: (key: string, defaultValue?: string) => string): string | null {
  if (!usage) return null
  return `${t('agents.pipelineTokensIn', 'in')} ${formatTokenCount(usage.promptTokens)} · ${t('agents.pipelineTokensOut', 'out')} ${formatTokenCount(usage.completionTokens)} · ${t('agents.pipelineTokensTotal', 'total')} ${formatTokenCount(usage.totalTokens)}`
}

function buildPreviewSteps(pipeline: AgentPipelineStep[], agentNameMap: Record<string, string>): AgentPipelineProgressStep[] {
  return pipeline.map((step, index) => ({
    stepIndex: index,
    agentId: step.agentId,
    agentName: agentNameMap[step.agentId],
    name: step.name,
    task: step.task,
    input: step.enabled === false ? '' : (index === 0 ? step.task : ''),
    status: step.enabled === false ? 'skipped' : 'pending',
    error: step.enabled === false ? 'Step disabled' : undefined,
  }))
}

function getValidExecutionId(currentId: string | null, executions: AgentPipelineExecution[]): string | null {
  return currentId && executions.some((execution) => execution.id === currentId)
    ? currentId
    : (executions[0]?.id ?? null)
}

export function PipelineLayout() {
  const { t, locale } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const [panelWidth, setPanelWidth] = useResizablePanel('pipeline', 280)
  const [searchQuery, setSearchQuery] = useState('')
  const [pipelineDescription, setPipelineDescription] = useState('')
  const [pipelineVariables, setPipelineVariables] = useState<AgentPipelineVariable[]>([])
  const [pipelineBudget, setPipelineBudget] = useState<AgentPipelineBudget | undefined>(undefined)
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null)
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})
  const [diagramView, setDiagramView] = useState<'preview' | 'source'>('preview')
  const [copiedMermaid, setCopiedMermaid] = useState(false)
  const [pipelineHistory, setPipelineHistory] = useState<AgentPipelineExecution[]>([])
  const [running, setRunning] = useState(false)
  const [liveSteps, setLiveSteps] = useState<AgentPipelineProgressStep[]>([])
  const [activeExecution, setActiveExecution] = useState<AgentPipelineExecution | null>(null)
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null)
  const runAbortControllerRef = useRef<AbortController | null>(null)
  const {
    workspacePath,
    agents,
    models,
    agentPipeline: pipeline,
    setAgentPipeline,
    clearAgentPipeline,
    agentPipelineName,
    setAgentPipelineName,
    selectedAgentPipelineId,
    setSelectedAgentPipelineId,
    agentPipelines,
    setAgentPipelines,
    addAgentPipeline,
    updateAgentPipeline,
    removeAgentPipeline,
    addNotification,
  } = useAppStore()
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const requestedPipelineId = searchParams.get('pipelineId')
  const requestedExecutionId = searchParams.get('executionId')
  const requestedTimerId = searchParams.get('timerId')
  const requestedFiredAtRaw = searchParams.get('firedAt')
  const requestedFiredAt = requestedFiredAtRaw ? Number(requestedFiredAtRaw) : Number.NaN

  const enabledAgents = agents.filter((agent) => agent.enabled !== false)
  const agentNameMap = useMemo(
    () => Object.fromEntries(agents.map((agent) => [
      agent.id,
      agent.id === 'default-assistant'
        ? t('chat.assistant', agent.name || 'Assistant')
        : agent.name,
    ])),
    [agents, t],
  )
  const selectedSavedPipeline = selectedAgentPipelineId
    ? agentPipelines.find((item) => item.id === selectedAgentPipelineId) ?? null
    : null
  const enabledPipelineSteps = useMemo(
    () => pipeline.filter((step) => step.enabled !== false),
    [pipeline],
  )
  const invalidEnabledSteps = useMemo(
    () => enabledPipelineSteps.filter((step) => !step.task.trim()).length,
    [enabledPipelineSteps],
  )
  useEffect(() => {
    if (!workspacePath) return
    loadPipelinesFromDisk(workspacePath).then((savedPipelines) => {
      setAgentPipelines(savedPipelines)
    })
  }, [workspacePath, setAgentPipelines])

  useEffect(() => {
    if (!requestedPipelineId) return
    const requestedPipeline = agentPipelines.find((item) => item.id === requestedPipelineId)
    if (!requestedPipeline) return

    setSelectedAgentPipelineId(requestedPipeline.id)
    setAgentPipelineName(requestedPipeline.name)
    setPipelineDescription(requestedPipeline.description ?? '')
    setPipelineVariables(requestedPipeline.variables ?? [])
    setVariableValues(buildDefaultVariableValues(requestedPipeline.variables))
    setPipelineBudget(requestedPipeline.budget)
    setAgentPipeline(requestedPipeline.steps)
    setLiveSteps([])
    setActiveExecution(null)
  }, [requestedPipelineId, agentPipelines, setSelectedAgentPipelineId, setAgentPipelineName, setAgentPipeline])

  useEffect(() => {
    if (!selectedAgentPipelineId || pipeline.length > 0 || agentPipelineName.trim()) return
    const selectedPipeline = agentPipelines.find((item) => item.id === selectedAgentPipelineId)
    if (!selectedPipeline) return
    setAgentPipeline(selectedPipeline.steps)
    setAgentPipelineName(selectedPipeline.name)
    setPipelineDescription(selectedPipeline.description ?? '')
    setPipelineVariables(selectedPipeline.variables ?? [])
    setVariableValues(buildDefaultVariableValues(selectedPipeline.variables))
    setPipelineBudget(selectedPipeline.budget)
  }, [selectedAgentPipelineId, agentPipelines, pipeline.length, agentPipelineName, setAgentPipeline, setAgentPipelineName])

  useEffect(() => {
    if (!workspacePath || !selectedAgentPipelineId) {
      setPipelineHistory([])
      setSelectedExecutionId(null)
      return
    }

    loadPipelineExecutionsFromDisk(workspacePath, selectedAgentPipelineId).then((executions) => {
      setPipelineHistory(executions)
      setSelectedExecutionId((current) => {
        if (requestedExecutionId && executions.some((execution) => execution.id === requestedExecutionId)) {
          return requestedExecutionId
        }

        if (requestedTimerId) {
          const timerMatches = executions.filter((execution) => execution.timerId === requestedTimerId)
          if (timerMatches.length > 0) {
            const matchedExecution = Number.isFinite(requestedFiredAt)
              ? timerMatches
                  .slice()
                  .sort((left, right) => Math.abs(left.startedAt - requestedFiredAt) - Math.abs(right.startedAt - requestedFiredAt))[0]
              : timerMatches[0]
            if (matchedExecution) {
              return matchedExecution.id
            }
          }
        }

        return getValidExecutionId(current, executions)
      })
    })
  }, [workspacePath, selectedAgentPipelineId, requestedExecutionId, requestedTimerId, requestedFiredAt])

  useEffect(() => {
    if (!requestedPipelineId && !requestedExecutionId && !requestedTimerId) return
    if (requestedPipelineId && selectedAgentPipelineId !== requestedPipelineId) return
    if (requestedExecutionId && pipelineHistory.length > 0 && !pipelineHistory.some((execution) => execution.id === requestedExecutionId)) {
      setSearchParams({}, { replace: true })
      return
    }
    if (!requestedExecutionId && requestedTimerId && pipelineHistory.length > 0 && !selectedExecutionId) return
    if (requestedExecutionId && selectedExecutionId !== requestedExecutionId) return
    setSearchParams({}, { replace: true })
  }, [requestedPipelineId, requestedExecutionId, requestedTimerId, selectedAgentPipelineId, selectedExecutionId, pipelineHistory, setSearchParams])

  const filteredPipelines = useMemo(() => {
    const keyword = deferredSearchQuery.trim().toLowerCase()
    if (!keyword) return agentPipelines
    return agentPipelines.filter((item) => item.name.toLowerCase().includes(keyword))
  }, [agentPipelines, deferredSearchQuery])

  const selectedHistoryExecution = useMemo(
    () => pipelineHistory.find((execution) => execution.id === selectedExecutionId) ?? null,
    [pipelineHistory, selectedExecutionId],
  )

  const monitorSteps = useMemo(() => {
    if (liveSteps.length > 0) return liveSteps
    if (activeExecution) return activeExecution.steps.map((step) => mapExecutionStep(step, agentNameMap))
    return []
  }, [liveSteps, activeExecution, agentNameMap])

  const executionDetail = selectedHistoryExecution ?? (!selectedSavedPipeline ? activeExecution : null)
  const executionDetailSteps = useMemo(
    () => executionDetail?.steps.map((step) => mapExecutionStep(step, agentNameMap)) ?? [],
    [executionDetail, agentNameMap],
  )

  const completedMonitorSteps = useMemo(
    () => monitorSteps.filter((step) => step.status === 'success' || step.status === 'error' || step.status === 'skipped').length,
    [monitorSteps],
  )

  const successfulHistoryRuns = useMemo(
    () => pipelineHistory.filter((execution) => execution.status === 'success').length,
    [pipelineHistory],
  )

  const pipelineValidation = useMemo(
    () => validateAgentPipeline(
      { name: agentPipelineName.trim() || 'Draft Pipeline', steps: pipeline, variables: pipelineVariables, budget: pipelineBudget },
      agents,
      models,
    ),
    [agentPipelineName, pipeline, pipelineVariables, pipelineBudget, agents, models],
  )

  const successRate = pipelineHistory.length > 0
    ? Math.round((successfulHistoryRuns / pipelineHistory.length) * 100)
    : 0

  const resetPipelineEditor = () => {
    setSelectedAgentPipelineId(null)
    setAgentPipelineName('')
    setPipelineDescription('')
    setPipelineVariables([])
    setVariableValues({})
    setPipelineBudget(undefined)
    clearAgentPipeline()
    setPipelineHistory([])
    setLiveSteps([])
    setActiveExecution(null)
    setSelectedExecutionId(null)
  }

  const loadSavedPipeline = (pipelineId: string) => {
    const selectedPipeline = agentPipelines.find((item) => item.id === pipelineId)
    if (!selectedPipeline) return
    setSelectedAgentPipelineId(selectedPipeline.id)
    setAgentPipelineName(selectedPipeline.name)
    setPipelineDescription(selectedPipeline.description ?? '')
    setPipelineVariables(selectedPipeline.variables ?? [])
    setVariableValues(buildDefaultVariableValues(selectedPipeline.variables))
    setPipelineBudget(selectedPipeline.budget)
    setAgentPipeline(selectedPipeline.steps)
    setLiveSteps([])
    setActiveExecution(null)
  }

  const replacePipelineDraft = (nextPipeline: AgentPipelineStep[]) => {
    setAgentPipeline(nextPipeline)
    setLiveSteps([])
    setActiveExecution(null)
  }

  const exportCurrentPipeline = async () => {
    const trimmedName = agentPipelineName.trim() || selectedSavedPipeline?.name || 'Pipeline'
    const sanitizedBudget: AgentPipelineBudget | undefined = pipelineBudget
      && (pipelineBudget.maxTotalDurationMs || pipelineBudget.maxTotalTokens || pipelineBudget.maxStepCount)
      ? {
        ...(pipelineBudget.maxTotalDurationMs ? { maxTotalDurationMs: pipelineBudget.maxTotalDurationMs } : {}),
        ...(pipelineBudget.maxTotalTokens ? { maxTotalTokens: pipelineBudget.maxTotalTokens } : {}),
        ...(pipelineBudget.maxStepCount ? { maxStepCount: pipelineBudget.maxStepCount } : {}),
      }
      : undefined
    const json = serializePipelineExport({
      id: selectedSavedPipeline?.id ?? generateId('pipeline-export'),
      name: trimmedName,
      ...(pipelineDescription.trim() ? { description: pipelineDescription.trim() } : {}),
      steps: pipeline,
      ...(pipelineVariables.length > 0 ? { variables: pipelineVariables } : {}),
      ...(sanitizedBudget ? { budget: sanitizedBudget } : {}),
      createdAt: selectedSavedPipeline?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    })

    let copied = false
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(json)
        copied = true
      } catch {
        copied = false
      }
    }
    addNotification({
      id: generateId('notif'),
      type: 'success',
      title: t('agents.pipelineExportTitle', 'Pipeline exported'),
      message: copied
        ? t('agents.pipelineExportCopied', 'Pipeline JSON copied to clipboard.')
        : t('agents.pipelineExportFallback', 'Could not access clipboard — JSON written to console.'),
      timestamp: Date.now(),
      read: false,
    })
    if (!copied) {
      console.log('[suora] Pipeline export JSON:\n' + json)
    }
  }

  const runDryRunPreview = () => {
    const trimmedName = agentPipelineName.trim() || selectedSavedPipeline?.name || 'Draft Pipeline'
    const sanitizedBudget: AgentPipelineBudget | undefined = pipelineBudget
      && (pipelineBudget.maxTotalDurationMs || pipelineBudget.maxTotalTokens || pipelineBudget.maxStepCount)
      ? { ...pipelineBudget }
      : undefined
    const result = dryRunAgentPipeline(
      {
        id: selectedSavedPipeline?.id ?? generateId('pipeline-dry'),
        name: trimmedName,
        steps: pipeline,
        ...(pipelineVariables.length > 0 ? { variables: pipelineVariables } : {}),
        ...(sanitizedBudget ? { budget: sanitizedBudget } : {}),
        createdAt: selectedSavedPipeline?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      },
      { variables: variableValues },
    )
    setDryRunResult(result)
    addNotification({
      id: generateId('notif'),
      type: result.valid ? 'info' : 'warning',
      title: t('agents.pipelineDryRunResultTitle', 'Dry run complete'),
      message: t(
        'agents.pipelineDryRunMessage',
        `${result.steps.filter((step) => step.status === 'would-run').length} step(s) would run, ${result.steps.filter((step) => step.status === 'skipped').length} skipped, ${result.steps.filter((step) => step.status === 'error').length} error(s).`,
      ),
      timestamp: Date.now(),
      read: false,
    })
  }

  const importPipelineFromJson = async () => {
    const raw = typeof window !== 'undefined' ? window.prompt(t('agents.pipelineImportPrompt', 'Paste pipeline JSON to import:')) : null
    if (!raw) return
    try {
      const { pipeline: imported, warnings } = parsePipelineImport(raw)
      setSelectedAgentPipelineId(null)
      setAgentPipelineName(imported.name)
      setPipelineDescription(imported.description ?? '')
      setPipelineVariables(imported.variables ?? [])
      setVariableValues(buildDefaultVariableValues(imported.variables))
      setPipelineBudget(imported.budget)
      setAgentPipeline(imported.steps)
      setLiveSteps([])
      setActiveExecution(null)
      addNotification({
        id: generateId('notif'),
        type: warnings.length > 0 ? 'warning' : 'success',
        title: t('agents.pipelineImportTitle', 'Pipeline imported'),
        message: warnings.length > 0
          ? warnings.join(' ')
          : t('agents.pipelineImportSuccess', `${imported.name} loaded into the editor. Review and save to keep it.`).replace('{name}', imported.name),
        timestamp: Date.now(),
        read: false,
      })
    } catch (error) {
      const message = error instanceof PipelineImportError ? error.message : (error as Error).message
      addNotification({
        id: generateId('notif'),
        type: 'error',
        title: t('agents.pipelineImportFailedTitle', 'Pipeline import failed'),
        message,
        timestamp: Date.now(),
        read: false,
      })
    }
  }

  const addStep = () => {
    if (enabledAgents.length === 0) return
    replacePipelineDraft([...pipeline, { agentId: enabledAgents[0].id, task: '', enabled: true, continueOnError: true, retryCount: 0 }])
  }

  const removeStep = (idx: number) => {
    replacePipelineDraft(pipeline.filter((_, index) => index !== idx))
  }

  const updateStep = (idx: number, updates: Partial<AgentPipelineStep>) => {
    replacePipelineDraft(pipeline.map((step, index) => index === idx ? { ...step, ...updates } : step))
  }

  const moveStep = (idx: number, direction: -1 | 1) => {
    const targetIndex = idx + direction
    if (targetIndex < 0 || targetIndex >= pipeline.length) return
    const nextPipeline = [...pipeline]
    const [movedStep] = nextPipeline.splice(idx, 1)
    nextPipeline.splice(targetIndex, 0, movedStep)
    replacePipelineDraft(nextPipeline)
  }

  const duplicateStep = (idx: number) => {
    const step = pipeline[idx]
    if (!step) return
    const duplicateName = step.name?.trim()
      ? t('agents.pipelineStepCopyName', '{name} copy').replace('{name}', step.name.trim())
      : undefined
    replacePipelineDraft([
      ...pipeline.slice(0, idx + 1),
      {
        ...step,
        ...(duplicateName ? { name: duplicateName } : {}),
      },
      ...pipeline.slice(idx + 1),
    ])
  }

  const appendStepReference = (idx: number, token: string) => {
    replacePipelineDraft(
      pipeline.map((step, index) => {
        if (index !== idx) return step
        const nextTask = step.task.trim()
          ? `${step.task.replace(/\s+$/u, '')}\n${token}`
          : token
        return { ...step, task: nextTask }
      }),
    )
  }

  const savePipeline = async () => {
    if (!workspacePath || pipeline.length === 0) return
    if (!pipelineValidation.valid) {
      addNotification({
        id: generateId('notif'),
        type: 'warning',
        title: t('agents.pipelineDryRunFailedTitle', 'Pipeline validation failed'),
        message: pipelineValidation.errors[0]?.message ?? t('agents.pipelineDryRunFailedBody', 'Fix validation errors before saving.'),
        timestamp: Date.now(),
        read: false,
      })
      return
    }
    const trimmedName = agentPipelineName.trim()
    if (!trimmedName) {
      addNotification({
        id: generateId('notif'),
        type: 'warning',
        title: t('agents.pipelineNameRequiredTitle', 'Pipeline name required'),
        message: t('agents.pipelineNameRequiredBody', 'Name the pipeline before saving it.'),
        timestamp: Date.now(),
        read: false,
      })
      return
    }

    const now = Date.now()
    const savedPipeline = selectedSavedPipeline
    const trimmedDescription = pipelineDescription.trim()
    const sanitizedVariables = pipelineVariables
      .map((variable) => ({
        ...variable,
        name: variable.name.trim(),
        ...(variable.label?.trim() ? { label: variable.label.trim() } : { label: undefined }),
        ...(variable.description?.trim() ? { description: variable.description.trim() } : { description: undefined }),
      }))
      .filter((variable) => variable.name)
    const sanitizedBudget: AgentPipelineBudget | undefined = pipelineBudget
      && (pipelineBudget.maxTotalDurationMs || pipelineBudget.maxTotalTokens || pipelineBudget.maxStepCount)
      ? {
        ...(pipelineBudget.maxTotalDurationMs ? { maxTotalDurationMs: pipelineBudget.maxTotalDurationMs } : {}),
        ...(pipelineBudget.maxTotalTokens ? { maxTotalTokens: pipelineBudget.maxTotalTokens } : {}),
        ...(pipelineBudget.maxStepCount ? { maxStepCount: pipelineBudget.maxStepCount } : {}),
      }
      : undefined
    const nextPipeline: AgentPipeline = {
      id: savedPipeline?.id ?? generateId('pipeline'),
      name: trimmedName,
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
      steps: pipeline,
      ...(sanitizedVariables.length > 0 ? { variables: sanitizedVariables } : {}),
      ...(sanitizedBudget ? { budget: sanitizedBudget } : {}),
      createdAt: savedPipeline?.createdAt ?? now,
      updatedAt: now,
      lastRunAt: savedPipeline?.lastRunAt,
    }

    const success = await savePipelineToDisk(workspacePath, nextPipeline)
    if (!success) {
      addNotification({
        id: generateId('notif'),
        type: 'error',
        title: t('agents.pipelineSaveFailedTitle', 'Pipeline save failed'),
        message: t('agents.pipelineSaveFailedBody', 'Could not write the pipeline file to disk.'),
        timestamp: Date.now(),
        read: false,
      })
      return
    }

    if (savedPipeline) {
      updateAgentPipeline(savedPipeline.id, nextPipeline)
    } else {
      addAgentPipeline(nextPipeline)
    }

    setSelectedAgentPipelineId(nextPipeline.id)
    addNotification({
      id: generateId('notif'),
      type: 'success',
      title: t('agents.pipelineSavedTitle', 'Pipeline saved'),
      message: t('agents.pipelineSavedBody', `${nextPipeline.name} is now available for timers and history tracking.`).replace('{name}', nextPipeline.name),
      timestamp: Date.now(),
      read: false,
    })
  }

  const deletePipeline = async () => {
    if (!workspacePath || !selectedSavedPipeline) return
    const confirmed = await confirm({
      title: t('agents.pipelineDeleteTitle', 'Delete pipeline?'),
      body: t('agents.pipelineDeleteBody', `"${selectedSavedPipeline.name}" will be permanently removed from disk.`).replace('{name}', selectedSavedPipeline.name),
      danger: true,
      confirmText: t('common.delete', 'Delete'),
    })
    if (!confirmed) return

    const success = await deletePipelineFromDisk(workspacePath, selectedSavedPipeline.id)
    if (!success) {
      addNotification({
        id: generateId('notif'),
        type: 'error',
        title: t('agents.pipelineDeleteFailedTitle', 'Pipeline delete failed'),
        message: t('agents.pipelineDeleteFailedBody', 'Could not remove the pipeline file from disk.'),
        timestamp: Date.now(),
        read: false,
      })
      return
    }

    removeAgentPipeline(selectedSavedPipeline.id)
    resetPipelineEditor()
  }

  const runPipeline = async () => {
    if (enabledPipelineSteps.length === 0 || invalidEnabledSteps > 0 || !pipelineValidation.valid || running) return
    const previewSteps = buildPreviewSteps(pipeline, agentNameMap)
    const controller = new AbortController()
    runAbortControllerRef.current = controller
    setRunning(true)
    setSelectedExecutionId(null)
    setActiveExecution(null)
    setLiveSteps(previewSteps)

    try {
      const now = Date.now()
      const execution = await executeAgentPipeline({
        id: selectedSavedPipeline?.id ?? generateId('pipeline-draft'),
        name: agentPipelineName.trim() || selectedSavedPipeline?.name || 'Draft Pipeline',
        steps: pipeline,
        ...(pipelineVariables.length > 0 ? { variables: pipelineVariables } : {}),
        ...(pipelineBudget ? { budget: pipelineBudget } : {}),
        createdAt: selectedSavedPipeline?.createdAt ?? now,
        updatedAt: now,
        lastRunAt: selectedSavedPipeline?.lastRunAt,
      }, {
        trigger: 'manual',
        persistExecution: Boolean(selectedSavedPipeline && workspacePath),
        persistLastRun: Boolean(selectedSavedPipeline && workspacePath),
        abortSignal: controller.signal,
        ...(pipelineVariables.length > 0 ? { variables: variableValues } : {}),
        onStepUpdate: (progressStep) => {
          setLiveSteps((previous) => {
            // Step edits clear liveSteps immediately, so this rebuild only handles
            // late async updates arriving after a reset or pipeline switch.
            const next = previous.length === pipeline.length ? [...previous] : buildPreviewSteps(pipeline, agentNameMap)
            next[progressStep.stepIndex] = {
              ...next[progressStep.stepIndex],
              ...progressStep,
            }
            return next
          })
        },
      })

      setActiveExecution(execution)
      setLiveSteps(execution.steps.map((step) => mapExecutionStep(step, agentNameMap)))

      if (selectedSavedPipeline && workspacePath) {
        const executions = await loadPipelineExecutionsFromDisk(workspacePath, selectedSavedPipeline.id)
        setPipelineHistory(executions)
        setSelectedExecutionId(executions[0]?.id ?? null)
      }
    } finally {
      setRunning(false)
      runAbortControllerRef.current = null
    }
  }

  const cancelRunningPipeline = () => {
    const controller = runAbortControllerRef.current
    if (controller && !controller.signal.aborted) {
      controller.abort()
    }
  }

  // Guarantee the in-flight pipeline is cancelled if the user navigates away.
  useEffect(() => {
    return () => {
      const controller = runAbortControllerRef.current
      if (controller && !controller.signal.aborted) controller.abort()
    }
  }, [])

  const formatRelativeTime = (timestamp?: number) => {
    if (!timestamp) return t('agents.pipelineNeverRan', 'Never ran')
    const diff = Date.now() - timestamp
    if (diff < 60_000) return t('agents.justNow', 'Just now')
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    if (diff < 3_600_000) return formatter.format(-Math.floor(diff / 60_000), 'minute')
    if (diff < 86_400_000) return formatter.format(-Math.floor(diff / 3_600_000), 'hour')
    return formatter.format(-Math.floor(diff / 86_400_000), 'day')
  }

  const latestExecutionReference = useMemo(() => {
    if (executionDetailSteps.length > 0) return executionDetailSteps
    if (monitorSteps.length > 0) return monitorSteps
    return pipelineHistory[0]?.steps.map((step) => mapExecutionStep(step, agentNameMap)) ?? []
  }, [executionDetailSteps, monitorSteps, pipelineHistory, agentNameMap])

  const diagramProgressSteps = useMemo(() => {
    if (monitorSteps.length > 0) return monitorSteps
    if (executionDetailSteps.length > 0) return executionDetailSteps
    return buildPreviewSteps(pipeline, agentNameMap)
  }, [monitorSteps, executionDetailSteps, pipeline, agentNameMap])

  const mermaidSource = useMemo(() => buildPipelineMermaidSource(pipeline, {
    pipelineName: agentPipelineName.trim() || selectedSavedPipeline?.name || t('agents.pipelineDraft', 'Draft pipeline'),
    description: pipelineDescription.trim() || selectedSavedPipeline?.description,
    agentNameMap,
    progressSteps: diagramProgressSteps,
  }), [pipeline, agentPipelineName, selectedSavedPipeline, pipelineDescription, agentNameMap, diagramProgressSteps, t])

  const copyMermaidSource = async () => {
    try {
      await navigator.clipboard.writeText(mermaidSource)
      setCopiedMermaid(true)
      window.setTimeout(() => setCopiedMermaid(false), 1600)
    } catch {
      addNotification({
        id: generateId('notif'),
        type: 'error',
        title: t('agents.pipelineMermaidCopyFailedTitle', 'Could not copy diagram'),
        message: t('agents.pipelineMermaidCopyFailedBody', 'The Mermaid source could not be copied to the clipboard.'),
        timestamp: Date.now(),
        read: false,
      })
    }
  }

  return (
    <>
      <SidePanel
        title={t('agents.pipeline', 'Pipeline')}
        width={panelWidth}
        action={
          <button
            type="button"
            onClick={resetPipelineEditor}
            className="rounded-xl bg-accent/10 px-3 py-1.5 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/20"
          >
            + {t('common.new', 'New')}
          </button>
        }
      >
        <div className="module-sidebar-stack p-3 space-y-3">
          <div className="rounded-3xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/92 to-surface-2/70 p-4 shadow-[0_14px_40px_rgba(var(--t-accent-rgb),0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/55">{t('agents.pipeline', 'Pipeline')}</div>
                <div className="mt-1 text-[18px] font-semibold text-text-primary">{t('agents.pipelineWorkbench', 'Execution Workbench')}</div>
                <p className="mt-1 text-[12px] leading-relaxed text-text-secondary/80">{t('agents.pipelineWorkbenchHint', 'Design handoffs, inspect history, and keep a draft run ready without leaving the builder.')}</p>
              </div>
              <div className="rounded-2xl border border-accent/15 bg-surface-0/70 px-3 py-2 text-right shadow-sm">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{t('common.total', 'Total')}</div>
                <div className="text-xl font-semibold text-text-primary tabular-nums">{agentPipelines.length}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('agents.pipelineDraft', 'Draft')}</div>
                <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{enabledPipelineSteps.length}/{pipeline.length}</div>
              </div>
              <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('agents.pipelineHistory', 'History')}</div>
                <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{pipelineHistory.length}</div>
              </div>
              <div className="rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/45">{t('agents.pipelineSuccess', 'Success')}</div>
                <div className="mt-1 text-[15px] font-semibold text-text-primary tabular-nums">{pipelineHistory.length > 0 ? `${successRate}%` : '—'}</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="relative">
              <IconifyIcon name="ui-search" size={14} color="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('agents.searchPipelines', 'Search pipelines...')}
                className="w-full rounded-2xl border border-border bg-surface-2 py-2.5 pl-9 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted/70">
              <span>{filteredPipelines.length} {t('common.results', 'results')}</span>
              {searchQuery.trim() && <span>{agentPipelines.length} {t('common.total', 'total')}</span>}
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={resetPipelineEditor}
              className={`w-full rounded-3xl border px-3.5 py-3.5 text-left transition-all ${
                !selectedSavedPipeline
                  ? 'border-accent/30 bg-accent/10 text-text-primary shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.12)]'
                  : 'border-border-subtle bg-surface-1/70 text-text-secondary hover:border-border hover:bg-surface-2/70'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-3 text-accent">
                    <IconifyIcon name="ui-edit" size={16} color="currentColor" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{agentPipelineName.trim() || t('agents.pipelineDraft', 'Draft pipeline')}</div>
                    <div className="mt-1 text-[11px] text-text-muted">{enabledPipelineSteps.length}/{pipeline.length} {t('agents.pipelineActiveSteps', 'active steps')} · {running ? t('agents.pipelineStatusRunning', 'Running') : t('common.ready', 'Ready')}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-text-muted">
                      <span className="rounded-full bg-surface-3/80 px-2 py-0.5">{selectedSavedPipeline ? t('agents.loaded', 'Loaded') : t('agents.editing', 'Editing')}</span>
                      <span className="rounded-full bg-surface-3/80 px-2 py-0.5">{completedMonitorSteps}/{pipeline.length || 0} {t('agents.pipelineProgress', 'progress')}</span>
                    </div>
                  </div>
                </div>
                {!selectedSavedPipeline && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">{t('agents.editing', 'Editing')}</span>}
              </div>
            </button>

            {filteredPipelines.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border-subtle px-4 py-8 text-center text-xs text-text-muted">
                {searchQuery.trim()
                  ? t('agents.noMatchingPipelines', 'No matching pipelines.')
                  : t('agents.noSavedPipelines', 'No saved pipelines yet.')}
              </div>
            ) : (
              filteredPipelines.map((savedPipeline) => (
                <button
                  key={savedPipeline.id}
                  type="button"
                  onClick={() => loadSavedPipeline(savedPipeline.id)}
                  className={`w-full rounded-3xl border px-3.5 py-3.5 text-left transition-all ${
                    selectedAgentPipelineId === savedPipeline.id
                      ? 'border-accent/30 bg-accent/10 text-text-primary shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.12)]'
                      : 'border-border-subtle bg-surface-1/70 text-text-secondary hover:border-border hover:bg-surface-2/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className="truncate text-[13px] font-medium">{savedPipeline.name}</div>
                        {selectedAgentPipelineId === savedPipeline.id && <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] text-accent">{t('agents.open', 'Open')}</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                        <span>{savedPipeline.steps.length} {t('agents.pipelineSteps', 'steps')}</span>
                        <span className="h-1 w-1 rounded-full bg-border" />
                        <span>{formatRelativeTime(savedPipeline.lastRunAt)}</span>
                      </div>
                      {savedPipeline.description && <div className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-text-secondary/80">{savedPipeline.description}</div>}
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-text-muted">
                        <span className="rounded-full bg-surface-3/80 px-2 py-0.5">{savedPipeline.lastRunAt ? t('agents.pipelineRecentRun', 'Recent run') : t('agents.pipelineUnsaved', 'Awaiting first run')}</span>
                      </div>
                    </div>
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-3 text-accent">
                      <IconifyIcon name="skill-agent-comm" size={15} color="currentColor" />
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </SidePanel>

      <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={224} maxWidth={360} />

      <div className="module-workspace flex min-w-0 flex-1 flex-col">
        <div className={`module-hero-strip border-b border-border-subtle px-6 py-5 ${PIPELINE_HEADER_BACKGROUND}`}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-text-muted">
                <span>{t('agents.pipeline', 'Pipeline')}</span>
                {selectedSavedPipeline && <span className="rounded-full border border-border-subtle bg-surface-3/80 px-2 py-0.5 text-[10px] normal-case tracking-normal text-text-secondary">{selectedSavedPipeline.id}</span>}
                <span className={`rounded-full border px-2 py-0.5 text-[10px] normal-case tracking-normal ${statusStyles(running ? 'running' : (activeExecution?.status ?? 'pending'))}`}>
                  {running ? t('agents.pipelineStatusRunning', 'Running') : t(`agents.pipelineStatus.${activeExecution?.status ?? 'pending'}`, activeExecution?.status ?? 'pending')}
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold text-text-primary">{agentPipelineName.trim() || t('agents.pipelineDraft', 'Draft pipeline')}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-muted">{pipelineDescription.trim() || selectedSavedPipeline?.description || t('agents.pipelineMonitorHint', 'Track every handoff, inspect upstream context, and review saved runs without leaving the pipeline canvas.')}</p>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] text-text-secondary">
              <span className="rounded-full border border-border-subtle bg-surface-0/60 px-2.5 py-1">{enabledPipelineSteps.length}/{pipeline.length} {t('agents.pipelineActiveSteps', 'active steps')}</span>
              {selectedSavedPipeline && <span className="rounded-full border border-border-subtle bg-surface-0/60 px-2.5 py-1">{pipelineHistory.length} {t('agents.pipelineRuns', 'runs')}</span>}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={resetPipelineEditor} className="rounded-xl bg-surface-3 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2">{t('common.new', 'New')}</button>
            <button type="button" onClick={() => replacePipelineDraft([])} disabled={pipeline.length === 0 || running} className="rounded-xl bg-surface-3 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-40">{t('common.clearAll', 'Clear All')}</button>
            <button type="button" onClick={() => void importPipelineFromJson()} className="rounded-xl bg-surface-3 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2">{t('agents.pipelineImport', 'Import JSON')}</button>
            <button type="button" onClick={() => void exportCurrentPipeline()} disabled={pipeline.length === 0} className="rounded-xl bg-surface-3 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-40">{t('agents.pipelineExport', 'Export JSON')}</button>
            <button type="button" onClick={runDryRunPreview} disabled={pipeline.length === 0} className="rounded-xl bg-surface-3 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-40" title={t('agents.pipelineDryRunButtonHint', 'Simulate the run without calling any model.')}>{t('agents.pipelineDryRunButton', 'Dry run')}</button>
            <button type="button" onClick={() => void savePipeline()} disabled={!workspacePath || pipeline.length === 0} className="rounded-xl bg-accent/15 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-40">{t('common.saveChanges', 'Save Changes')}</button>
            <button type="button" onClick={() => void deletePipeline()} disabled={!selectedSavedPipeline} className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-40">{t('common.delete', 'Delete')}</button>
            <button
              type="button"
              onClick={runPipeline}
              disabled={enabledPipelineSteps.length === 0 || invalidEnabledSteps > 0 || !pipelineValidation.valid || running}
              className="rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {running ? t('agents.runningPipeline', 'Running...') : t('agents.runPipeline', '▶ Run Pipeline')}
            </button>
            {running && (
              <button
                type="button"
                onClick={cancelRunningPipeline}
                className="rounded-xl bg-red-500/15 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/25"
                title={t('agents.cancelPipelineHint', 'Stop the running pipeline')}
              >
                {t('agents.cancelPipeline', '■ Cancel')}
              </button>
            )}
          </div>

          {dryRunResult && (
            <div className="mt-3 rounded-3xl border border-blue-500/20 bg-blue-500/8 px-4 py-3 text-xs text-blue-200">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{t('agents.pipelineDryRunResultTitle', 'Dry run preview')}</div>
                <button type="button" onClick={() => setDryRunResult(null)} className="text-text-muted hover:text-text-primary" aria-label={t('common.close', 'Close')}>×</button>
              </div>
              {dryRunResult.budgetExceeded && (
                <div className="mt-1 text-blue-100">
                  {t('agents.pipelineBudgetExceeded', 'Budget exceeded')}: {dryRunResult.budgetExceeded.type} {dryRunResult.budgetExceeded.observed}/{dryRunResult.budgetExceeded.limit}
                </div>
              )}
              <ol className="mt-2 space-y-1">
                {dryRunResult.steps.map((step) => {
                  const tone = step.status === 'would-run'
                    ? 'text-emerald-200'
                    : step.status === 'skipped' || step.status === 'disabled'
                      ? 'text-text-muted'
                      : 'text-red-200'
                  return (
                    <li key={step.stepIndex} className={tone}>
                      <span className="font-mono">#{step.stepIndex + 1}</span>{' '}
                      <span className="uppercase tracking-[0.12em]">{step.status}</span>
                      {step.modelId ? <span className="ml-2 text-text-muted">[{step.modelId}]</span> : null}
                      {step.reason ? <span className="ml-2 text-text-muted">— {step.reason}</span> : null}
                      {step.name ? <span className="ml-2">{step.name}</span> : null}
                    </li>
                  )
                })}
              </ol>
            </div>
          )}

          {pipelineValidation.issues.length > 0 && (
            <div className="mt-3 rounded-3xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-xs text-amber-200">
              <div className="font-semibold">{t('agents.pipelineDryRun', 'Dry-run validation')}</div>
              <div className="mt-2 space-y-1">
                {pipelineValidation.issues.slice(0, 5).map((issue) => (
                  <div key={`${issue.code}-${issue.stepIndex ?? 'pipeline'}-${issue.message}`}>
                    {issue.severity.toUpperCase()}: {issue.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.9fr)]">
          <div className="module-canvas min-h-0 overflow-y-auto px-6 py-6">
            <div className="space-y-6">
              <section className="rounded-[28px] border border-border-subtle bg-surface-1/75 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">{t('agents.pipelineBuilder', 'Pipeline builder')}</h2>
                    <p className="mt-1 text-xs text-text-muted">{t('agents.pipelineBuilderHint', 'Design each handoff and keep the upstream result visible directly on the canvas.')}</p>
                  </div>
                  <div className="rounded-full bg-surface-3 px-2.5 py-1 text-[11px] text-text-secondary">{pipeline.length} {t('agents.pipelineSteps', 'steps')}</div>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineName', 'Pipeline name')}</label>
                    <input
                      value={agentPipelineName}
                      onChange={(e) => setAgentPipelineName(e.target.value)}
                      placeholder={t('agents.pipelineName', 'Pipeline name')}
                      className="w-full rounded-2xl border border-border bg-surface-2 px-3 py-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineDescription', 'Description')}</label>
                    <textarea
                      value={pipelineDescription}
                      onChange={(event) => setPipelineDescription(event.target.value)}
                      placeholder={t('agents.pipelineDescriptionPlaceholder', 'What this workflow prepares, checks, or hands off...')}
                      rows={2}
                      className="w-full rounded-2xl border border-border bg-surface-2 px-3 py-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  <div className="rounded-2xl border border-border-subtle bg-surface-2/55 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineVariables', 'Variables')}</div>
                        <div className="mt-1 text-xs text-text-muted">{t('agents.pipelineVariablesHint', 'Declare run-time inputs, then reference them in any step task as {{vars.name}} or in runIf conditions as vars.name.')}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPipelineVariables((current) => [...current, { name: '' }])}
                        className="rounded-xl border border-border-subtle bg-surface-1/80 px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:border-accent/30 hover:text-accent"
                      >
                        {t('agents.pipelineAddVariable', '+ Add variable')}
                      </button>
                    </div>

                    {pipelineVariables.length === 0 ? (
                      <div className="mt-3 text-xs text-text-muted">{t('agents.pipelineNoVariables', 'No variables declared yet.')}</div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {pipelineVariables.map((variable, index) => (
                          <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                            <input
                              value={variable.name}
                              onChange={(event) => {
                                const next = event.target.value
                                setPipelineVariables((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: next } : item))
                              }}
                              placeholder={t('agents.pipelineVariableName', 'name')}
                              className="h-9 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                            />
                            <input
                              value={variable.label ?? ''}
                              onChange={(event) => {
                                const next = event.target.value
                                setPipelineVariables((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: next } : item))
                              }}
                              placeholder={t('agents.pipelineVariableLabel', 'Label (optional)')}
                              className="h-9 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                            />
                            <input
                              value={variable.defaultValue ?? ''}
                              onChange={(event) => {
                                const next = event.target.value
                                setPipelineVariables((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, defaultValue: next } : item))
                                if (!variable.name) return
                                setVariableValues((current) => {
                                  if (current[variable.name] !== undefined && current[variable.name] !== '') return current
                                  return { ...current, [variable.name]: next }
                                })
                              }}
                              placeholder={t('agents.pipelineVariableDefault', 'Default value')}
                              className="h-9 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setPipelineVariables((current) => current.filter((_, itemIndex) => itemIndex !== index))
                              }}
                              className="rounded-xl border border-border-subtle bg-surface-1/80 px-2 py-1 text-[11px] font-medium text-text-muted transition-colors hover:border-red-500/30 hover:text-red-300"
                            >
                              {t('common.remove', 'Remove')}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {pipelineVariables.length > 0 && (
                      <div className="mt-4 border-t border-border-subtle pt-3">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineRunValues', 'Run values')}</div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {pipelineVariables.filter((variable) => variable.name.trim()).map((variable) => (
                            <label key={variable.name} className="flex flex-col gap-1 text-xs text-text-secondary">
                              <span className="font-medium text-text-primary">{variable.label?.trim() || variable.name}</span>
                              <input
                                value={variableValues[variable.name] ?? ''}
                                onChange={(event) => {
                                  const next = event.target.value
                                  setVariableValues((current) => ({ ...current, [variable.name]: next }))
                                }}
                                placeholder={variable.defaultValue ?? ''}
                                className="h-9 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border-subtle bg-surface-2/55 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineBudget', 'Budget caps')}</div>
                        <div className="mt-1 text-xs text-text-muted">{t('agents.pipelineBudgetHint', 'Optional safety limits enforced by the runtime. Leave a field blank or zero to disable that cap. Remaining steps will be skipped when any cap is exceeded.')}</div>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <label className="flex flex-col gap-1 text-xs text-text-secondary">
                        <span>{t('agents.pipelineBudgetMaxDuration', 'Max duration (ms)')}</span>
                        <input
                          type="number"
                          min={0}
                          value={pipelineBudget?.maxTotalDurationMs ?? ''}
                          onChange={(event) => {
                            const raw = event.target.value
                            const parsed = raw === '' ? undefined : Math.max(0, Math.trunc(Number(raw)))
                            setPipelineBudget((current) => {
                              const next = { ...(current ?? {}), maxTotalDurationMs: parsed }
                              return next.maxTotalDurationMs || next.maxTotalTokens || next.maxStepCount ? next : undefined
                            })
                          }}
                          placeholder="0"
                          className="h-9 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-text-secondary">
                        <span>{t('agents.pipelineBudgetMaxTokens', 'Max total tokens')}</span>
                        <input
                          type="number"
                          min={0}
                          value={pipelineBudget?.maxTotalTokens ?? ''}
                          onChange={(event) => {
                            const raw = event.target.value
                            const parsed = raw === '' ? undefined : Math.max(0, Math.trunc(Number(raw)))
                            setPipelineBudget((current) => {
                              const next = { ...(current ?? {}), maxTotalTokens: parsed }
                              return next.maxTotalDurationMs || next.maxTotalTokens || next.maxStepCount ? next : undefined
                            })
                          }}
                          placeholder="0"
                          className="h-9 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-text-secondary">
                        <span>{t('agents.pipelineBudgetMaxSteps', 'Max steps')}</span>
                        <input
                          type="number"
                          min={0}
                          value={pipelineBudget?.maxStepCount ?? ''}
                          onChange={(event) => {
                            const raw = event.target.value
                            const parsed = raw === '' ? undefined : Math.max(0, Math.trunc(Number(raw)))
                            setPipelineBudget((current) => {
                              const next = { ...(current ?? {}), maxStepCount: parsed }
                              return next.maxTotalDurationMs || next.maxTotalTokens || next.maxStepCount ? next : undefined
                            })
                          }}
                          placeholder="0"
                          className="h-9 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {pipeline.map((step, idx) => {
                      const previewStep = latestExecutionReference[idx]
                      const previousOutput = idx > 0 ? latestExecutionReference[idx - 1]?.output : ''
                      const referenceTokens = idx > 0
                        ? [
                            {
                              label: t('agents.pipelineReferencePrevious', 'Previous output'),
                              token: '{{previous.output}}',
                            },
                            ...pipeline.slice(0, idx).map((_, referenceIndex) => ({
                              label: `${t('agents.pipelineStep', 'Step')} ${referenceIndex + 1} ${t('agents.pipelineOutput', 'output')}`,
                              token: buildStepOutputToken(referenceIndex),
                            })),
                          ]
                        : []
                      const usesReferences = step.task.includes('{{') && step.task.includes('}}')

                      return (
                        <div key={idx} className={`rounded-3xl border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-4 transition-opacity ${step.enabled === false ? 'opacity-65' : 'opacity-100'}`}>
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-accent/12 text-xs font-semibold text-accent shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.16)]">{idx + 1}</span>
                              <div>
                                <div className="text-xs uppercase tracking-[0.14em] text-text-muted">{t('agents.pipelineStep', 'Step')}</div>
                                <div className="mt-1 text-sm font-medium text-text-primary">{step.name?.trim() || agentNameMap[step.agentId] || t('agents.pipelineUnknownAgent', 'Unknown agent')}</div>
                                {step.name?.trim() && <div className="mt-0.5 text-xs text-text-muted">{agentNameMap[step.agentId] ?? t('agents.pipelineUnknownAgent', 'Unknown agent')}</div>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${statusStyles(previewStep?.status ?? 'pending')}`}>{t(`agents.pipelineStatus.${previewStep?.status ?? 'pending'}`, previewStep?.status ?? 'pending')}</span>
                              <button type="button" title={t('agents.moveStepUp', 'Move step up')} disabled={idx === 0} onClick={() => moveStep(idx, -1)} className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-30"><IconifyIcon name="ui-chevron-up" size={14} color="currentColor" /></button>
                              <button type="button" title={t('agents.moveStepDown', 'Move step down')} disabled={idx === pipeline.length - 1} onClick={() => moveStep(idx, 1)} className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-30"><IconifyIcon name="ui-chevron-down" size={14} color="currentColor" /></button>
                              <button type="button" title={t('agents.duplicateStep', 'Duplicate step')} onClick={() => duplicateStep(idx)} className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"><IconifyIcon name="ui-copy" size={14} color="currentColor" /></button>
                              <button type="button" title={t('agents.removeStep', 'Remove step')} onClick={() => removeStep(idx)} className="rounded-lg p-1 text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"><IconifyIcon name="ui-close" size={14} color="currentColor" /></button>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <input
                              value={step.name ?? ''}
                              onChange={(e) => updateStep(idx, { name: e.target.value })}
                              placeholder={t('agents.pipelineStepNamePlaceholder', 'Optional step label')}
                              className="w-full rounded-2xl border border-border bg-surface-2 px-3 py-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                            />
                            <select
                              value={step.agentId}
                              onChange={(e) => updateStep(idx, { agentId: e.target.value })}
                              aria-label={t('agents.pipelineAgent', 'Pipeline agent')}
                              className="w-full rounded-2xl border border-border bg-surface-2 px-3 py-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                            >
                              {enabledAgents.map((agent) => <option key={agent.id} value={agent.id}>{agentNameMap[agent.id] ?? agent.name}</option>)}
                            </select>
                            <textarea
                              value={step.task}
                              onChange={(e) => updateStep(idx, { task: e.target.value })}
                              placeholder={t('agents.taskDesc', 'Task description...')}
                              rows={3}
                              className="w-full rounded-2xl border border-border bg-surface-2 px-3 py-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                            />

                            <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                              <input
                                type="checkbox"
                                checked={step.enabled !== false}
                                onChange={(event) => updateStep(idx, { enabled: event.target.checked })}
                                className="h-4 w-4 accent-accent"
                              />
                              {t('agents.pipelineStepEnabled', 'Enabled')}
                            </label>

                            <details className="rounded-2xl border border-border-subtle bg-surface-2/35 px-3 py-2">
                              <summary className="cursor-pointer text-xs font-medium text-text-secondary">{t('common.advanced', 'Advanced')}</summary>
                              <div className="mt-3 space-y-3">
                                <div>
                                  <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineRunIf', 'Run if (condition)')}</label>
                                  <input
                                    value={step.runIf ?? ''}
                                    onChange={(event) => updateStep(idx, { runIf: event.target.value })}
                                    placeholder={t('agents.pipelineRunIfPlaceholder', "step1.status == 'success' && previous.output contains 'approved'")}
                                    className="w-full rounded-2xl border border-border bg-surface-1 px-3 py-2 font-mono text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                                  />
                                  <div className="mt-1 text-[11px] text-text-muted">{t('agents.pipelineRunIfHint', 'Skip this step when the condition is false. Supports step{N}.field, previous.field, vars.name, ==, !=, contains, not contains, matches, is empty, is not empty, combined with &&.')}</div>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">
                                  <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                                    <input
                                      type="checkbox"
                                      checked={step.continueOnError !== false}
                                      onChange={(event) => updateStep(idx, { continueOnError: event.target.checked })}
                                      className="h-4 w-4 accent-accent"
                                    />
                                    {t('agents.pipelineContinueOnError', 'Continue on error')}
                                  </label>
                                  <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                                    <span>{t('agents.pipelineRetryCount', 'Retries')}</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={3}
                                      value={normalizeRetryCount(step.retryCount)}
                                      onChange={(event) => updateStep(idx, { retryCount: normalizeRetryCount(Number(event.target.value)) })}
                                      className="h-8 w-16 rounded-xl border border-border bg-surface-1 px-2 text-right text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                                    />
                                  </label>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">
                                  <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                                    <span>{t('agents.pipelineRetryBackoff', 'Retry backoff (ms)')}</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={60_000}
                                      value={step.retryBackoffMs ?? ''}
                                      onChange={(event) => {
                                        const raw = event.target.value
                                        updateStep(idx, { retryBackoffMs: raw === '' ? undefined : Math.max(0, Math.trunc(Number(raw))) })
                                      }}
                                      placeholder="0"
                                      className="h-8 w-24 rounded-xl border border-border bg-surface-1 px-2 text-right text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                                    />
                                  </label>
                                  <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                                    <span>{t('agents.pipelineRetryStrategy', 'Retry strategy')}</span>
                                    <select
                                      value={step.retryBackoffStrategy ?? 'fixed'}
                                      onChange={(event) => updateStep(idx, { retryBackoffStrategy: event.target.value === 'exponential' ? 'exponential' : 'fixed' })}
                                      className="h-8 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                                    >
                                      <option value="fixed">{t('agents.pipelineRetryStrategyFixed', 'Fixed')}</option>
                                      <option value="exponential">{t('agents.pipelineRetryStrategyExponential', 'Exponential')}</option>
                                    </select>
                                  </label>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">
                                  <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                                    <span>{t('agents.pipelineStepModel', 'Model override')}</span>
                                    <select
                                      value={step.modelId ?? ''}
                                      onChange={(event) => updateStep(idx, { modelId: event.target.value || undefined })}
                                      className="h-8 max-w-[10rem] rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                                    >
                                      <option value="">{t('agents.pipelineStepModelDefault', 'Use agent default')}</option>
                                      {models.map((modelOption) => (
                                        <option key={modelOption.id} value={modelOption.id} disabled={modelOption.enabled === false}>
                                          {modelOption.name}{modelOption.enabled === false ? ` (${t('common.disabled', 'disabled')})` : ''}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                                    <span>{t('agents.pipelineStepOutputTransform', 'Output transform')}</span>
                                    <select
                                      value={step.outputTransform ?? ''}
                                      onChange={(event) => {
                                        const next = event.target.value as AgentPipelineStep['outputTransform'] | ''
                                        updateStep(idx, {
                                          outputTransform: next || undefined,
                                          // Clear the path when leaving json-path mode.
                                          ...(next !== 'json-path' ? { outputTransformPath: undefined } : {}),
                                        })
                                      }}
                                      className="h-8 max-w-[10rem] rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                                    >
                                      <option value="">{t('agents.pipelineStepOutputTransformNone', 'None')}</option>
                                      <option value="trim">{t('agents.pipelineStepOutputTransformTrim', 'Trim whitespace')}</option>
                                      <option value="first-line">{t('agents.pipelineStepOutputTransformFirstLine', 'First line')}</option>
                                      <option value="last-line">{t('agents.pipelineStepOutputTransformLastLine', 'Last line')}</option>
                                      <option value="json-path">{t('agents.pipelineStepOutputTransformJsonPath', 'JSON path')}</option>
                                    </select>
                                  </label>
                                </div>

                                {step.outputTransform === 'json-path' && (
                                  <div>
                                    <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                                      <span>{t('agents.pipelineStepOutputTransformPath', 'JSON path')}</span>
                                      <input
                                        type="text"
                                        value={step.outputTransformPath ?? ''}
                                        onChange={(event) => updateStep(idx, { outputTransformPath: event.target.value || undefined })}
                                        placeholder="data.items.0.name"
                                        className="h-8 w-56 rounded-xl border border-border bg-surface-1 px-2 text-right text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                                      />
                                    </label>
                                  </div>
                                )}

                                <div>
                                  <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                                    <span>{t('agents.pipelineStepExportVar', 'Export to variable')}</span>
                                    <input
                                      type="text"
                                      value={step.exportVar ?? ''}
                                      onChange={(event) => updateStep(idx, { exportVar: event.target.value || undefined })}
                                      placeholder={t('agents.pipelineStepExportVarPlaceholder', 'e.g. topic')}
                                      className="h-8 w-56 rounded-xl border border-border bg-surface-1 px-2 text-right text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                                    />
                                  </label>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-3">
                                  <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                                    <span>{t('agents.pipelineStepTimeout', 'Timeout ms')}</span>
                                    <input
                                      type="number"
                                      min={1000}
                                      value={step.timeoutMs ?? ''}
                                      onChange={(event) => updateStep(idx, { timeoutMs: event.target.value ? Math.max(1000, Number(event.target.value)) : undefined })}
                                      placeholder="300000"
                                      className="h-8 w-24 rounded-xl border border-border bg-surface-1 px-2 text-right text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                                    />
                                  </label>
                                  <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                                    <span>{t('agents.pipelineMaxInput', 'Max input')}</span>
                                    <input
                                      type="number"
                                      min={1000}
                                      value={step.maxInputChars ?? ''}
                                      onChange={(event) => updateStep(idx, { maxInputChars: event.target.value ? Math.max(1000, Number(event.target.value)) : undefined })}
                                      placeholder="80000"
                                      className="h-8 w-24 rounded-xl border border-border bg-surface-1 px-2 text-right text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                                    />
                                  </label>
                                  <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                                    <span>{t('agents.pipelineMaxOutput', 'Max output')}</span>
                                    <input
                                      type="number"
                                      min={1000}
                                      value={step.maxOutputChars ?? ''}
                                      onChange={(event) => updateStep(idx, { maxOutputChars: event.target.value ? Math.max(1000, Number(event.target.value)) : undefined })}
                                      placeholder="32000"
                                      className="h-8 w-24 rounded-xl border border-border bg-surface-1 px-2 text-right text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                                    />
                                  </label>
                                </div>

                            {idx > 0 && (
                              <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-2/45 px-3 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineReferences', 'Step references')}</div>
                                    <div className="mt-1 text-xs text-text-muted">{t('agents.pipelineReferencesHint', 'Insert upstream outputs into this task with template tokens before the step runs.')}</div>
                                  </div>
                                  {usesReferences && <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-medium text-accent">{t('agents.pipelineTemplateEnabled', 'Template active')}</span>}
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {referenceTokens.map((reference) => (
                                    <button
                                      key={`${idx}-${reference.token}`}
                                      type="button"
                                      onClick={() => appendStepReference(idx, reference.token)}
                                      className="rounded-full border border-border-subtle bg-surface-1/80 px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:border-accent/30 hover:bg-accent/8 hover:text-accent"
                                    >
                                      {reference.label}: {reference.token}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                          {idx > 0 && (
                            <div className="mt-4 rounded-2xl border border-dashed border-border-subtle bg-surface-2/60 px-3 py-3">
                              <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelinePreviousResult', 'Previous step result')}</div>
                              <div className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap text-sm text-text-secondary">
                                {previousOutput || t('agents.pipelineAwaitingPreviousResult', 'Run the pipeline to preview what this step receives from upstream.')}
                              </div>
                            </div>
                          )}

                          {previewStep?.output && (
                            <div className="mt-4 rounded-2xl border border-border-subtle bg-surface-2/40 px-3 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineLatestOutput', 'Latest output')}</div>
                                <div className="text-[11px] text-text-muted">{formatDuration(previewStep.durationMs, t)}</div>
                              </div>
                              <div className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap text-sm text-text-secondary">{previewStep.output}</div>
                            </div>
                          )}
                              </div>
                            </details>
                        </div>
                        </div>
                      )
                    })}

                    <button type="button" onClick={addStep} className="w-full rounded-2xl border border-dashed border-accent/30 bg-accent/5 px-4 py-3 text-sm font-medium text-accent transition-colors hover:bg-accent/10">{t('agents.addStep', '+ Add Step')}</button>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-border-subtle bg-surface-1/75 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">{t('agents.pipelineExecutionMonitor', 'Execution monitor')}</h2>
                    <p className="mt-1 text-xs text-text-muted">{t('agents.pipelineExecutionMonitorHint', 'Watch the current run unfold step by step, including the exact input each agent received.')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-text-secondary">
                    <span className="rounded-full bg-surface-3 px-2.5 py-1">{t('agents.pipelineLiveSteps', 'Visible steps')}: {monitorSteps.length || pipeline.length}</span>
                    <span className="rounded-full bg-surface-3 px-2.5 py-1">{t('agents.pipelineFinalOutput', 'Final output')}: {activeExecution?.finalOutput ? '✓' : '—'}</span>
                  </div>
                </div>

                {monitorSteps.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-border-subtle px-4 py-10 text-center text-xs text-text-muted">{t('agents.noPipelineResults', 'Run the pipeline to see step outputs here.')}</div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {monitorSteps.map((step) => (
                      <div key={`${step.stepIndex}-${step.agentId}-${step.startedAt ?? 'idle'}`} className="rounded-3xl border border-border bg-surface-0/40 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-text-primary">{step.name?.trim() || `${t('agents.pipelineStep', 'Step')} ${step.stepIndex + 1}`}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusStyles(step.status)}`}>{t(`agents.pipelineStatus.${step.status}`, step.status)}</span>
                            </div>
                            <div className="mt-2 text-sm text-text-secondary">{step.agentName || agentNameMap[step.agentId] || step.agentId}</div>
                            <div className="mt-1 text-xs text-text-muted">{formatDuration(step.durationMs, t)}{step.attempts && step.attempts > 1 ? ` · ${step.attempts} ${t('agents.pipelineAttempts', 'attempts')}` : ''}</div>
                            {step.usage && (
                              <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-2/60 px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                                <span aria-hidden="true">🜂</span>
                                <span>{formatUsageLabel(step.usage, t)}</span>
                              </div>
                            )}
                            {step.skipReason && step.status === 'skipped' && (
                              <div className="mt-1 text-[11px] text-text-muted">{step.skipReason}</div>
                            )}
                          </div>
                          {step.startedAt && <div className="text-xs text-text-muted">{new Date(step.startedAt).toLocaleString()}</div>}
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <div className="rounded-2xl border border-border-subtle bg-surface-2/60 px-3 py-3">
                            <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineInput', 'Input')}</div>
                            <div className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm text-text-secondary">{step.input || step.task}</div>
                          </div>
                          <div className="rounded-2xl border border-border-subtle bg-surface-2/60 px-3 py-3">
                            <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{step.status === 'skipped' ? t('agents.pipelineSkipped', 'Skipped') : (step.error ? t('agents.error', 'Error') : t('agents.output', 'Output'))}</div>
                            <div className={`mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm ${step.error && step.status !== 'skipped' ? 'text-red-300' : 'text-text-secondary'}`}>
                              {step.error || step.output || (step.status === 'running' ? t('agents.pipelineStreaming', 'Receiving output...') : t('agents.pipelineNoOutputYet', 'No output yet.'))}
                            </div>
                            {step.recoveryActions?.length ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {step.recoveryActions.map((action) => (
                                  <span key={`${action.id}-${action.stepIndex ?? step.stepIndex}`} className="rounded-full border border-warning/20 bg-warning/10 px-2.5 py-1 text-[10px] font-medium text-warning">
                                    {action.label}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>

          <aside className="min-h-0 border-t border-border-subtle xl:border-t-0 xl:border-l">
            <div className="module-canvas h-full overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                <section className="rounded-[28px] border border-border-subtle bg-surface-1/75 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-text-primary">{t('agents.pipelineWorkflowDiagram', 'Workflow diagram')}</h2>
                      <p className="mt-1 text-xs text-text-muted">{t('agents.pipelineWorkflowDiagramHint', 'Preview the pipeline as Mermaid, or copy the source into docs and markdown notes.')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyMermaidSource()}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-accent/25 hover:text-accent"
                    >
                      <IconifyIcon name={copiedMermaid ? 'ui-check' : 'ui-copy'} size={13} color="currentColor" />
                      {copiedMermaid ? t('common.copied', 'Copied') : t('agents.copyMermaid', 'Copy Mermaid')}
                    </button>
                  </div>

                  <div className="mt-4 inline-flex rounded-2xl border border-border-subtle bg-surface-2/60 p-1">
                    <button
                      type="button"
                      onClick={() => setDiagramView('preview')}
                      className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${diagramView === 'preview' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-primary'}`}
                    >
                      {t('agents.pipelineDiagramPreview', 'Preview')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiagramView('source')}
                      className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${diagramView === 'source' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-primary'}`}
                    >
                      {t('agents.pipelineDiagramSource', 'Mermaid')}
                    </button>
                  </div>

                  <div className="mt-4">
                    {diagramView === 'preview' ? (
                      <PipelineFlowDiagram steps={pipeline} progressSteps={diagramProgressSteps} agentNameMap={agentNameMap} />
                    ) : (
                      <pre className="max-h-96 overflow-auto rounded-2xl border border-border-subtle bg-surface-0/45 p-4 text-[11px] leading-relaxed text-text-secondary">
                        <code>{mermaidSource}</code>
                      </pre>
                    )}
                  </div>
                </section>

                <section className="rounded-[28px] border border-border-subtle bg-surface-1/75 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-text-primary">{t('agents.pipelineHistory', 'Execution History')}</h2>
                      <p className="mt-1 text-xs text-text-muted">{selectedSavedPipeline ? t('agents.pipelineHistoryHint', 'Recent executions for the selected saved pipeline.') : t('agents.pipelineHistoryHint', 'Save the pipeline first to keep execution history and let timers reference it.')}</p>
                    </div>
                    {selectedSavedPipeline && <span className="rounded-full bg-surface-3 px-2.5 py-1 text-[11px] text-text-secondary">{pipelineHistory.length}</span>}
                  </div>

                  {!selectedSavedPipeline ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center text-xs text-text-muted">{t('agents.pipelineHistoryHint', 'Save the pipeline first to keep execution history and let timers reference it.')}</div>
                  ) : pipelineHistory.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center text-xs text-text-muted">{t('agents.noPipelineHistory', 'No pipeline executions recorded yet.')}</div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {pipelineHistory.slice(0, 20).map((execution) => (
                        <button
                          key={execution.id}
                          type="button"
                          onClick={() => setSelectedExecutionId(execution.id)}
                          className={`w-full rounded-[22px] border p-4 text-left transition-all ${selectedExecutionId === execution.id ? 'border-accent/30 bg-accent/8 shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.12)]' : 'border-border bg-surface-0/40 hover:border-border-subtle hover:bg-surface-2/50'}`}
                        >
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className={`rounded-full border px-2 py-0.5 font-medium ${statusStyles(execution.status)}`}>{t(`agents.pipelineStatus.${execution.status}`, execution.status)}</span>
                            <span className="text-text-muted">{new Date(execution.startedAt).toLocaleString()}</span>
                          </div>
                          <div className="mt-3 text-[11px] text-text-muted">{formatTriggerLabel(execution.trigger, t)} · {execution.steps.length} {t('agents.pipelineSteps', 'steps')} · {formatDuration(execution.completedAt - execution.startedAt, t)}</div>
                          {(execution.error || execution.finalOutput) && (
                            <div className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-text-secondary">{execution.error || execution.finalOutput}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-[28px] border border-border-subtle bg-surface-1/75 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-text-primary">{t('agents.pipelineExecutionDetails', 'Execution details')}</h2>
                      <p className="mt-1 text-xs text-text-muted">{t('agents.pipelineExecutionDetailsHint', 'Inspect the exact handoff between steps, including errors and final output.')}</p>
                    </div>
                    {executionDetail && <span className={`rounded-full border px-2.5 py-1 text-[11px] ${statusStyles(executionDetail.status)}`}>{t(`agents.pipelineStatus.${executionDetail.status}`, executionDetail.status)}</span>}
                  </div>

                  {!executionDetail ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center text-xs text-text-muted">{selectedSavedPipeline ? t('agents.pipelineSelectRunHint', 'Select a saved run to inspect the full handoff between steps.') : t('agents.pipelineRunDraftHint', 'Run the draft pipeline to review each step handoff here.')}</div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-border-subtle bg-surface-2/50 px-4 py-3">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineTrigger', 'Trigger')}</div>
                          <div className="mt-2 text-sm font-medium text-text-primary">{formatTriggerLabel(executionDetail.trigger, t)}</div>
                        </div>
                        <div className="rounded-2xl border border-border-subtle bg-surface-2/50 px-4 py-3">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineSucceeded', 'Succeeded')}</div>
                          <div className="mt-2 text-sm font-medium text-text-primary">{executionDetail.steps.filter((step) => step.status === 'success').length}/{executionDetail.steps.length}</div>
                        </div>
                        <div className="rounded-2xl border border-border-subtle bg-surface-2/50 px-4 py-3">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineErrors', 'Errors')}</div>
                          <div className="mt-2 text-sm font-medium text-text-primary">{executionDetail.steps.filter((step) => step.status === 'error').length}</div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border-subtle bg-surface-2/50 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineFinalOutput', 'Final output')}</div>
                            <div className="mt-2 text-sm text-text-secondary whitespace-pre-wrap">{executionDetail.finalOutput || executionDetail.error || t('agents.pipelineNoOutputYet', 'No output yet.')}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1 text-xs text-text-muted">
                            <span>{formatDuration(executionDetail.completedAt - executionDetail.startedAt, t)}</span>
                            {executionDetail.usage && (
                              <span className="rounded-full border border-border-subtle bg-surface-2/60 px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                                {formatUsageLabel(executionDetail.usage, t)}
                              </span>
                            )}
                            {executionDetail.budgetExceeded && (
                              <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning" title={t('agents.pipelineBudgetExceededHint', 'Run aborted because a budget cap was exceeded.')}>
                                {t('agents.pipelineBudgetExceeded', 'Budget exceeded')}: {executionDetail.budgetExceeded.type} {executionDetail.budgetExceeded.observed}/{executionDetail.budgetExceeded.limit}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {executionDetailSteps.map((step) => (
                          <div key={`${executionDetail.id}-${step.stepIndex}`} className="rounded-[22px] border border-border bg-surface-0/40 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-text-primary">{step.name?.trim() || `${t('agents.pipelineStep', 'Step')} ${step.stepIndex + 1}`}</div>
                                <div className="mt-1 text-xs text-text-muted">{step.agentName || step.agentId}</div>
                                {step.usage && (
                                  <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-2/60 px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                                    {formatUsageLabel(step.usage, t)}
                                  </div>
                                )}
                                {step.skipReason && step.status === 'skipped' && (
                                  <div className="mt-1 text-[11px] text-text-muted">{step.skipReason}</div>
                                )}
                              </div>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusStyles(step.status)}`}>{t(`agents.pipelineStatus.${step.status}`, step.status)}</span>
                            </div>
                            <div className="mt-3 grid gap-3">
                              <div className="rounded-2xl border border-border-subtle bg-surface-2/60 px-3 py-3">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineInput', 'Input')}</div>
                                <div className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-sm text-text-secondary">{step.input}</div>
                              </div>
                              <div className="rounded-2xl border border-border-subtle bg-surface-2/60 px-3 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{step.status === 'skipped' ? t('agents.pipelineSkipped', 'Skipped') : (step.error ? t('agents.error', 'Error') : t('agents.output', 'Output'))}</div>
                                  <div className="text-[11px] text-text-muted">{formatDuration(step.durationMs, t)}{step.attempts && step.attempts > 1 ? ` · ${step.attempts} ${t('agents.pipelineAttempts', 'attempts')}` : ''}</div>
                                </div>
                                <div className={`mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-sm ${step.error && step.status !== 'skipped' ? 'text-red-300' : 'text-text-secondary'}`}>{step.error || step.output || t('agents.pipelineNoOutputYet', 'No output yet.')}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
