import { useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { generateResponse } from '@/services/aiService'
import type { ModelMessage } from 'ai'

export function ModelComparisonPanel({ onClose }: { onClose: () => void }) {
  const { models } = useAppStore()
  const enabledModels = models.filter((m) => m.enabled)
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

  return (
    <div className="flex-1 flex flex-col bg-surface-1 overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-text-primary">Model Comparison</h2>
        <button title="Close" onClick={onClose} className="text-text-muted hover:text-text-primary text-xs"><IconifyIcon name="ui-close" size={14} color="currentColor" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Model selection */}
        <div>
          <p className="text-xs text-text-muted mb-2">Select 2–4 models to compare (click to toggle):</p>
          <div className="flex flex-wrap gap-1.5">
            {enabledModels.map((m) => (
              <button
                key={m.id}
                onClick={() => toggleModel(m.id)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                  selectedModels.includes(m.id)
                    ? 'bg-accent/15 border-accent/30 text-accent'
                    : 'bg-surface-2 border-border text-text-muted hover:text-text-secondary'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
          {enabledModels.length === 0 && <p className="text-xs text-text-muted mt-2">No enabled models. Configure providers first.</p>}
        </div>

        {/* Prompt input */}
        <div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a prompt to send to all selected models..."
            rows={3}
            className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-xs text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 resize-y"
          />
          <button
            onClick={runComparison}
            disabled={selectedModels.length < 2 || !prompt.trim() || running}
            className="mt-2 text-xs px-4 py-2 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 transition-colors disabled:opacity-40 font-medium"
          >
            {running ? 'Comparing...' : `Compare ${selectedModels.length} Models`}
          </button>
        </div>

        {/* Results grid */}
        {Object.keys(results).length > 0 && (
          <div className={`grid gap-3 ${selectedModels.length <= 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
            {selectedModels.map((modelId) => {
              const model = models.find((m) => m.id === modelId)
              const r = results[modelId]
              return (
                <div key={modelId} className="rounded-xl border border-border bg-surface-0/30 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-text-primary truncate">{model?.name || modelId}</span>
                    {r && <span className="text-[10px] text-text-muted shrink-0">{(r.time / 1000).toFixed(1)}s</span>}
                  </div>
                  {!r ? (
                    <div className="text-xs text-text-muted animate-pulse py-4 text-center">Generating...</div>
                  ) : r.error ? (
                    <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded-lg">{r.error}</div>
                  ) : (
                    <div className="text-xs text-text-secondary whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                      {r.text}
                    </div>
                  )}
                  {r && !r.error && (
                    <div className="flex gap-3 text-[10px] text-text-muted mt-2 pt-2 border-t border-border-subtle">
                      <span>{r.text.length} chars</span>
                      <span>{r.text.split(/\s+/).length} words</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
