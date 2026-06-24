import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'
import clsx from 'clsx'
import { Badge as CatalystBadge } from '@/components/catalyst-ui/badge'
import { Button as CatalystButton } from '@/components/catalyst-ui/button'

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

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  variant?: ButtonVariant
  size?: ButtonSize
  unstyled?: boolean
}

type CatalystBadgeColor = 'amber' | 'blue' | 'emerald' | 'green' | 'red' | 'violet' | 'zinc'

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', unstyled = false, className, type, ...rest },
  ref,
) {
  if (unstyled) {
    return (
      <CatalystButton
        ref={ref}
        type={type}
        plain={true}
        className={cx(
          'inline-flex items-center justify-center gap-1.5 border-transparent bg-transparent font-medium shadow-none before:hidden after:hidden transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
          className,
        )}
        {...rest}
      >
        {rest.children}
      </CatalystButton>
    )
  }

  const buttonClassName = cx(buttonBase, buttonVariants[variant], buttonSizes[size], 'cursor-pointer', className)

  if (variant === 'secondary') {
    return (
      <CatalystButton ref={ref} type={type} outline={true} className={buttonClassName} {...rest}>
        {rest.children}
      </CatalystButton>
    )
  }

  if (variant === 'ghost') {
    return (
      <CatalystButton ref={ref} type={type} plain={true} className={buttonClassName} {...rest}>
        {rest.children}
      </CatalystButton>
    )
  }

  if (variant === 'danger') {
    return (
      <CatalystButton ref={ref} type={type} color="red" className={buttonClassName} {...rest}>
        {rest.children}
      </CatalystButton>
    )
  }

  return (
    <CatalystButton ref={ref} type={type} color="blue" className={buttonClassName} {...rest}>
      {rest.children}
    </CatalystButton>
  )
})

export function Badge({ tone = 'neutral', className, ...rest }: Omit<HTMLAttributes<HTMLSpanElement>, 'color'> & { tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' }) {
  const tones: Record<'neutral' | 'accent' | 'success' | 'warning' | 'danger', CatalystBadgeColor> = {
    neutral: 'zinc',
    accent: 'blue',
    success: 'green',
    warning: 'amber',
    danger: 'red',
  }

  return (
    <CatalystBadge
      color={tones[tone]}
      className={cx('border px-2 py-0.5 text-[11px] font-medium leading-5', className)}
      {...rest}
    />
  )
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

function workbenchMetricTone(index: number) {
  const palette: CatalystBadgeColor[] = ['blue', 'violet', 'emerald']
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
                  <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.16em] text-text-muted/45">
                    <span>{metric.label}</span>
                    <CatalystBadge color={workbenchMetricTone(index)} className="px-1.5 py-0 text-[9px] uppercase">
                      {index + 1}
                    </CatalystBadge>
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
      {items.map((item) => {
        const itemClassName = clsx(
          'rounded px-3 py-1.5 text-[12px] font-medium transition-colors cursor-pointer min-h-0 border-0 shadow-none before:shadow-none',
          value === item.value ? 'nav-item-active text-text-primary' : 'glass-hover text-text-muted hover:text-text-primary',
        )

        if (value === item.value) {
          return (
            <CatalystButton
              key={item.value}
              type="button"
              outline={true}
              onClick={() => onChange(item.value)}
              className={itemClassName}
            >
              {item.label}
            </CatalystButton>
          )
        }

        return (
          <CatalystButton
            key={item.value}
            type="button"
            plain={true}
            onClick={() => onChange(item.value)}
            className={itemClassName}
          >
            {item.label}
          </CatalystButton>
        )
      })}
    </div>
  )
}

export function EntityListItem({ active, className, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> & { active?: boolean }) {
  const itemClassName = cx(
    'w-full rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer justify-start',
    active ? 'border-accent/35 bg-accent/10 text-text-primary' : 'glass-hover bg-transparent text-text-secondary hover:border-border-subtle hover:text-text-primary',
    className,
  )

  if (active) {
    return (
      <CatalystButton type="button" color="blue" className={itemClassName} {...rest}>
        {rest.children}
      </CatalystButton>
    )
  }

  return (
    <CatalystButton type="button" outline={true} className={itemClassName} {...rest}>
      {rest.children}
    </CatalystButton>
  )
}
