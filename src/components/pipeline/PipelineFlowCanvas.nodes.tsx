import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { StepNodeData, StepStatus, TerminalNodeData } from './PipelineFlowCanvas.utils'

/* ── Status styling ─────────────────────────────────────────────── */

const STATUS_RING: Record<StepStatus, string> = {
  pending: 'border-slate-500/40',
  running: 'border-amber-400/70 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
  success: 'border-emerald-400/60',
  error: 'border-red-400/60',
  skipped: 'border-slate-600/40',
}

const STATUS_BG: Record<StepStatus, string> = {
  pending: 'bg-slate-800/60',
  running: 'bg-amber-950/40',
  success: 'bg-emerald-950/40',
  error: 'bg-red-950/40',
  skipped: 'bg-slate-900/50',
}

const STATUS_DOT: Record<StepStatus, string> = {
  pending: 'bg-slate-400',
  running: 'bg-amber-400 animate-pulse',
  success: 'bg-emerald-400',
  error: 'bg-red-400',
  skipped: 'bg-slate-500',
}

const STATUS_LABEL: Record<StepStatus, string> = {
  pending: 'text-slate-400',
  running: 'text-amber-300',
  success: 'text-emerald-300',
  error: 'text-red-300',
  skipped: 'text-slate-500',
}

/* ── Pipeline Step Node ─────────────────────────────────────────── */

type StepNode = Node<StepNodeData, 'pipelineStep'>

export const PipelineStepNode = memo(function PipelineStepNode({ data }: NodeProps<StepNode>) {
  const { stepIndex, stepName, agentName, task, status, retryCount, continueOnError, attempts, hasCondition, durationMs } = data

  return (
    <div className={`w-[260px] rounded-2xl border-2 ${STATUS_RING[status]} ${STATUS_BG[status]} p-3 transition-shadow`}>
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-slate-500" />

      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/5 text-[10px] font-bold text-white/60">
          {stepIndex + 1}
        </span>
        <span className="truncate text-xs font-semibold text-white/90">{stepName}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
          <span className={`text-[10px] font-medium ${STATUS_LABEL[status]}`}>{status}</span>
        </div>
      </div>

      {/* Agent */}
      <div className="mt-1.5 truncate text-[11px] text-white/50">{agentName}</div>

      {/* Task preview */}
      <div className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-white/40">{task}</div>

      {/* Badges */}
      <div className="mt-2 flex flex-wrap gap-1">
        {hasCondition && (
          <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] text-violet-300">conditional</span>
        )}
        {retryCount > 0 && (
          <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] text-blue-300">{retryCount} retry</span>
        )}
        {!continueOnError && (
          <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] text-red-300">stop on error</span>
        )}
        {attempts != null && attempts > 1 && (
          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-300">{attempts} attempts</span>
        )}
        {durationMs != null && (
          <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] text-white/40">
            {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-slate-500" />
    </div>
  )
})

/* ── Terminal Node (Start / Finish) ─────────────────────────────── */

type TerminalNode = Node<TerminalNodeData, 'terminal'>

export const TerminalNode = memo(function TerminalNode({ data }: NodeProps<TerminalNode>) {
  const isStart = data.label === 'Start'
  return (
    <div className="flex h-11 w-[100px] items-center justify-center rounded-full border border-slate-600/50 bg-slate-800/70 text-xs font-medium text-white/70">
      {!isStart && <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-slate-500" />}
      {data.label}
      {isStart && <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-slate-500" />}
    </div>
  )
})
