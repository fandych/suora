import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import type { AgentPipelineProgressStep } from '@/services/agentPipelineService'
import type { AgentPipelineStep } from '@/types'

interface PipelineFlowDiagramProps {
  steps: AgentPipelineStep[]
  progressSteps: AgentPipelineProgressStep[]
  agentNameMap: Record<string, string>
  className?: string
}

function statusClasses(status: AgentPipelineProgressStep['status']) {
  switch (status) {
    case 'running':
      return 'border-amber-500/35 bg-amber-500/10 text-amber-200'
    case 'success':
      return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
    case 'error':
      return 'border-red-500/35 bg-red-500/10 text-red-200'
    case 'skipped':
      return 'border-border-subtle bg-surface-2/60 text-text-muted'
    case 'pending':
    default:
      return 'border-border-subtle bg-surface-2/45 text-text-secondary'
  }
}

function statusIcon(status: AgentPipelineProgressStep['status']) {
  if (status === 'success') return 'ui-check-circle'
  if (status === 'error') return 'ui-close-circle'
  if (status === 'running') return 'ui-loading'
  if (status === 'skipped') return 'ui-error'
  return 'ui-record'
}

function trimPreview(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1)}...`
}

export function PipelineFlowDiagram({ steps, progressSteps, agentNameMap, className }: PipelineFlowDiagramProps) {
  const { t } = useI18n()

  if (steps.length === 0) {
    return (
      <div className={`flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-border-subtle text-xs text-text-muted ${className ?? ''}`}>
        {t('agents.pipelineNoStepsToVisualize', 'No pipeline steps to visualize.')}
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border border-border-subtle bg-surface-0/45 p-4 ${className ?? ''}`}>
      <div className="space-y-0">
        {steps.map((step, index) => {
          const progressStep = progressSteps.find((item) => item.stepIndex === index)
          const status = progressStep?.status ?? (step.enabled === false ? 'skipped' : 'pending')
          const retryCount = Number.isFinite(step.retryCount) ? Math.max(0, Math.trunc(step.retryCount ?? 0)) : 0
          const agentName = progressStep?.agentName || agentNameMap[step.agentId] || step.agentId

          return (
            <div key={`${step.agentId}-${index}`}>
              <div className={`rounded-2xl border p-3 ${statusClasses(status)}`}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-current/20 bg-current/8">
                    <IconifyIcon name={statusIcon(status)} size={14} color="currentColor" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">{step.name?.trim() || t('agents.pipelineStepFallback', 'Step {number}').replace('{number}', String(index + 1))}</span>
                      <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] tracking-[0.08em]">{t(`agents.pipelineStatus.${status}`, status)}</span>
                    </div>
                    <div className="mt-1 text-xs text-text-secondary">{agentName}</div>
                    <div className="mt-2 text-xs leading-relaxed text-text-muted">{trimPreview(step.task || t('agents.pipelineNoTaskConfigured', 'No task configured'), 120)}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-text-muted">
                      {retryCount > 0 && <span className="rounded-full bg-surface-3 px-2 py-0.5">{t('agents.pipelineRetryBadge', '{count} retry').replace('{count}', String(retryCount))}</span>}
                      <span className="rounded-full bg-surface-3 px-2 py-0.5">{step.continueOnError === false ? t('agents.pipelineStopOnErrorBadge', 'stop on error') : t('agents.pipelineContinueOnErrorBadge', 'continue on error')}</span>
                      {progressStep?.attempts && progressStep.attempts > 1 && <span className="rounded-full bg-surface-3 px-2 py-0.5">{t('agents.pipelineAttemptsBadge', '{count} attempts').replace('{count}', String(progressStep.attempts))}</span>}
                    </div>
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className="ml-7 flex h-7 items-center border-l border-border-subtle pl-5 text-[10px] text-text-muted">
                  {step.continueOnError === false ? t('agents.pipelineSuccessPath', 'success path') : t('agents.pipelineHandoffPath', 'handoff')}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}