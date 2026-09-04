type WorkflowFieldProps = {
  label: string
  hint?: string
  children: React.ReactNode
}

export function WorkflowField({ label, hint, children }: WorkflowFieldProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-foreground">{label}</p>
      {children}
      {hint ? <p className="text-[11px] leading-4 text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function WorkflowPanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}