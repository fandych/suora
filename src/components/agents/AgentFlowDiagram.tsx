import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { buildAgentFlowNodes, type BuildAgentFlowOptions, type AgentFlowNodeState } from '@/services/agentMermaid'
import type { Agent } from '@/types'

interface AgentFlowDiagramProps {
  agent: Agent
  options?: BuildAgentFlowOptions
  className?: string
}

function nodeClasses(state: AgentFlowNodeState) {
  switch (state) {
    case 'terminal':
      return 'border-sky-500/25 bg-sky-500/8 text-sky-200'
    case 'warning':
      return 'border-amber-500/35 bg-amber-500/10 text-amber-200'
    case 'disabled':
      return 'border-border-subtle bg-surface-2/55 text-text-muted'
    case 'active':
    default:
      return 'border-emerald-500/25 bg-emerald-500/8 text-emerald-200'
  }
}

function stateLabel(state: AgentFlowNodeState) {
  if (state === 'terminal') return 'endpoint'
  return state
}

function trimPreview(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1)}...`
}

export function AgentFlowDiagram({ agent, options, className }: AgentFlowDiagramProps) {
  const nodes = buildAgentFlowNodes(agent, options)

  return (
    <div className={`rounded-2xl border border-border-subtle bg-surface-0/45 p-4 ${className ?? ''}`}>
      <div className="space-y-0">
        {nodes.map((node, index) => (
          <div key={node.id}>
            <div className={`rounded-2xl border p-3 ${nodeClasses(node.state)}`}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-current/20 bg-surface-0/45">
                  <IconifyIcon name={node.icon} size={14} color="currentColor" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{node.title}</span>
                    <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]">{stateLabel(node.state)}</span>
                  </div>
                  <div className="mt-2 text-xs leading-relaxed text-text-muted">{trimPreview(node.detail, 126)}</div>
                  {!!node.badges?.length && (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-text-muted">
                      {node.badges.map((badge) => (
                        <span key={badge} className="rounded-full bg-surface-3 px-2 py-0.5">{badge}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {index < nodes.length - 1 && (
              <div className="ml-7 flex h-7 items-center border-l border-border-subtle pl-5 text-[10px] text-text-muted">
                {node.id === 'runtime' ? 'respond' : node.id === 'output' ? 'learn' : 'compose'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}