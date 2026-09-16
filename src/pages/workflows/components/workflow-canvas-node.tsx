import { memo, useEffect, useMemo } from "react"
import {
  BotIcon,
  BracesIcon,
  Code2Icon,
  FileSearchIcon,
  FlagIcon,
  GitBranchIcon,
  GitForkIcon,
  GitMergeIcon,
  GlobeIcon,
  MailIcon,
  PlayIcon,
  Repeat2Icon,
  RouteIcon,
  SendIcon,
  VariableIcon,
  type LucideIcon,
} from "lucide-react"
import { Position, useUpdateNodeInternals, type Node, type NodeProps } from "@xyflow/react"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { WorkflowNodeData } from "@/types/workflow"
import { cn } from "@/lib/utils"
import { useWorkflowNodeActions } from "@/pages/workflows/components/workflow-node-actions-context"
import { WorkflowNodeHandle, WorkflowNodeShell } from "@/pages/workflows/components/workflow-node-primitives"
import { WorkflowButtonHandle } from "@/pages/workflows/components/workflow-button-handle"

const NODE_STYLES: Record<WorkflowNodeData["kind"], { container: string; badge: string; icon: LucideIcon }> = {
  start: {
    container: "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30",
    badge: "Entry",
    icon: PlayIcon,
  },
  end: {
    container: "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40",
    badge: "Exit",
    icon: FlagIcon,
  },
  "document-retrieval": {
    container: "border-sky-200 bg-sky-50/80 dark:border-sky-900 dark:bg-sky-950/30",
    badge: "Knowledge",
    icon: FileSearchIcon,
  },
  agent: {
    container: "border-violet-200 bg-violet-50/80 dark:border-violet-900 dark:bg-violet-950/30",
    badge: "Integration",
    icon: BotIcon,
  },
  fork: {
    container: "border-orange-200 bg-orange-50/80 dark:border-orange-900 dark:bg-orange-950/30",
    badge: "Control",
    icon: GitForkIcon,
  },
  join: {
    container: "border-orange-200 bg-orange-50/80 dark:border-orange-900 dark:bg-orange-950/30",
    badge: "Control",
    icon: GitMergeIcon,
  },
  "if-else": {
    container: "border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30",
    badge: "Control",
    icon: GitBranchIcon,
  },
  http: {
    container: "border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/30",
    badge: "Integration",
    icon: GlobeIcon,
  },
  script: {
    container: "border-slate-300 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-900/40",
    badge: "Execution",
    icon: Code2Icon,
  },
  "variable-assigner": {
    container: "border-cyan-200 bg-cyan-50/80 dark:border-cyan-900 dark:bg-cyan-950/30",
    badge: "Data",
    icon: VariableIcon,
  },
  template: {
    container: "border-cyan-200 bg-cyan-50/80 dark:border-cyan-900 dark:bg-cyan-950/30",
    badge: "Data",
    icon: BracesIcon,
  },
  "ai-response": {
    container: "border-violet-200 bg-violet-50/80 dark:border-violet-900 dark:bg-violet-950/30",
    badge: "AI",
    icon: BotIcon,
  },
  loop: {
    container: "border-orange-200 bg-orange-50/80 dark:border-orange-900 dark:bg-orange-950/30",
    badge: "Control",
    icon: Repeat2Icon,
  },
  parallel: {
    container: "border-orange-200 bg-orange-50/80 dark:border-orange-900 dark:bg-orange-950/30",
    badge: "Control",
    icon: GitForkIcon,
  },
  serial: {
    container: "border-orange-200 bg-orange-50/80 dark:border-orange-900 dark:bg-orange-950/30",
    badge: "Control",
    icon: RouteIcon,
  },
  toolset: {
    container: "border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/30",
    badge: "Integration",
    icon: SendIcon,
  },
  webhook: {
    container: "border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/30",
    badge: "Integration",
    icon: GlobeIcon,
  },
  "wiki-retrieval": {
    container: "border-sky-200 bg-sky-50/80 dark:border-sky-900 dark:bg-sky-950/30",
    badge: "Knowledge",
    icon: FileSearchIcon,
  },
  smtp: {
    container: "border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/30",
    badge: "Integration",
    icon: MailIcon,
  },
  condition: {
    container: "border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30",
    badge: "Control",
    icon: GitBranchIcon,
  },
}

export const WORKFLOW_NODE_ICONS: Record<WorkflowNodeData["kind"], LucideIcon> = {
  start: PlayIcon,
  end: FlagIcon,
  "document-retrieval": FileSearchIcon,
  agent: BotIcon,
  fork: GitForkIcon,
  join: GitMergeIcon,
  "if-else": GitBranchIcon,
  http: GlobeIcon,
  script: Code2Icon,
  "variable-assigner": VariableIcon,
  template: BracesIcon,
  "ai-response": BotIcon,
  loop: Repeat2Icon,
  parallel: GitForkIcon,
  serial: RouteIcon,
  toolset: SendIcon,
  webhook: GlobeIcon,
  "wiki-retrieval": FileSearchIcon,
  smtp: MailIcon,
  condition: GitBranchIcon,
}

function getSummary(node: WorkflowNodeData) {
  switch (node.kind) {
    case "start":
      return node.task || "Entry node"
    case "end":
      return node.outputKey?.trim() ? `Return ${node.outputKey}` : "Finalize the workflow output"
    case "document-retrieval":
      return node.documentName?.trim() || node.documentId?.trim() || "No knowledge base selected"
    case "agent":
      return node.agentId?.trim() || node.task?.trim() || node.prompt?.trim() || "No agent configured"
    case "fork":
      return `${node.branchCount ?? 2} branches`
    case "join":
      return `Merge strategy: ${node.joinStrategy ?? "wait-all"}`
    case "if-else":
      return node.runIf?.trim() || node.branches?.[0]?.expression?.trim() || "No condition expression yet"
    case "http":
      return node.url?.trim() ? `${node.method ?? "POST"} ${node.url}` : `${node.method ?? "POST"} request`
    case "script":
      return `${node.runtime ?? "node"} -> $${node.outputKey || "script_result"}`
    case "variable-assigner":
      return `${node.variableName || node.outputKey || "value"} = ${node.variableValue || "…"}`
    case "template":
      return node.template || "No template configured"
    case "smtp":
      return node.emailTo || "No recipient configured"
    case "condition":
      return node.runIf || "No condition expression yet"
    default:
      return node.task || node.prompt || "Configure this node"
  }
}

type WorkflowCanvasFlowNode = Node<WorkflowNodeData, "workflowNode">

export const WorkflowCanvasNode = memo(function WorkflowCanvasNode({
  id,
  data: node,
  selected,
}: NodeProps<WorkflowCanvasFlowNode>) {
  const updateNodeInternals = useUpdateNodeInternals()
  const style = NODE_STYLES[node.kind]
  const NodeIcon = WORKFLOW_NODE_ICONS[node.kind] ?? style.icon
  const executionStatus = node.executionStatus
  const summary = getSummary(node)
  const { canEdit, hasOutgoingConnection, onAddNodeFromHandle } = useWorkflowNodeActions()
  const branchHandleIds = useMemo(
    () => (node.kind === "if-else" ? (node.branches ?? []).map((branch) => branch.id).join("\u0000") : ""),
    [node.branches, node.kind],
  )

  useEffect(() => {
    updateNodeInternals(id)
  }, [branchHandleIds, id, updateNodeInternals])

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <WorkflowNodeShell
            className={cn(
              style.container,
              selected ? "ring-2 ring-primary/25" : "ring-1 ring-transparent",
              executionStatus === "running" ? "ring-2 ring-sky-500 shadow-sky-200" : "",
              executionStatus === "success" ? "ring-2 ring-emerald-500/70" : "",
              executionStatus === "error" ? "ring-2 ring-red-500/80" : "",
              executionStatus === "queued" || executionStatus === "skipped" ? "opacity-60 grayscale" : "",
              node.enabled === false ? "opacity-55 grayscale" : "",
            )}
          >
            {node.kind !== "start" ? (
              <>
                <WorkflowNodeHandle
                  id="target-top"
                  type="target"
                  position={Position.Top}
                  aria-label={`Connect to ${node.label}`}
                />
              </>
            ) : null}
            <div className="border-b px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border bg-background/75 text-foreground shadow-sm">
                    <NodeIcon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {style.badge}
                    </p>
                    <div className="truncate text-sm font-semibold text-foreground">{node.label}</div>
                  </div>
                </div>
                <div className="flex min-w-0 shrink items-center gap-1.5">
                  <Badge variant="outline" className="max-w-24 truncate">
                    {node.kind}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="px-4 py-3">
              <p className="min-w-0 truncate text-xs leading-relaxed text-muted-foreground" title={summary}>
                {summary}
              </p>
            </div>
            {node.kind === "if-else" ? (
              <>
                {(node.branches ?? []).map((branch, index, branches) => (
                  <div key={branch.id}>
                    <WorkflowButtonHandle
                      handleId={branch.id}
                      position={Position.Bottom}
                      offset={`${((index + 1) / (branches.length + 1)) * 100}%`}
                      canEdit={canEdit}
                      hasConnection={hasOutgoingConnection(id, branch.id)}
                      getIcon={(kind) => WORKFLOW_NODE_ICONS[kind]}
                      onAdd={(kind) => onAddNodeFromHandle(id, branch.id, kind)}
                    />
                  </div>
                ))}
              </>
            ) : (
              <>
                {node.kind !== "end" ? (
                  <>
                    <WorkflowButtonHandle
                      handleId={null}
                      position={Position.Bottom}
                      canEdit={canEdit}
                      hasConnection={hasOutgoingConnection(id, null)}
                      getIcon={(kind) => WORKFLOW_NODE_ICONS[kind]}
                      onAdd={(kind) => onAddNodeFromHandle(id, null, kind)}
                    />
                  </>
                ) : null}
              </>
            )}
          </WorkflowNodeShell>
        }
      />
      <TooltipContent className="max-w-64 text-center text-xs">
        {node.description || "No description configured."}
      </TooltipContent>
    </Tooltip>
  )
})

export const workflowNodeTypes = {
  workflowNode: WorkflowCanvasNode,
}
