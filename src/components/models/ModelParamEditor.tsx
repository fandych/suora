import { useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import type { ProviderConfig, ProviderModelEntry } from '@/types'

// ─── Model pricing data (USD per 1M tokens) ──────────────────────
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4': { input: 30, output: 60 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'o1': { input: 15, output: 60 },
  'o1-mini': { input: 3, output: 12 },
  'o3-mini': { input: 1.1, output: 4.4 },
  // Anthropic
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-3-7-sonnet-20250219': { input: 3, output: 15 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
  'claude-3-opus-20240229': { input: 15, output: 75 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  // Google
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-1.5-pro': { input: 1.25, output: 5 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  // DeepSeek
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
}

function estimateCost(modelId: string, promptTokens: number, completionTokens: number): number | null {
  // Try exact match first, then partial match
  const pricing = MODEL_PRICING[modelId] || Object.entries(MODEL_PRICING).find(([key]) => modelId.includes(key))?.[1]
  if (!pricing) return null
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000
}

function SummaryStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-3xl border px-4 py-3 ${accent ? 'border-accent/18 bg-accent/10' : 'border-border-subtle/55 bg-surface-0/60'}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</div>
    </div>
  )
}

export function ModelParamEditor({ provider, model, onSave, onClose }: {
  provider: ProviderConfig
  model: ProviderModelEntry
  onSave: (data: Partial<ProviderModelEntry>) => void
  onClose: () => void
}) {
  const { modelUsageStats } = useAppStore()
  const [temperature, setTemperature] = useState<number | undefined>(model.temperature)
  const [maxTokens, setMaxTokens] = useState<number | undefined>(model.maxTokens)
  const [saved, setSaved] = useState(false)

  const globalModelId = `${provider.id}:${model.modelId}`
  const stats = modelUsageStats[globalModelId]
  const estimatedCost = stats ? estimateCost(model.modelId, stats.totalPromptTokens, stats.totalCompletionTokens) : null
  const lastUsedLabel = stats?.lastUsed ? new Date(stats.lastUsed).toLocaleString() : 'Not used yet'

  return (
    <div className="flex-1 overflow-y-auto px-5 py-6 xl:px-8 xl:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-4xl border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]">
                <IconifyIcon name="ui-clipboard" size={30} color="currentColor" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">Model Editor</div>
                <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-text-primary">{model.name}</h2>
                <p className="mt-2 max-w-3xl text-[14px] leading-7 text-text-secondary/82"><span className="rounded-full border border-border-subtle/45 bg-surface-0/78 px-3 py-1 text-[11px] text-text-secondary">{model.modelId}</span> <span className="ml-2">via {provider.name}</span></p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 xl:max-w-100 xl:justify-end">
              <SummaryStat label="Status" value={model.enabled ? 'Enabled' : 'Disabled'} accent={model.enabled} />
              <SummaryStat label="Last used" value={lastUsedLabel} />
              <button title="Close" onClick={onClose} className="rounded-2xl bg-surface-2 px-4 py-3 text-sm font-semibold text-text-muted transition-colors hover:text-text-secondary hover:bg-surface-3"><IconifyIcon name="ui-close" size={14} color="currentColor" /></button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)] xl:p-6">
            <div className="mb-5">
              <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">Generation</div>
              <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">Parameter Tuning</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-text-secondary/80">Adjust model creativity and response ceiling for this provider-specific entry without changing the global catalog.</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-muted">Temperature: {temperature != null ? temperature.toFixed(1) : 'Default'}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    aria-label="Temperature"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature ?? 0.7}
                    onChange={(e) => { setTemperature(parseFloat(e.target.value)); setSaved(false) }}
                    className="flex-1 accent-accent"
                  />
                  <button
                    type="button"
                    onClick={() => { setTemperature(undefined); setSaved(false) }}
                    className="rounded-2xl bg-surface-2 px-3 py-2 text-[11px] font-semibold text-text-muted transition-colors hover:text-text-secondary"
                  >
                    Reset
                  </button>
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-text-muted">
                  <span>Precise (0)</span>
                  <span>Creative (2)</span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-muted">Max Tokens</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    aria-label="Max tokens"
                    value={maxTokens ?? ''}
                    onChange={(e) => { setMaxTokens(e.target.value ? parseInt(e.target.value, 10) : undefined); setSaved(false) }}
                    placeholder="Default (provider limit)"
                    min={256}
                    max={128000}
                    className="flex-1 rounded-2xl border border-border bg-surface-2/75 px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                  <button
                    type="button"
                    onClick={() => { setMaxTokens(undefined); setSaved(false) }}
                    className="rounded-2xl bg-surface-2 px-3 py-2 text-[11px] font-semibold text-text-muted transition-colors hover:text-text-secondary"
                  >
                    Reset
                  </button>
                </div>
                <p className="mt-2 text-xs text-text-muted">Leave empty to use the provider default.</p>
              </div>

              <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 p-4 text-sm text-text-secondary">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Runtime profile</div>
                <div className="mt-2">Provider: <span className="font-medium text-text-primary">{provider.name}</span></div>
                <div className="mt-1">Model state: <span className="font-medium text-text-primary">{model.enabled ? 'Enabled' : 'Disabled'}</span></div>
              </div>
            </div>
          </section>

          <section className="rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)] xl:p-6">
            <div className="mb-5">
              <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">Telemetry</div>
              <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">Usage Statistics</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-text-secondary/80">Inspect observed traffic, token volume, and cost estimates before you tighten or relax generation parameters.</p>
            </div>

            {stats ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryStat label="API Calls" value={String(stats.callCount)} />
                  <SummaryStat label="Total Tokens" value={stats.totalTokens.toLocaleString()} />
                  <SummaryStat label="Prompt Tokens" value={stats.totalPromptTokens.toLocaleString()} />
                  <SummaryStat label="Completion Tokens" value={stats.totalCompletionTokens.toLocaleString()} />
                </div>

                {estimatedCost !== null ? (
                  <div className="rounded-3xl border border-accent/20 bg-accent/10 p-4 text-center">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Estimated Cost (USD)</div>
                    <div className="mt-2 text-2xl font-semibold text-accent">${estimatedCost < 0.01 ? estimatedCost.toFixed(4) : estimatedCost.toFixed(2)}</div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 p-4 text-sm text-text-muted">Cost estimation not available for this model.</div>
                )}

                <div className="rounded-3xl border border-border-subtle/55 bg-surface-0/60 p-4 text-sm text-text-secondary">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Last used</div>
                  <div className="mt-2 font-medium text-text-primary">{lastUsedLabel}</div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border-subtle px-4 py-10 text-center text-sm text-text-muted">No usage data yet</div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => { onSave({ temperature, maxTokens }); setSaved(true) }}
                className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-hover"
              >
                Save Parameters
              </button>
              {saved && <span className="inline-flex items-center gap-1 text-xs text-success animate-fade-in"><IconifyIcon name="ui-check" size={12} color="currentColor" /> Saved</span>}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
