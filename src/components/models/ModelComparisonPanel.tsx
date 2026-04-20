import { useMemo, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/hooks/useI18n'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { generateResponse } from '@/services/aiService'
import type { ModelMessage } from 'ai'

function ComparisonStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-3xl border px-4 py-3 ${accent ? 'border-accent/18 bg-accent/10' : 'border-border-subtle/55 bg-surface-0/65'}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</div>
    </div>
  )
}

export function ModelComparisonPanel({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const { models } = useAppStore()
  const enabledModels = useMemo(() => models.filter((model) => model.enabled !== false), [models])
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [prompt, setPrompt] = useState('')
  const [results, setResults] = useState<Record<string, { text: string; time: number; error?: string }>>({})
  const [running, setRunning] = useState(false)

  const toggleModel = (id: string) => {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : prev.length < 4 ? [...prev, id] : prev
    )
  }

  const runComparison = async () => {
    if (selectedModels.length < 2 || !prompt.trim() || running) return
    setRunning(true)
    setResults({})

    const tasks = selectedModels.map(async (modelId) => {
      const model = models.find((m) => m.id === modelId)
      if (!model) return
      const start = performance.now()
      try {
        const modelIdentifier = `${model.provider}:${model.modelId}`
        const msgs: ModelMessage[] = [{ role: 'user' as const, content: prompt }]
        const text = await generateResponse(modelIdentifier, msgs)
        const time = performance.now() - start
        setResults((prev) => ({ ...prev, [modelId]: { text, time } }))
      } catch (err) {
        const time = performance.now() - start
        setResults((prev) => ({ ...prev, [modelId]: { text: '', time, error: err instanceof Error ? err.message : String(err) } }))
      }
    })

    await Promise.allSettled(tasks)
    setRunning(false)
  }

  const completedCount = useMemo(() => selectedModels.filter((modelId) => Boolean(results[modelId])).length, [results, selectedModels])
  const fastestTime = useMemo(() => {
    const times = Object.values(results).map((result) => result.time).filter((time) => Number.isFinite(time))
    if (times.length === 0) return 0
    return Math.min(...times)
  }, [results])

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-linear-to-b from-surface-1/96 via-surface-1/88 to-surface-0">
      <div className="border-b border-border-subtle/60 px-4 py-3">
        <div className="flex items-start justify-between gap-3 rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-5 shadow-[0_20px_54px_rgba(var(--t-accent-rgb),0.08)]">
          <div className="min-w-0 flex-1">
            <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('models.comparison', 'Comparison')}</div>
            <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-text-primary">{t('models.compareOutputs', 'Compare Model Outputs')}</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-text-secondary/82">{t('models.compareOutputsHint', 'Send the same prompt to multiple enabled models and inspect differences in quality, speed, and verbosity from one place.')}</p>
          </div>
          <button
            type="button"
            title={t('common.close', 'Close')}
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border-subtle/55 bg-surface-0/72 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
          >
            <IconifyIcon name="ui-close" size={16} color="currentColor" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <ComparisonStat label={t('models.available', 'Available')} value={String(enabledModels.length)} accent />
            <ComparisonStat label={t('models.selected', 'Selected')} value={String(selectedModels.length)} />
            <ComparisonStat label={t('models.fastest', 'Fastest')} value={fastestTime > 0 ? `${(fastestTime / 1000).toFixed(1)}s` : '—'} />
          </div>

          <section className="rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
            <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('models.selection', 'Selection')}</div>
            <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{t('models.chooseModels', 'Choose 2-4 models')}</h3>
            <p className="mt-2 text-[13px] leading-6 text-text-secondary/80">{t('models.chooseModelsHint', 'Use the same prompt against a small batch of enabled models so the result cards stay readable and side-by-side.')}</p>

            {enabledModels.length === 0 ? (
              <div className="mt-5 rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
                  <IconifyIcon name="ui-warning" size={18} color="currentColor" />
                </div>
                <p className="text-[12px] leading-relaxed text-text-muted">{t('models.noEnabledModels', 'No enabled models. Configure providers first.')}</p>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {enabledModels.map((model) => {
                  const selected = selectedModels.includes(model.id)
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => toggleModel(model.id)}
                      className={`rounded-3xl border p-4 text-left transition-all ${selected ? 'border-accent/20 bg-accent/10 shadow-[0_12px_28px_rgba(var(--t-accent-rgb),0.08)]' : 'border-border-subtle/55 bg-surface-0/45 hover:bg-surface-2/60'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[13px] font-semibold text-text-primary">{model.name}</div>
                          <div className="mt-1 text-[11px] text-text-muted/75">{model.provider}</div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${selected ? 'bg-accent/15 text-accent' : 'bg-surface-3 text-text-muted'}`}>{selected ? t('common.selected', 'Selected') : t('common.idle', 'Idle')}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <section className="rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('common.prompt', 'Prompt')}</div>
                <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{t('models.sharedPrompt', 'Shared Prompt')}</h3>
                <p className="mt-2 text-[13px] leading-6 text-text-secondary/80">{t('models.sharedPromptHint', 'Write one prompt that will be sent to every selected model so the outputs can be judged under the same conditions.')}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setPrompt(''); setResults({}) }}
                  className="rounded-2xl border border-border-subtle/55 bg-surface-0/72 px-4 py-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-2"
                >
                  {t('common.clear', 'Clear')}
                </button>
                <button
                  type="button"
                  onClick={runComparison}
                  disabled={selectedModels.length < 2 || !prompt.trim() || running}
                  className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(var(--t-accent-rgb),0.22)] transition-colors hover:bg-accent-hover disabled:opacity-40"
                >
                  {running ? t('models.comparing', 'Comparing…') : t('models.runComparison', `Compare ${selectedModels.length} Models`)}
                </button>
              </div>
            </div>

            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={t('models.promptPlaceholder', 'Enter a prompt to send to all selected models...')}
              rows={5}
              className="mt-5 min-h-36 w-full rounded-3xl border border-border-subtle/55 bg-surface-2/80 px-4 py-3 text-sm text-text-primary placeholder-text-muted/55 focus:outline-none focus:ring-2 focus:ring-accent/20 resize-y"
            />

            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-text-muted/75">
              <span>{t('models.selected', 'Selected')}: {selectedModels.length}</span>
              <span>{t('models.completed', 'Completed')}: {completedCount}</span>
              <span>{t('models.promptLength', 'Prompt length')}: {prompt.trim().length}</span>
            </div>
          </section>

          <section className="rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
            <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{t('common.results', 'Results')}</div>
            <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{t('models.sideBySideOutputs', 'Side-by-side Outputs')}</h3>
            <p className="mt-2 text-[13px] leading-6 text-text-secondary/80">{t('models.sideBySideOutputsHint', 'Each card streams its own result and preserves response time plus a quick text-size summary.')}</p>

            {selectedModels.length === 0 ? (
              <div className="mt-5 rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-2/65 text-text-muted/60">
                  <IconifyIcon name="action-chat" size={18} color="currentColor" />
                </div>
                <p className="text-[12px] leading-relaxed text-text-muted">{t('models.selectModelsFirst', 'Select a few models and enter a prompt to start the comparison.')}</p>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 xl:grid-cols-2">
                {selectedModels.map((modelId) => {
                  const model = models.find((entry) => entry.id === modelId)
                  const result = results[modelId]
                  return (
                    <article key={modelId} className="rounded-3xl border border-border-subtle/55 bg-surface-0/45 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold text-text-primary">{model?.name || modelId}</div>
                          <div className="mt-1 text-[11px] text-text-muted/75">{model?.provider || t('common.unknown', 'Unknown')}</div>
                        </div>
                        {result && <span className="shrink-0 rounded-full bg-accent/12 px-2.5 py-1 text-[10px] font-medium text-accent">{(result.time / 1000).toFixed(1)}s</span>}
                      </div>

                      {!result ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-border-subtle/60 bg-surface-2/45 px-4 py-10 text-center text-[12px] text-text-muted">
                          {running ? t('models.generating', 'Generating…') : t('models.awaitingRun', 'Awaiting run')}
                        </div>
                      ) : result.error ? (
                        <div className="mt-4 rounded-2xl border border-red-500/18 bg-red-500/8 px-4 py-3 text-[12px] leading-6 text-red-400">{result.error}</div>
                      ) : (
                        <div className="mt-4 max-h-80 overflow-y-auto rounded-2xl border border-border-subtle/45 bg-surface-2/65 px-4 py-3 text-[12px] leading-6 text-text-secondary whitespace-pre-wrap wrap-break-word">
                          {result.text}
                        </div>
                      )}

                      {result && !result.error && (
                        <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-text-muted/75">
                          <span>{result.text.length} {t('models.characters', 'chars')}</span>
                          <span>{result.text.split(/\s+/).filter(Boolean).length} {t('models.words', 'words')}</span>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
