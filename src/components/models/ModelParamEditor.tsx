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

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{model.name}</h2>
          <p className="text-xs text-text-muted mt-1">
            <code className="px-1.5 py-0.5 rounded bg-surface-2">{model.modelId}</code> via {provider.name}
          </p>
        </div>
        <button title="Close" onClick={onClose} className="text-text-muted hover:text-text-secondary text-sm px-2 py-1 rounded-lg hover:bg-surface-3 transition-colors"><IconifyIcon name="ui-close" size={14} color="currentColor" /></button>
      </div>

      <div className="space-y-6">
        {/* Temperature */}
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Temperature: {temperature != null ? temperature.toFixed(1) : 'Default'}
          </label>
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
              className="text-[10px] text-text-muted hover:text-text-secondary px-2 py-1 rounded-lg hover:bg-surface-3 transition-colors"
            >
              Reset
            </button>
          </div>
          <div className="flex justify-between text-[10px] text-text-muted mt-1">
            <span>Precise (0)</span>
            <span>Creative (2)</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Max Tokens</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              aria-label="Max tokens"
              value={maxTokens ?? ''}
              onChange={(e) => { setMaxTokens(e.target.value ? parseInt(e.target.value) : undefined); setSaved(false) }}
              placeholder="Default (provider limit)"
              min={256}
              max={128000}
              className="flex-1 px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
            />
            <button
              type="button"
              onClick={() => { setMaxTokens(undefined); setSaved(false) }}
              className="text-[10px] text-text-muted hover:text-text-secondary px-2 py-1 rounded-lg hover:bg-surface-3 transition-colors"
            >
              Reset
            </button>
          </div>
          <p className="mt-1.5 text-xs text-text-muted">Leave empty to use the provider default.</p>
        </div>

        {/* Status info */}
        <div className="rounded-xl border border-border-subtle p-4 bg-surface-1/30 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Provider</span>
            <span className="text-text-secondary">{provider.name}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Status</span>
            <span className="text-text-secondary">{model.enabled ? <><IconifyIcon name="ui-check-circle" size={14} color="currentColor" /> Enabled</> : <><IconifyIcon name="ui-close-circle" size={14} color="currentColor" /> Disabled</>}</span>
          </div>
        </div>

        {/* Usage Statistics */}
        <div className="rounded-xl border border-border-subtle p-4 bg-surface-1/30">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Usage Statistics</h3>
          {stats ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 rounded-lg bg-surface-2">
                <div className="text-lg font-semibold text-text-primary">{stats.callCount}</div>
                <div className="text-[10px] text-text-muted">API Calls</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-surface-2">
                <div className="text-lg font-semibold text-text-primary">{stats.totalTokens.toLocaleString()}</div>
                <div className="text-[10px] text-text-muted">Total Tokens</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-surface-2">
                <div className="text-sm font-medium text-text-secondary">{stats.totalPromptTokens.toLocaleString()}</div>
                <div className="text-[10px] text-text-muted">Prompt Tokens</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-surface-2">
                <div className="text-sm font-medium text-text-secondary">{stats.totalCompletionTokens.toLocaleString()}</div>
                <div className="text-[10px] text-text-muted">Completion Tokens</div>
              </div>
              {(() => {
                const cost = estimateCost(model.modelId, stats.totalPromptTokens, stats.totalCompletionTokens)
                return cost !== null ? (
                  <div className="col-span-2 text-center p-2 rounded-lg bg-accent/10 border border-accent/20">
                    <div className="text-lg font-semibold text-accent">${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}</div>
                    <div className="text-[10px] text-text-muted">Estimated Cost (USD)</div>
                  </div>
                ) : (
                  <div className="col-span-2 text-center p-2 rounded-lg bg-surface-2">
                    <div className="text-xs text-text-muted">Cost estimation not available for this model</div>
                  </div>
                )
              })()}
              {stats.lastUsed > 0 && (
                <div className="col-span-2 text-[10px] text-text-muted text-center">
                  Last used: {new Date(stats.lastUsed).toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-text-muted text-center py-2">No usage data yet</p>
          )}
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => { onSave({ temperature, maxTokens }); setSaved(true) }}
            className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-all"
          >
            Save Parameters
          </button>
          {saved && <span className="text-xs text-success animate-fade-in inline-flex items-center gap-1"><IconifyIcon name="ui-check" size={12} color="currentColor" /> Saved</span>}
        </div>
      </div>
    </div>
  )
}
