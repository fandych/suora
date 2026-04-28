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
