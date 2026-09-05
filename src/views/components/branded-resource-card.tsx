import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type BrandedResourceCardProps = {
  title: string
  description: string
  badges?: React.ReactNode
  leading: React.ReactNode
  actionLabel: string
  onOpen: () => void
  metrics?: Array<{
    label: string
    value: string
    mono?: boolean
  }>
}

export function BrandedResourceCard({ title, description, badges, leading, actionLabel, onOpen, metrics = [] }: BrandedResourceCardProps) {
  return (
    <Card
      className="min-w-0 cursor-pointer border-border/70 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/20 hover:shadow-sm"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen()
        }
      }}
      role="button"
      tabIndex={0}
    >
      <CardHeader className="gap-3 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          {leading}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <CardTitle className="truncate text-base">{title}</CardTitle>
              {badges}
            </div>
            <CardDescription className="line-clamp-2 text-sm leading-6">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {metrics.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border bg-muted/20 px-3 py-2.5">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</div>
                <div className={`mt-1 truncate text-sm text-foreground ${metric.mono ? "font-mono" : "font-medium"}`}>{metric.value}</div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); onOpen() }}>{actionLabel}</Button>
        </div>
      </CardContent>
    </Card>
  )
}