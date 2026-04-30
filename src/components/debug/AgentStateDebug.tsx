/**
 * Debug component for diagnosing agent/model selection issues.
 * Shows current state of selectedAgent, activeSession, sessionAgent, sessionModel, etc.
 * 
 * Usage: Include <AgentStateDebug /> in ChatMain or enable via toggle in settings.
 */

import { useAppStore } from '@/store/appStore'

export function AgentStateDebug() {
  const {
    sessions,
    activeSessionId,
    agents,
    models,
    selectedAgent,
    selectedModel,
  } = useAppStore()

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const sessionAgent = activeSession?.agentId
    ? agents.find((a) => a.id === activeSession.agentId)
    : selectedAgent

  const sessionModel = activeSession?.modelId
    ? models.find((m) => m.id === activeSession.modelId)
    : sessionAgent?.modelId
      ? models.find((m) => m.id === sessionAgent.modelId)
      : selectedModel

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-surface-2 border border-border-subtle rounded-lg p-4 text-[12px] font-mono max-w-sm max-h-96 overflow-auto">
      <div className="font-bold text-accent mb-2">Agent/Model Debug</div>

      <div className="space-y-1 text-text-secondary">
        <div>
          <span className="text-text-muted">activeSessionId:</span>{' '}
          <span className="text-accent font-semibold">{activeSessionId?.slice(0, 8)}</span>
        </div>

        <div>
          <span className="text-text-muted">activeSession.agentId:</span>{' '}
          <span className="text-accent font-semibold">{activeSession?.agentId ?? 'undefined'}</span>
        </div>

        <div>
          <span className="text-text-muted">activeSession.modelId:</span>{' '}
          <span className="text-accent font-semibold">{activeSession?.modelId ?? 'undefined'}</span>
        </div>

        <div className="border-t border-border-subtle/30 mt-2 pt-2">
          <div>
            <span className="text-text-muted">selectedAgent:</span>{' '}
            <span className="text-accent font-semibold">{selectedAgent?.id ?? 'undefined'}</span>
          </div>

          <div>
            <span className="text-text-muted">selectedAgent.modelId:</span>{' '}
            <span className="text-accent font-semibold">{selectedAgent?.modelId ?? 'undefined'}</span>
          </div>

          <div>
            <span className="text-text-muted">selectedModel:</span>{' '}
            <span className="text-accent font-semibold">{selectedModel?.id ?? 'undefined'}</span>
          </div>
        </div>

        <div className="border-t border-border-subtle/30 mt-2 pt-2">
          <div>
            <span className="text-text-muted">sessionAgent (derived):</span>{' '}
            <span className="text-accent font-semibold">{sessionAgent?.id ?? 'undefined'}</span>
          </div>

          <div>
            <span className="text-text-muted">sessionModel (derived):</span>{' '}
            <span className="text-accent font-semibold">{sessionModel?.id ?? 'undefined'}</span>
          </div>
        </div>

        <div className="border-t border-border-subtle/30 mt-2 pt-2">
          <div>
            <span className="text-text-muted">Agents count:</span> {agents.length}
          </div>
          <div>
            <span className="text-text-muted">Models count:</span> {models.length}
          </div>
          <div>
            <span className="text-text-muted">Enabled models:</span>{' '}
            {models.filter((m) => m.enabled).length}
          </div>
        </div>

        {/* Check if agent's preferred model exists */}
        {sessionAgent?.modelId && (
          <div className="border-t border-border-subtle/30 mt-2 pt-2 bg-danger/10 p-2 rounded text-danger">
            <div className="font-semibold">⚠️ Agent preferred model check:</div>
            <div>
              Agent modelId: <span className="font-semibold">{sessionAgent.modelId}</span>
            </div>
            <div>
              Model found: {models.find((m) => m.id === sessionAgent.modelId) ? '✓' : '✗'}
            </div>
            <div>
              Model enabled:{' '}
              {models.find((m) => m.id === sessionAgent.modelId && m.enabled) ? '✓' : '✗'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
