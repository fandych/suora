import { Button as UiButton } from '@/components/shared/button'
import { Input as UiInput, TextArea as UiTextArea } from '@/components/shared/form-controls'
import type { AgentPipelineBudget, AgentPipelineVariable } from '@/types'

interface PipelineGeneralPanelProps {
  name: string
  description: string
  variables: AgentPipelineVariable[]
  variableValues: Record<string, string>
  budget?: AgentPipelineBudget
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onVariablesChange: (updater: (current: AgentPipelineVariable[]) => AgentPipelineVariable[]) => void
  onRenameVariable: (index: number, nextName: string) => void
  onVariableValuesChange: (updater: (current: Record<string, string>) => Record<string, string>) => void
  onBudgetChange: (next: AgentPipelineBudget | undefined) => void
  t: (key: string, defaultValue?: string) => string
}

export function PipelineGeneralPanel({
  name,
  description,
  variables,
  variableValues,
  budget,
  onNameChange,
  onDescriptionChange,
  onVariablesChange,
  onRenameVariable,
  onVariableValuesChange,
  onBudgetChange,
  t,
}: PipelineGeneralPanelProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-border-subtle/55 bg-surface-1/96 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)] backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">{t('agents.pipelineGeneral', 'General')}</h2>
            <p className="mt-1 text-xs text-text-muted">{t('agents.pipelineBuilderHint', 'Design each handoff and keep the upstream result visible directly on the canvas.')}</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineName', 'Pipeline name')}</label>
            <UiInput value={name} onChange={(e) => onNameChange(e.target.value)} placeholder={t('agents.pipelineName', 'Pipeline name')} wrapperClassName="w-full" controlClassName="rounded-2xl border border-border bg-surface-2 px-3 py-3 text-sm text-text-primary"/>
          </div>

          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineDescription', 'Description')}</label>
            <UiTextArea value={description} onChange={(event) => onDescriptionChange(event.target.value)} placeholder={t('agents.pipelineDescriptionPlaceholder', 'What this workflow prepares, checks, or hands off...')} rows={3} wrapperClassName="w-full" controlClassName="rounded-2xl border border-border bg-surface-2 px-3 py-3 text-sm text-text-primary"/>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-border-subtle bg-surface-2/55 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineVariables', 'Variables')}</div>
            <div className="mt-1 text-xs text-text-muted">{t('agents.pipelineVariablesHint', 'Declare run-time inputs, then reference them in any step task as {{vars.name}} or in runIf conditions as vars.name.')}</div>
          </div>
          <UiButton unstyled type="button" onClick={() => onVariablesChange((current) => [...current, { name: '' }])} className="rounded-xl border border-border-subtle bg-surface-1/80 px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:border-accent/30 hover:text-accent">
            {t('agents.pipelineAddVariable', '+ Add variable')}
          </UiButton>
        </div>

        {variables.length === 0 ? (<div className="mt-3 text-xs text-text-muted">{t('agents.pipelineNoVariables', 'No variables declared yet.')}</div>) : (<div className="mt-3 space-y-2">
            {variables.map((variable, index) => (<div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <UiInput value={variable.name} onChange={(event) => onRenameVariable(index, event.target.value)} placeholder={t('agents.pipelineVariableName', 'name')} controlClassName="h-9 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary"/>
                <UiInput value={variable.label ?? ''} onChange={(event) => {
                  const next = event.target.value
                  onVariablesChange((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: next } : item))
                }} placeholder={t('agents.pipelineVariableLabel', 'Label (optional)')} controlClassName="h-9 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary"/>
                <UiInput value={variable.defaultValue ?? ''} onChange={(event) => {
                  const next = event.target.value
                  onVariablesChange((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, defaultValue: next } : item))
                }} placeholder={t('agents.pipelineVariableDefault', 'Default value')} controlClassName="h-9 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary"/>
                <UiButton unstyled type="button" onClick={() => {
                  onVariablesChange((current) => current.filter((_, itemIndex) => itemIndex !== index))
                }} className="rounded-xl border border-border-subtle bg-surface-1/80 px-2 py-1 text-[11px] font-medium text-text-muted transition-colors hover:border-red-500/30 hover:text-red-300">
                  {t('common.remove', 'Remove')}
                </UiButton>
              </div>))}
          </div>)}

        {variables.length > 0 ? (<div className="mt-4 border-t border-border-subtle pt-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineRunValues', 'Run values')}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {variables.filter((variable) => variable.name.trim()).map((variable) => (<label key={variable.name} className="flex flex-col gap-1 text-xs text-text-secondary">
                  <span className="font-medium text-text-primary">{variable.label?.trim() || variable.name}</span>
                  <UiInput value={variableValues[variable.name] ?? ''} onChange={(event) => {
                    const next = event.target.value
                    onVariableValuesChange((current) => ({ ...current, [variable.name]: next }))
                  }} placeholder={variable.defaultValue ?? ''} controlClassName="h-9 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary"/>
                </label>))}
            </div>
          </div>) : null}
      </section>

      <section className="rounded-[28px] border border-border-subtle bg-surface-2/55 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineBudget', 'Budget caps')}</div>
            <div className="mt-1 text-xs text-text-muted">{t('agents.pipelineBudgetHint', 'Optional safety limits enforced by the runtime. Leave a field blank or zero to disable that cap. Remaining steps will be skipped when any cap is exceeded.')}</div>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            <span>{t('agents.pipelineBudgetMaxDuration', 'Max duration (ms)')}</span>
            <UiInput type="number" min={0} value={budget?.maxTotalDurationMs ?? ''} onChange={(event) => {
              const raw = event.target.value
              const parsed = raw === '' ? undefined : Math.max(0, Math.trunc(Number(raw)))
              const next = { ...(budget ?? {}), maxTotalDurationMs: parsed }
              onBudgetChange(next.maxTotalDurationMs || next.maxTotalTokens || next.maxStepCount ? next : undefined)
            }} placeholder="0" controlClassName="h-9 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary"/>
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            <span>{t('agents.pipelineBudgetMaxTokens', 'Max total tokens')}</span>
            <UiInput type="number" min={0} value={budget?.maxTotalTokens ?? ''} onChange={(event) => {
              const raw = event.target.value
              const parsed = raw === '' ? undefined : Math.max(0, Math.trunc(Number(raw)))
              const next = { ...(budget ?? {}), maxTotalTokens: parsed }
              onBudgetChange(next.maxTotalDurationMs || next.maxTotalTokens || next.maxStepCount ? next : undefined)
            }} placeholder="0" controlClassName="h-9 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary"/>
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            <span>{t('agents.pipelineBudgetMaxSteps', 'Max steps')}</span>
            <UiInput type="number" min={0} value={budget?.maxStepCount ?? ''} onChange={(event) => {
              const raw = event.target.value
              const parsed = raw === '' ? undefined : Math.max(0, Math.trunc(Number(raw)))
              const next = { ...(budget ?? {}), maxStepCount: parsed }
              onBudgetChange(next.maxTotalDurationMs || next.maxTotalTokens || next.maxStepCount ? next : undefined)
            }} placeholder="0" controlClassName="h-9 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary"/>
          </label>
        </div>
      </section>
    </div>
  )
}
