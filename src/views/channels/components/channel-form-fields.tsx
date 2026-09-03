import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{children}</div>
}

export function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export function CompactInput(props: React.ComponentProps<typeof Input>) {
  return <Input className="h-8 text-xs" {...props} />
}

export function CompactTextarea(props: React.ComponentProps<typeof Textarea>) {
  return <Textarea className="min-h-20 text-xs" {...props} />
}

export function Hint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[11px] leading-5 text-muted-foreground", className)}>{children}</p>
}