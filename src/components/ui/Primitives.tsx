import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

const buttonBase = 'inline-flex items-center justify-center gap-1.5 border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'border-accent bg-accent text-white hover:bg-accent-hover',
  secondary: 'glass-subtle glass-hover border-border-subtle text-text-secondary hover:border-border hover:text-text-primary',
  ghost: 'glass-hover border-transparent bg-transparent text-text-muted hover:text-text-primary',
  danger: 'border-danger/30 bg-danger/10 text-danger hover:bg-danger/15',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-md px-2.5 text-[12px]',
  md: 'h-9 rounded-md px-3 text-sm',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={cx(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...rest} />
})

export function Badge({ tone = 'neutral', className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' }) {
  const tones = {
    neutral: 'border-border-subtle bg-surface-2 text-text-muted',
    accent: 'border-accent/25 bg-accent/10 text-accent',
    success: 'border-success/25 bg-success/10 text-success',
    warning: 'border-warning/25 bg-warning/10 text-warning',
    danger: 'border-danger/25 bg-danger/10 text-danger',
  }
  return <span className={cx('inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5', tones[tone], className)} {...rest} />
}

export function Panel({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cx('glass glass-card rounded-lg border p-4', className)} {...rest} />
}

export function Toolbar({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('glass-subtle flex min-h-12 items-center justify-between gap-3 border-b px-4', className)} {...rest} />
}

export function EmptyState({ title, description, action, className }: { title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('glass-subtle flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed px-6 py-8 text-center', className)}>
      <div className="text-sm font-medium text-text-primary">{title}</div>
      {description && <p className="mt-1 max-w-sm text-[12px] leading-5 text-text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export type WorkbenchEmptyMetric = {
  label: ReactNode
  value: ReactNode
  description?: ReactNode
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
    <div className={cx('mx-auto flex h-full w-full items-center justify-center', maxWidthClassName)}>
      <div className={cx('w-full rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/94 via-surface-1/88 to-surface-2/72 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.16)] animate-fade-in xl:p-10', className)}>
        <div className={cx('flex flex-col gap-8', hasMetrics ? 'xl:flex-row xl:items-start xl:justify-between' : 'items-center text-center')}>
          <div className={cx('w-full max-w-2xl', centered && 'text-center')}>
            <div className={cx('flex h-18 w-18 items-center justify-center rounded-[26px] border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]', centered && 'mx-auto')}>
              {icon}
            </div>
            {eyebrow && <p className="mt-5 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{eyebrow}</p>}
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">{title}</h2>
            {description && (
              <div className={cx('mt-3 text-[14px] leading-7 text-text-secondary/82', hasMetrics ? 'max-w-xl' : 'mx-auto max-w-xl')}>
                {description}
              </div>
            )}
            {actions && <div className={cx('mt-6 flex flex-wrap gap-3', centered && 'justify-center')}>{actions}</div>}
          </div>

          {hasMetrics && (
            <div className="grid gap-3 sm:grid-cols-3 xl:w-[24rem] xl:grid-cols-1">
              {metrics?.map((metric, index) => (
                <div key={index} className="rounded-[22px] border border-border-subtle/55 bg-surface-0/60 p-4">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{metric.label}</div>
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

export function Tabs<TValue extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: Array<{ value: TValue; label: ReactNode }>
  value: TValue
  onChange: (value: TValue) => void
  className?: string
}) {
  return (
    <div className={cx('glass-subtle inline-flex rounded-md border p-0.5', className)}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cx(
            'rounded px-3 py-1.5 text-[12px] font-medium transition-colors',
            value === item.value ? 'nav-item-active text-text-primary' : 'glass-hover text-text-muted hover:text-text-primary',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function EntityListItem({ active, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
        active ? 'border-accent/35 bg-accent/10 text-text-primary' : 'glass-hover border-transparent bg-transparent text-text-secondary hover:border-border-subtle hover:text-text-primary',
        className,
      )}
      {...rest}
    />
  )
}
