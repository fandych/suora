import { CheckIcon, ChevronRightIcon, CopyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { WorkflowTraceJsonPreview } from "@/views/workflows/components/workflow-trace-json-preview"

export function WorkflowTraceCopyButton({ copied, onClick, label }: { copied: boolean; onClick: () => void; label: string }) {
  return (
    <Button type="button" variant="ghost" size="icon-xs" className="mr-1 size-5" onClick={onClick} aria-label={label} title={copied ? "Copied" : label}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  )
}

export function WorkflowTraceValueSection({ id, label, value, copied, onCopy }: { id: string; label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <Collapsible className="rounded-lg border">
      <div className="flex items-center gap-1">
        <CollapsibleTrigger className={`group/${id} flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/60`}>
          <ChevronRightIcon className={`size-3 transition-transform group-data-panel-open/${id}:rotate-90`} />
          {label}
        </CollapsibleTrigger>
        <WorkflowTraceCopyButton copied={copied} onClick={onCopy} label={`Copy ${label.toLowerCase()}`} />
      </div>
      <CollapsibleContent className="border-t px-2 py-2">
        <WorkflowTraceJsonPreview value={value} />
      </CollapsibleContent>
    </Collapsible>
  )
}