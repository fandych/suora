import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { getMessageLog } from '@/services/agentCommunication'
import { executeAgentPipeline } from '@/services/agentPipelineService'
import { deletePipelineFromDisk, loadPipelineExecutionsFromDisk, loadPipelinesFromDisk, savePipelineToDisk } from '@/services/pipelineFiles'
import { confirm } from '@/services/confirmDialog'
import { ICON_DATA, AgentAvatar, IconifyIcon } from '@/components/icons/IconifyIcons'
import type { Agent, AgentMessage, AgentPipelineExecution } from '@/types'
import { generateId } from '@/utils/helpers'
import {
  SettingsStat,
  settingsDangerButtonClass,
  settingsInputClass,
  settingsSecondaryButtonClass,
  settingsSelectClass,
  settingsSoftButtonClass,
} from '@/components/settings/panelUi'

type OrchestrationTab = 'orchestrate' | 'communications' | 'versions' | 'performance'

const DEFAULT_TABS: OrchestrationTab[] = ['orchestrate', 'communications', 'versions', 'performance']

interface AgentOrchestrationPanelProps {
  agents: Agent[]
  onClose?: () => void
  title?: string
  allowedTabs?: OrchestrationTab[]
  initialTab?: OrchestrationTab
}

const orchestrationInputClass = `${settingsInputClass} rounded-xl px-3 py-2 text-xs`
const orchestrationSelectClass = `${settingsSelectClass} rounded-xl px-3 py-2 text-xs`
const orchestrationSecondaryButtonClass = `${settingsSecondaryButtonClass} rounded-xl px-3 py-2 text-xs`
const orchestrationSoftButtonClass = `${settingsSoftButtonClass} rounded-xl px-3 py-2 text-xs`
const orchestrationDangerButtonClass = `${settingsDangerButtonClass} rounded-xl px-3 py-2 text-xs`
const orchestrationCardClass = 'rounded-3xl border border-border-subtle/55 bg-surface-0/60 p-4'

export function AgentOrchestrationPanel({
  agents,
  onClose,
  title,
  allowedTabs = DEFAULT_TABS,
  initialTab,
}: AgentOrchestrationPanelProps) {
  const { t } = useI18n()
  const availableTabs = allowedTabs.length > 0 ? allowedTabs : DEFAULT_TABS
  const fallbackTab = initialTab && availableTabs.includes(initialTab) ? initialTab : availableTabs[0]
  const [tab, setTab] = useState<OrchestrationTab>(fallbackTab)
  const [pipelineResult, setPipelineResult] = useState<string[]>([])
  const [pipelineHistory, setPipelineHistory] = useState<AgentPipelineExecution[]>([])
  const [running, setRunning] = useState(false)
  // Communications
  const [msgLog, setMsgLog] = useState<readonly AgentMessage[]>([])
  // Versions
  const {
    workspacePath,
    agentVersions,
    agentPerformance,
    clearAgentPerformance,
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

  const supportsPipeline = availableTabs.includes('orchestrate')
  const supportsCommunications = availableTabs.includes('communications')

  useEffect(() => {
    if (!availableTabs.includes(tab)) {
      setTab(availableTabs[0])
    }
  }, [availableTabs, tab])

  useEffect(() => {
    if (!supportsCommunications) return
    const interval = setInterval(() => setMsgLog(getMessageLog()), 2000)
    return () => clearInterval(interval)
  }, [supportsCommunications])

  useEffect(() => {
    if (!supportsPipeline || !workspacePath) return
    if (!workspacePath) return
    loadPipelinesFromDisk(workspacePath).then((savedPipelines) => {
      setAgentPipelines(savedPipelines)
    })
  }, [supportsPipeline, workspacePath, setAgentPipelines])

  useEffect(() => {
    if (!supportsPipeline) return
    if (!selectedAgentPipelineId || pipeline.length > 0 || agentPipelineName.trim()) return
    const selectedPipeline = agentPipelines.find((item) => item.id === selectedAgentPipelineId)
    if (!selectedPipeline) return
    setAgentPipeline(selectedPipeline.steps)
    setAgentPipelineName(selectedPipeline.name)
  }, [supportsPipeline, selectedAgentPipelineId, agentPipelines, pipeline.length, agentPipelineName, setAgentPipeline, setAgentPipelineName])

  useEffect(() => {
    if (!supportsPipeline) {
      setPipelineHistory([])
      return
    }
    if (!workspacePath || !selectedAgentPipelineId) {
      setPipelineHistory([])
      return
    }

    loadPipelineExecutionsFromDisk(workspacePath, selectedAgentPipelineId).then(setPipelineHistory)
  }, [supportsPipeline, workspacePath, selectedAgentPipelineId])

  const enabledAgents = agents.filter((a) => a.enabled !== false)
  const selectedSavedPipeline = selectedAgentPipelineId
    ? agentPipelines.find((item) => item.id === selectedAgentPipelineId) ?? null
    : null

  const resetPipelineEditor = () => {
    setSelectedAgentPipelineId(null)
    setAgentPipelineName('')
    clearAgentPipeline()
    setPipelineResult([])
    setPipelineHistory([])
  }

  const loadSavedPipeline = (pipelineId: string) => {
    const selectedPipeline = agentPipelines.find((item) => item.id === pipelineId)
    if (!selectedPipeline) return
    setSelectedAgentPipelineId(selectedPipeline.id)
    setAgentPipelineName(selectedPipeline.name)
    setAgentPipeline(selectedPipeline.steps)
    setPipelineResult([])
  }

  const addStep = () => {
    if (enabledAgents.length === 0) return
    setAgentPipeline([...pipeline, { agentId: enabledAgents[0].id, task: '' }])
  }

  const removeStep = (idx: number) => setAgentPipeline(pipeline.filter((_, i) => i !== idx))

  const updateStep = (idx: number, updates: Partial<{ agentId: string; task: string }>) => {
    setAgentPipeline(pipeline.map((step, index) => index === idx ? { ...step, ...updates } : step))
  }

  const savePipeline = async () => {
    if (!workspacePath || pipeline.length === 0) return
    const trimmedName = agentPipelineName.trim()
    if (!trimmedName) {
      addNotification({
        id: generateId('notif'),
        type: 'warning',
        title: 'Pipeline name required',
        message: 'Name the pipeline before saving it.',
        timestamp: Date.now(),
        read: false,
      })
      return
    }

    const now = Date.now()
    const savedPipeline = selectedSavedPipeline
    const nextPipeline = {
      id: savedPipeline?.id ?? generateId('pipeline'),
      name: trimmedName,
      steps: pipeline,
      createdAt: savedPipeline?.createdAt ?? now,
      updatedAt: now,
      lastRunAt: savedPipeline?.lastRunAt,
    }

    const success = await savePipelineToDisk(workspacePath, nextPipeline)
    if (!success) {
      addNotification({
        id: generateId('notif'),
        type: 'error',
        title: 'Pipeline save failed',
        message: 'Could not write the pipeline file to disk.',
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
      title: 'Pipeline saved',
      message: `${nextPipeline.name} is now available for timers and history tracking.`,
      timestamp: Date.now(),
      read: false,
    })
  }

  const deletePipeline = async () => {
    if (!workspacePath || !selectedSavedPipeline) return
    const confirmed = await confirm({
      title: 'Delete pipeline?',
      body: `"${selectedSavedPipeline.name}" will be permanently removed from disk.`,
      danger: true,
      confirmText: 'Delete',
    })
    if (!confirmed) return

    const success = await deletePipelineFromDisk(workspacePath, selectedSavedPipeline.id)
    if (!success) {
      addNotification({
        id: generateId('notif'),
        type: 'error',
        title: 'Pipeline delete failed',
        message: 'Could not remove the pipeline file from disk.',
        timestamp: Date.now(),
        read: false,
      })
      return
    }

    removeAgentPipeline(selectedSavedPipeline.id)
    resetPipelineEditor()
  }

  const runPipeline = async () => {
    if (pipeline.length === 0 || running) return
    setRunning(true)
    setPipelineResult([])
    try {
      const now = Date.now()
      const execution = await executeAgentPipeline({
        id: selectedSavedPipeline?.id ?? generateId('pipeline-draft'),
        name: agentPipelineName.trim() || selectedSavedPipeline?.name || 'Draft Pipeline',
        steps: pipeline,
        createdAt: selectedSavedPipeline?.createdAt ?? now,
        updatedAt: now,
        lastRunAt: selectedSavedPipeline?.lastRunAt,
      }, {
        trigger: 'manual',
        persistExecution: Boolean(selectedSavedPipeline && workspacePath),
        persistLastRun: Boolean(selectedSavedPipeline && workspacePath),
      })

      setPipelineResult(execution.steps.map((step) => step.status === 'success' ? (step.output || '') : (step.error || 'Step failed')))

      if (selectedSavedPipeline && workspacePath) {
        setPipelineHistory(await loadPipelineExecutionsFromDisk(workspacePath, selectedSavedPipeline.id))
      }
    } finally {
      setRunning(false)
    }
  }

  const TABS: { id: OrchestrationTab; label: string; icon: string }[] = availableTabs.map((tabId) => {
    switch (tabId) {
      case 'orchestrate':
        return { id: tabId, label: t('agents.pipeline', 'Pipeline'), icon: 'skill-agent-comm' }
      case 'communications':
        return { id: tabId, label: t('agents.messages', 'Messages'), icon: 'action-chat' }
      case 'versions':
        return { id: tabId, label: t('agents.versions', 'Versions'), icon: 'settings-audit' }
      case 'performance':
        return { id: tabId, label: t('agents.analytics', 'Analytics'), icon: 'settings-performance' }
    }
  })

  return (
    <div className="flex-1 flex flex-col bg-surface-1 overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-text-primary">{title ?? t('agents.agentHub', 'Agent Hub')}</h2>
        {onClose && <button title={t('common.close', 'Close')} onClick={onClose} className="text-text-muted hover:text-text-primary text-xs"><IconifyIcon name="ui-close" size={14} color="currentColor" /></button>}
      </div>

      {TABS.length > 1 && <div className="flex gap-1 px-4 py-2 border-b border-border-subtle shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-medium transition-all ${tab === t.id ? 'border-accent/20 bg-accent/10 text-accent' : 'border-transparent text-text-muted hover:border-border-subtle/55 hover:bg-surface-0/60 hover:text-text-secondary'}`}
          >
            {ICON_DATA[t.icon] ? <IconifyIcon name={t.icon} size={14} /> : t.icon} {t.label}
          </button>
        ))}
      </div>}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SettingsStat label={t('agents.enabledAgents', 'Enabled Agents')} value={`${enabledAgents.length}`} accent />
          <SettingsStat label={t('agents.pipeline', 'Pipeline')} value={`${agentPipelines.length}`} />
          <SettingsStat label={t('agents.messages', 'Messages')} value={`${msgLog.length}`} />
          <SettingsStat label={t('agents.analytics', 'Analytics')} value={`${Object.keys(agentPerformance).length}`} />
        </div>

        {/* ── Pipeline Orchestration ── */}
        {tab === 'orchestrate' && (
          <div className={`${orchestrationCardClass} space-y-3`}>
            <p className="text-xs text-text-muted">{t('agents.pipelineDesc', 'Chain agents in a pipeline. Each agent receives the previous output.')}</p>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
              <select
                value={selectedAgentPipelineId ?? ''}
                aria-label={t('agents.savedPipelines', 'Saved pipelines')}
                onChange={(e) => {
                  const value = e.target.value
                  if (!value) {
                    resetPipelineEditor()
                    return
                  }
                  loadSavedPipeline(value)
                }}
                className={orchestrationSelectClass}
              >
                <option value="">{t('agents.pipelineDraft', 'Draft pipeline')}</option>
                {agentPipelines.map((savedPipeline) => (
                  <option key={savedPipeline.id} value={savedPipeline.id}>{savedPipeline.name}</option>
                ))}
              </select>
              <button onClick={resetPipelineEditor} className={orchestrationSecondaryButtonClass}>{t('common.new', 'New')}</button>
              <button onClick={() => void savePipeline()} disabled={!workspacePath || pipeline.length === 0} className={orchestrationSoftButtonClass}>{t('common.saveChanges', 'Save Changes')}</button>
              <button onClick={() => void deletePipeline()} disabled={!selectedSavedPipeline} className={orchestrationDangerButtonClass}>{t('common.delete', 'Delete')}</button>
            </div>
            <input
              value={agentPipelineName}
              onChange={(e) => setAgentPipelineName(e.target.value)}
              placeholder={t('agents.pipelineName', 'Pipeline name')}
              className={orchestrationInputClass}
            />
            <p className="text-[10px] text-text-muted">{t('agents.pipelineFileHint', 'Saved pipelines are stored as separate JSON files in the workspace and can be triggered by timers.')}</p>
            {pipeline.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2 p-3 rounded-xl border border-border bg-surface-0/30">
                <span className="text-xs text-text-muted pt-2 w-6 text-center shrink-0">{idx + 1}.</span>
                <div className="flex-1 space-y-2">
                  <select
                    value={step.agentId}
                    onChange={(e) => updateStep(idx, { agentId: e.target.value })}
                    aria-label="Pipeline agent"
                    className={orchestrationSelectClass}
                  >
                    {enabledAgents.map((a) => <option key={a.id} value={a.id}>{ICON_DATA[a.avatar || ''] ? '●' : (a.avatar || '●')} {a.name}</option>)}
                  </select>
                  <input
                    value={step.task}
                    onChange={(e) => updateStep(idx, { task: e.target.value })}
                    placeholder={t('agents.taskDesc', 'Task description...')}
                    className={orchestrationInputClass}
                  />
                </div>
                <button title={t('agents.removeStep', 'Remove step')} onClick={() => removeStep(idx)} className="text-xs text-text-muted hover:text-danger pt-2"><IconifyIcon name="ui-close" size={14} color="currentColor" /></button>
              </div>
            ))}
            {pipelineResult.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-text-primary">{t('agents.results', 'Results')}</h4>
                {pipelineResult.map((r, i) => (
                  <div key={i} className="p-2 rounded-lg bg-surface-2 border border-border-subtle text-xs text-text-secondary whitespace-pre-wrap max-h-40 overflow-y-auto">
                    <span className="text-text-muted">Step {i + 1}: </span>{r.slice(0, 500)}{r.length > 500 ? '...' : ''}
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-text-primary">{t('agents.pipelineHistory', 'Execution History')}</h4>
              {!selectedSavedPipeline ? (
                <p className="text-xs text-text-muted">{t('agents.pipelineHistoryHint', 'Save the pipeline first to keep execution history and let timers reference it.')}</p>
              ) : pipelineHistory.length === 0 ? (
                <p className="text-xs text-text-muted">{t('agents.noPipelineHistory', 'No pipeline executions recorded yet.')}</p>
              ) : (
                pipelineHistory.slice(0, 10).map((execution) => (
                  <div key={execution.id} className="p-3 rounded-xl border border-border bg-surface-0/30 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-medium ${execution.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>{execution.status}</span>
                      <span className="text-text-muted">{new Date(execution.startedAt).toLocaleString()}</span>
                    </div>
                    <div className="text-[10px] text-text-muted">{execution.trigger === 'timer' ? t('agents.pipelineTriggeredByTimer', 'Triggered by timer') : t('agents.pipelineTriggeredManually', 'Triggered manually')} · {execution.steps.length} {t('agents.pipelineSteps', 'steps')}</div>
                    {(execution.error || execution.finalOutput) && (
                      <div className="text-xs text-text-secondary whitespace-pre-wrap">{execution.error || execution.finalOutput}</div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={addStep} className={orchestrationSecondaryButtonClass}>{t('agents.addStep', '+ Add Step')}</button>
              <button onClick={() => clearAgentPipeline()} disabled={pipeline.length === 0 || running} className={orchestrationSecondaryButtonClass}>{t('common.clearAll', 'Clear All')}</button>
              <button
                onClick={runPipeline}
                disabled={pipeline.length === 0 || running || pipeline.some((s) => !s.task.trim())}
                className={orchestrationSoftButtonClass}
              >
                {running ? t('agents.runningPipeline', 'Running...') : t('agents.runPipeline', '▶ Run Pipeline')}
              </button>
            </div>
          </div>
        )}

        {/* ── Agent Communications Log ── */}
        {tab === 'communications' && (
          <div className={`${orchestrationCardClass} space-y-2`}>
            <p className="text-xs text-text-muted mb-3">{t('agents.agentMessagesHelp', 'Real-time log of agent-to-agent delegation messages.')}</p>
            {msgLog.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-8">{t('agents.noAgentMessages', 'No agent-to-agent messages yet.')}<br/>Messages appear when agents delegate to each other.</p>
            ) : (
              [...msgLog].reverse().map((msg) => {
                const from = agents.find((a) => a.id === msg.fromAgentId)
                const to = agents.find((a) => a.id === msg.toAgentId)
                return (
                  <div key={msg.id} className="p-3 rounded-xl border border-border bg-surface-0/30">
                    <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
                      <span className={msg.type === 'request' ? 'text-blue-400' : 'text-green-400'}>
                        {msg.type === 'request' ? '→' : '←'}
                      </span>
                      <span className="font-medium text-text-secondary">{from?.name || msg.fromAgentId}</span>
                      <span>→</span>
                      <span className="font-medium text-text-secondary">{to?.name || msg.toAgentId}</span>
                      <span className="ml-auto">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        msg.status === 'completed' ? 'bg-green-500/15 text-green-400' :
                        msg.status === 'failed' ? 'bg-red-500/15 text-red-400' :
                        'bg-yellow-500/15 text-yellow-400'
                      }`}>{msg.status}</span>
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-3">{msg.content}</p>
                    {msg.result && <p className="text-xs text-text-muted mt-1 line-clamp-2">↳ {msg.result}</p>}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── Agent Versions ── */}
        {tab === 'versions' && (
          <div className={`${orchestrationCardClass} space-y-2`}>
            <p className="text-xs text-text-muted mb-3">{t('agents.versionsHelp', 'Snapshot history of agent configurations. Versions are created when agents are saved.')}</p>
            {agentVersions.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-8">{t('agents.noVersions', 'No versions recorded yet.')}</p>
            ) : (
              [...agentVersions].reverse().slice(0, 50).map((v) => {
                const agent = agents.find((a) => a.id === v.agentId)
                return (
                  <div key={v.id} className="p-3 rounded-xl border border-border bg-surface-0/30">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-text-primary">{agent?.name || v.agentId}</span>
                      <span className="text-text-muted">{new Date(v.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-text-muted">
                      <span>v{v.version}</span>
                      {v.label && <span className="px-1.5 py-0.5 bg-accent/10 text-accent rounded">{v.label}</span>}
                      <span>Model: {v.snapshot.modelId || 'default'}</span>
                      <span>{v.snapshot.skills?.length || 0} skills</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── Performance Analytics ── */}
        {tab === 'performance' && (
          <div className={`${orchestrationCardClass} space-y-3`}>
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-muted">{t('agents.analyticsHelp', 'Agent response times, token usage, and error rates.')}</p>
              <button onClick={() => clearAgentPerformance()} className={orchestrationSecondaryButtonClass}>{t('common.clearAll', 'Clear All')}</button>
            </div>
            {Object.keys(agentPerformance).length === 0 ? (
              <p className="text-xs text-text-muted text-center py-8">{t('agents.noPerformanceData', 'No performance data recorded yet.')}</p>
            ) : (
              Object.entries(agentPerformance).map(([agentId, stats]) => {
                const agent = agents.find((a) => a.id === agentId)
                return (
                  <div key={agentId} className="p-3 rounded-xl border border-border bg-surface-0/30">
                    <div className="flex items-center gap-2 mb-2">
                      <AgentAvatar avatar={agent?.avatar} size={16} />
                      <span className="text-xs font-medium text-text-primary">{agent?.name || agentId}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <div className="text-[10px] text-text-muted uppercase">{t('agents.calls', 'Calls')}</div>
                        <div className="text-sm font-semibold text-text-primary">{stats.totalCalls}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-muted uppercase">{t('agents.tokens', 'Tokens')}</div>
                        <div className="text-sm font-semibold text-text-primary">{stats.totalTokens.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-muted uppercase">{t('agents.avgTime', 'Avg Time')}</div>
                        <div className="text-sm font-semibold text-text-primary">{stats.avgResponseTimeMs.toFixed(0)}ms</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-muted uppercase">{t('agents.errors', 'Errors')}</div>
                        <div className={`text-sm font-semibold ${stats.errorCount > 0 ? 'text-red-400' : 'text-text-primary'}`}>{stats.errorCount}</div>
                      </div>
                    </div>
                    {stats.responseTimes.length > 1 && (
                      <div className="mt-2 flex h-6 items-end gap-0.5">
                        {stats.responseTimes.slice(-30).map((t, i) => {
                          const max = Math.max(...stats.responseTimes.slice(-30))
                          const h = max > 0 ? (t / max) * 100 : 0
                          return <div key={i} className="flex-1 bg-accent/40 rounded-t" {...{ style: { height: `${Math.max(h, 5)}%` } }} title={`${t}ms`} role="img" aria-label={`Response time ${t}ms`} />
                        })}
                      </div>
                    )}
                    {stats.lastUsed && <div className="text-[10px] text-text-muted mt-1">{t('agents.lastUsed', 'Last used:')} {new Date(stats.lastUsed).toLocaleString()}</div>}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
