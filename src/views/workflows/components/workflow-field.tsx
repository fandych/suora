import { CircleHelpIcon } from "lucide-react"

import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"

type WorkflowFieldProps = {
  label: string
  hint?: string
  error?: string | null
  children: React.ReactNode
}

function toTitleCase(value: string) {
  const words = value.trim().replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[^A-Za-z0-9]+/).filter(Boolean)
  return words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`).join(" ")
}

export function WorkflowField({ label, hint, error, children }: WorkflowFieldProps) {
  const displayLabel = toTitleCase(label)
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <p className="text-[10px] font-medium leading-4 text-muted-foreground">{displayLabel}</p>
        {hint ? <Popover>
          <PopoverTrigger aria-label={`About ${displayLabel}`} className="text-muted-foreground hover:text-foreground"><CircleHelpIcon className="size-3" /></PopoverTrigger>
          <PopoverContent align="start" className="w-64"><PopoverTitle>{displayLabel}</PopoverTitle><PopoverDescription>{hint}</PopoverDescription></PopoverContent>
        </Popover> : null}
      </div>
      {children}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

export function WorkflowPanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 pt-1">
      <div className="text-[10px] font-semibold text-muted-foreground">{toTitleCase(title)}</div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}