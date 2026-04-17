import { useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { testConnection } from '@/services/aiService'
import { toast } from '@/services/toast'

type TestState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'ok'; latency: number }
  | { kind: 'error'; message: string }

export function ModelSelector() {
  const { models, selectedModel, setSelectedModel, providerConfigs } = useAppStore()
  const [testState, setTestState] = useState<TestState>({ kind: 'idle' })

  const getProviderDisplayName = (providerId: string) => {
    const config = providerConfigs.find((p) => p.id === providerId)
    return config?.name || providerId
  }

  const handleTest = async () => {
    if (!selectedModel || testState.kind === 'pending') return
    const provider = providerConfigs.find((p) => p.id === selectedModel.provider)
    if (!provider) {
      setTestState({ kind: 'error', message: 'Provider not configured' })
      return
    }
    setTestState({ kind: 'pending' })
    try {
      const result = await testConnection(
        selectedModel.providerType,
        selectedModel.apiKey || provider.apiKey || '',
        selectedModel.baseUrl || provider.baseUrl,
        selectedModel.modelId,
        selectedModel.provider,
      )
      if (result.success) {
        setTestState({ kind: 'ok', latency: result.latency ?? 0 })
        toast.success('Connection OK', `${selectedModel.name} · ${result.latency ?? 0}ms`)
      } else {
        const message = result.error ?? 'Connection test failed'
        setTestState({ kind: 'error', message })
        toast.error('Connection failed', message)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setTestState({ kind: 'error', message })
      toast.error('Connection failed', message)
    }
  }

  return (
    <div className="p-4 border-b border-border-subtle">
      <div className="space-y-2">
        <label htmlFor="model-selector-select" className="text-xs font-medium text-text-muted uppercase tracking-wider">
          Model
        </label>
        <div className="flex items-stretch gap-2">
          <select
            id="model-selector-select"
            aria-label="Select model"
            value={selectedModel?.id || ''}
            onChange={(e) => {
              const model = models.find((m) => m.id === e.target.value)
              if (model) setSelectedModel(model)
              setTestState({ kind: 'idle' })
            }}
            className="flex-1 px-3 py-2.5 rounded-xl bg-surface-2 text-text-primary border border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
          >
            <option value="">-- Select a model --</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {getProviderDisplayName(model.provider)} / {model.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleTest}
            disabled={!selectedModel || testState.kind === 'pending'}
            aria-label="Test connection to selected model"
            {...(testState.kind === 'pending' ? { 'aria-busy': true } : {})}
            title={selectedModel ? 'Send a minimal request to verify this model works' : 'Select a model first'}
            className="px-3 rounded-xl bg-surface-2 hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed text-text-primary text-xs font-medium border border-border transition-colors"
          >
            {testState.kind === 'pending' ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border-2 border-accent/30 border-t-accent animate-spin" aria-hidden="true" />
                Testing…
              </span>
            ) : (
              'Test'
            )}
          </button>
        </div>

        {testState.kind === 'ok' && (
          <p role="status" className="text-[11px] text-emerald-500">
            ✓ Connected in {testState.latency}ms
          </p>
        )}
        {testState.kind === 'error' && (
          <p role="alert" className="text-[11px] text-red-400 wrap-break-word">
            ✗ {testState.message}
          </p>
        )}
      </div>
    </div>
  )
}
