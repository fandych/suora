import { memo, useMemo } from 'react'
import { BotIcon, BookOpenIcon, BracesIcon, EqualIcon, FlagIcon, GitBranchIcon, GitMergeIcon, GlobeIcon, Layers2Icon, MailIcon, PlayIcon, RepeatIcon, SearchIcon, WebhookIcon, WorkflowIcon, FileCode2Icon, WrenchIcon, type LucideIcon } from 'lucide-react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { StepNodeData, StepStatus } from './PipelineFlowCanvas.utils'
import { PIPELINE_NODE_LIBRARY } from './pipelineNodeLibrary'
import { Dropdown, DropdownButton, DropdownDescription, DropdownHeading, DropdownItem, DropdownLabel, DropdownMenu, DropdownSection } from '@/components/shared/dropdown'

interface PlaceholderNodeData {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  [key: string]: unknown
}

/* ── Status styling ─────────────────────────────────────────────── */

const STATUS_RING: Record<StepStatus, string> = {
  pending: 'border-slate-300',
  running: 'border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.16)]',
  success: 'border-emerald-300',
  error: 'border-red-300',
  skipped: 'border-slate-200',
}

const STATUS_DOT: Record<StepStatus, string> = {
  pending: 'bg-slate-400',
  running: 'bg-amber-400 animate-pulse',
  success: 'bg-emerald-400',
  error: 'bg-red-400',
  skipped: 'bg-slate-500',
}

const STATUS_LABEL: Record<StepStatus, string> = {
  pending: 'text-slate-700',
  running: 'text-amber-800',
  success: 'text-emerald-800',
  error: 'text-red-800',
  skipped: 'text-slate-600',
}

/* ── Pipeline Step Node ─────────────────────────────────────────── */

type StepNode = Node<StepNodeData, 'pipelineStep'>

const NODE_TYPE_BADGE: Record<NonNullable<StepNodeData['nodeType']>, string> = {
  start: 'Entry',
  end: 'Exit',
  condition: 'Control',
  agent: 'Agent',
  pipeline: 'Pipeline',
  script: 'Script',
  code: 'Code',
  template: 'Template',
  variable: 'Variable',
  iteration: 'Iteration',
  http: 'API',
  email: 'Email',
  webhook: 'Webhook',
  toolset: 'Tool',
  rag: 'Knowledge',
  wiki: 'Wiki',
  parallel: 'Parallel',
  join: 'Join',
}

const NODE_STYLE: Record<NonNullable<StepNodeData['nodeType']>, { container: string; badge: string }> = {
  start: { container: 'border-emerald-200 bg-emerald-50/80', badge: 'Entry' },
  end: { container: 'border-slate-300 bg-slate-50/90', badge: 'Exit' },
  condition: { container: 'border-amber-200 bg-amber-50/80', badge: 'Control' },
  agent: { container: 'border-violet-200 bg-violet-50/80', badge: 'Execution' },
  pipeline: { container: 'border-indigo-200 bg-indigo-50/80', badge: 'Execution' },
  script: { container: 'border-cyan-200 bg-cyan-50/80', badge: 'Execution' },
  code: { container: 'border-emerald-200 bg-emerald-50/80', badge: 'Execution' },
  template: { container: 'border-stone-200 bg-stone-50/85', badge: 'Formatting' },
  variable: { container: 'border-yellow-200 bg-yellow-50/80', badge: 'Data' },
  iteration: { container: 'border-indigo-200 bg-indigo-50/85', badge: 'Execution' },
  http: { container: 'border-rose-200 bg-rose-50/80', badge: 'Integration' },
  email: { container: 'border-pink-200 bg-pink-50/80', badge: 'Integration' },
  webhook: { container: 'border-fuchsia-200 bg-fuchsia-50/80', badge: 'Integration' },
  toolset: { container: 'border-lime-200 bg-lime-50/80', badge: 'Execution' },
  rag: { container: 'border-teal-200 bg-teal-50/80', badge: 'Knowledge' },
  wiki: { container: 'border-sky-200 bg-sky-50/80', badge: 'Knowledge' },
  parallel: { container: 'border-blue-200 bg-blue-50/80', badge: 'Execution' },
  join: { container: 'border-orange-200 bg-orange-50/80', badge: 'Control' },
}

export const PIPELINE_NODE_ICONS: Record<NonNullable<StepNodeData['nodeType']>, LucideIcon> = {
  start: PlayIcon,
  end: FlagIcon,
  condition: GitBranchIcon,
  agent: BotIcon,
  pipeline: WorkflowIcon,
  script: FileCode2Icon,
  code: BracesIcon,
  template: FileCode2Icon,
  variable: EqualIcon,
  iteration: RepeatIcon,
  http: GlobeIcon,
  email: MailIcon,
  webhook: WebhookIcon,
  toolset: WrenchIcon,
  rag: SearchIcon,
  wiki: BookOpenIcon,
  parallel: Layers2Icon,
  join: GitMergeIcon,
}

function buildSummary(data: StepNodeData): string {
  switch (data.nodeType) {
    case 'parallel':
      return 'Parallel execution block'
    case 'join':
      return 'Merge branch outputs before continuing'
    case 'condition':
      return data.condition || 'No branch condition configured yet'
    case 'toolset':
      return typeof data.toolName === 'string' && data.toolName ? `Run tool ${data.toolName}` : 'Workspace tool invocation'
    case 'code':
      return 'Run sandboxed JavaScript against mapped workflow inputs'
    case 'template':
      return 'Render a formatted payload from workflow variables'
    case 'variable':
      return 'Assign or mutate workflow variables for downstream nodes'
    case 'iteration':
      return 'Run a child pipeline for each item in an input array'
    case 'rag':
      return 'Retrieve knowledge base context for the next step'
    case 'wiki':
      return 'Search a workspace wiki or document group'
    case 'webhook':
      return 'Send an outgoing webhook request'
    case 'pipeline':
    case 'script':
    case 'http':
    case 'email':
    case 'agent':
    default:
      return data.task || 'No task configured'
  }
}

export const PipelineStepNode = memo(function PipelineStepNode({ data }: NodeProps<StepNode>) {
  const { stepName, agentName, nodeType, onSelect, isSelected, canInsertAfter, onInsertAfter, status, retryCount, continueOnError, attempts, hasCondition, durationMs, configReady, missingRequirements, isUnreachable } = data
  const nodeKind = nodeType ?? 'agent'
  const style = NODE_STYLE[nodeKind]
  const NodeIcon = PIPELINE_NODE_ICONS[nodeKind]
  const summary = buildSummary(data)
  const groupedNodeLibrary = useMemo(() => Array.from(new Set(PIPELINE_NODE_LIBRARY.map((item) => item.category))).map((category) => ({
    category,
    items: PIPELINE_NODE_LIBRARY.filter((item) => item.category === category),
  })), [])

  return (
    <div onClick={() => onSelect?.()} className={`relative min-w-55 max-w-72 overflow-visible rounded-3xl border ${style.container} ${STATUS_RING[status]} p-0 shadow-sm transition-all ${isUnreachable ? 'opacity-80 ring-2 ring-amber-300/60' : ''} ${isSelected ? 'ring-2 ring-accent/25 shadow-[0_10px_20px_rgba(var(--t-accent-rgb),0.10)]' : 'ring-1 ring-transparent'}`}>
      <Handle type="target" position={Position.Top} className="h-3! w-3! border border-slate-300! bg-slate-100! opacity-0!" />
      <div className="flex items-start justify-between gap-3 border-b border-border-subtle/60 px-4 py-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-border-subtle/70 bg-surface-1/75 text-text-primary shadow-sm">
            <NodeIcon className="size-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">{style.badge}</p>
            <div className="truncate text-[15px] font-semibold text-slate-950">{stepName}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
          <span className={`text-[11px] font-semibold ${STATUS_LABEL[status]}`}>{status}</span>
        </div>
      </div>
      <div className="space-y-2 px-4 py-3">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="truncate font-medium text-slate-800">{agentName}</span>
          <span className="rounded-full border border-border-subtle/70 bg-surface-1/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{NODE_TYPE_BADGE[nodeKind]}</span>
        </div>
        <p className="text-[13px] leading-relaxed text-slate-700">{summary}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t border-border-subtle/60 px-4 py-2">
        {configReady === false ? (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-700">
            setup needed{missingRequirements?.length ? ` (${missingRequirements.length})` : ''}
          </span>
        ) : configReady ? (
          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] text-emerald-700">ready</span>
        ) : null}
        {isUnreachable && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-700">unreachable</span>
        )}
        {hasCondition && (
          <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] text-violet-700">conditional</span>
        )}
        {retryCount > 0 && (
          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] text-blue-700">{retryCount} {retryCount > 1 ? 'retries' : 'retry'}</span>
        )}
        {!continueOnError && (
          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] text-red-700">stop on error</span>
        )}
        {attempts != null && attempts > 1 && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-700">{attempts} attempts</span>
        )}
        {durationMs != null && (
          <span className="rounded-full bg-surface-2/80 px-1.5 py-0.5 text-[9px] text-text-muted">
            {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}
          </span>
        )}
      </div>

      <div className="relative flex items-center justify-center border-t border-border-subtle/60 px-4 pb-3 pt-2">
        <Handle type="source" position={Position.Bottom} className="h-3! w-3! border border-slate-300! bg-slate-100! opacity-0!" />
        {canInsertAfter && onInsertAfter ? (
          <Dropdown>
            <DropdownButton
              as="button"
              type="button"
              onClick={(event: React.MouseEvent) => event.stopPropagation()}
              className="nodrag nopan rounded-full border border-border-subtle/70 bg-surface-1/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition-colors hover:border-accent/25 hover:bg-accent/8 hover:text-accent"
            >
              + next node
            </DropdownButton>
            <DropdownMenu anchor="bottom end" className="w-56 rounded-xl border border-border-subtle/75 bg-surface-1/98 p-1.5 shadow-[0_18px_48px_rgba(15,23,42,0.16)] backdrop-blur-sm">
              {groupedNodeLibrary.map((group) => (
                <DropdownSection key={group.category}>
                  <DropdownHeading className="px-2.5 pt-1 pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted">{group.category}</DropdownHeading>
                  {group.items.map((item) => (
                    <DropdownItem key={item.value} onClick={() => onInsertAfter(item.value)} className="rounded-lg px-2.5 py-2 text-[11px] text-text-primary">
                      <DropdownLabel className="text-[11px] font-medium text-text-primary">{item.label}</DropdownLabel>
                      <DropdownDescription className="text-[10px] leading-4 text-text-muted">{item.value} {item.description}</DropdownDescription>
                    </DropdownItem>
                  ))}
                </DropdownSection>
              ))}
            </DropdownMenu>
          </Dropdown>
        ) : null}
      </div>
    </div>
  )
})

type PlaceholderNode = Node<PlaceholderNodeData, 'placeholder'>

export const PipelinePlaceholderNode = memo(function PipelinePlaceholderNode({ data }: NodeProps<PlaceholderNode>) {
  return (
    <div className="pointer-events-auto w-80 rounded-3xl border border-dashed border-border-subtle/75 bg-surface-1/96 p-5 text-center shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border-subtle/80 bg-surface-0/90 text-lg text-text-muted">
        +
      </div>
      <div className="mt-4 text-sm font-semibold text-text-primary">{data.title}</div>
      <p className="mt-2 text-[12px] leading-6 text-text-secondary/82">{data.description}</p>
      {data.onAction && data.actionLabel ? (
        <button
          type="button"
          onClick={data.onAction}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          className="nodrag nopan mt-4 rounded-2xl border border-accent/20 bg-accent/10 px-4 py-2 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/16"
        >
          {data.actionLabel}
        </button>
      ) : null}
    </div>
  )
})
