import { CircleHelpIcon } from "lucide-react"

import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"

type WorkflowFieldProps = {
  label: string
  hint?: string
  children: React.ReactNode
}

export function WorkflowField({ label, hint, children }: WorkflowFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <p className="text-[11px] font-medium text-foreground">{label}</p>
        {hint ? <Popover>
          <PopoverTrigger aria-label={`About ${label}`} className="text-muted-foreground hover:text-foreground"><CircleHelpIcon className="size-3.5" /></PopoverTrigger>
          <PopoverContent align="start" className="w-64"><PopoverTitle>{label}</PopoverTitle><PopoverDescription>{hint}</PopoverDescription></PopoverContent>
        </Popover> : null}
      </div>
      {children}
    </div>
  )
}

export function WorkflowPanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}