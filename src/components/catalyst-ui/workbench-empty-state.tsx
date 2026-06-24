import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Badge } from './badge'

export type WorkbenchEmptyMetric = {
  label: ReactNode
  value: ReactNode
  description?: ReactNode
}

function workbenchMetricTone(index: number) {
  const palette = ['blue', 'violet', 'emerald'] as const
  return palette[index % palette.length]
}

export function WorkbenchEmptyState({
  icon,
  eyebrow,
  title,
  description,
  actions,
  metrics,
  align = metrics && metrics.length > 0 ? 'left' : 'center',
  className,
  maxWidthClassName = 'max-w-5xl',
}: {
  icon: ReactNode
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  metrics?: WorkbenchEmptyMetric[]
  align?: 'left' | 'center'
  className?: string
  maxWidthClassName?: string
}) {
  const centered = align === 'center'
  const hasMetrics = Boolean(metrics?.length)

  return (
    <div className={clsx('mx-auto flex h-full w-full items-center justify-center', maxWidthClassName)}>
      <div className={clsx('w-full rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/94 via-surface-1/88 to-surface-2/72 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.16)] animate-fade-in xl:p-10', className)}>
        <div className={clsx('flex flex-col gap-8', hasMetrics ? 'xl:flex-row xl:items-start xl:justify-between' : 'items-center text-center')}>
          <div className={clsx('w-full max-w-2xl', centered && 'text-center')}>
            <div className={clsx('flex h-18 w-18 items-center justify-center rounded-[26px] border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]', centered && 'mx-auto')}>
              {icon}
            </div>
            {eyebrow && <p className="mt-5 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{eyebrow}</p>}
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">{title}</h2>
            {description && (
              <div className={clsx('mt-3 text-[14px] leading-7 text-text-secondary/82', hasMetrics ? 'max-w-xl' : 'mx-auto max-w-xl')}>
                {description}
              </div>
            )}
            {actions && <div className={clsx('mt-6 flex flex-wrap gap-3', centered && 'justify-center')}>{actions}</div>}
          </div>

          {hasMetrics && (
            <div className="grid gap-3 sm:grid-cols-3 xl:w-[24rem] xl:grid-cols-1">
              {metrics?.map((metric, index) => (
                <div key={index} className="rounded-[22px] border border-border-subtle/55 bg-surface-0/60 p-4">
                  <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.16em] text-text-muted/45">
                    <span>{metric.label}</span>
                    <Badge color={workbenchMetricTone(index)} className="px-1.5 py-0 text-[9px] uppercase">
                      {index + 1}
                    </Badge>
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-text-primary tabular-nums">{metric.value}</div>
                  {metric.description && <div className="mt-1 text-[12px] text-text-muted">{metric.description}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
