import type { ReactNode } from 'react'
import { Switch } from '@/components/catalyst-ui/switch'

export function SettingsSection({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border-subtle/65 bg-surface-1/88 p-4.5 xl:p-5.5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted/78">{eyebrow}</div>
          <h3 className="mt-1.5 text-[17px] font-semibold text-text-primary">{title}</h3>
          {description && <p className="mt-1.5 max-w-3xl text-[13px] leading-6 text-text-secondary/82">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4.5">{children}</div>
    </section>
  )
}

export function SettingsStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${accent ? 'border-accent/22 bg-accent/8' : 'border-border-subtle/65 bg-surface-0/45'}`}>
      <div className="text-[11px] uppercase tracking-[0.08em] text-text-muted/72">{label}</div>
      <div className={`mt-1.5 text-[15px] font-semibold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</div>
    </div>
  )
}

export function SettingsOverview({
  description,
  details,
  action,
  stats,
  statsClassName = 'grid gap-2 sm:grid-cols-2 xl:w-md xl:grid-cols-4',
}: {
  description: ReactNode
  details?: ReactNode
  action?: ReactNode
  stats: ReactNode
  statsClassName?: string
}) {
  return (
    <section className="rounded-3xl border border-border-subtle/60 bg-surface-1/82 p-4.5 shadow-[0_14px_36px_rgba(15,23,42,0.06)] xl:p-5.5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <p className="max-w-3xl text-[13px] leading-6 text-text-secondary/84">{description}</p>
          {details ? <div className="mt-3 flex flex-wrap items-center gap-2">{details}</div> : null}
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          {action ? <div className="flex flex-wrap gap-2 xl:justify-end">{action}</div> : null}
          <div className={statsClassName}>{stats}</div>
        </div>
      </div>
    </section>
  )
}

export const settingsLabelClass = 'mb-2 block text-[12px] font-medium text-text-secondary'
export const settingsHintClass = 'mt-2 text-[12px] leading-relaxed text-text-muted'
export const settingsFieldCardClass = 'rounded-2xl border border-border-subtle/65 bg-surface-0/45 p-3.5'
export const settingsSurfaceCardClass = 'rounded-xl border border-border-subtle/65 bg-surface-2/55 p-3.5'
export const settingsRangeClass = 'w-full cursor-pointer accent-accent'

export function SettingsToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <div className={`${settingsFieldCardClass} flex items-start justify-between gap-4`}>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-text-primary">{label}</div>
        {description && <p className="mt-1.5 text-[12px] leading-6 text-text-muted">{description}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} color="blue" aria-label={label} className="shrink-0" />
    </div>
  )
}