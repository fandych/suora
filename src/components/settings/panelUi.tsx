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
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-4 xl:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium text-text-muted">{eyebrow}</div>
          <h3 className="mt-1 text-base font-semibold text-text-primary">{title}</h3>
          {description && <p className="mt-1 max-w-3xl text-[13px] leading-5 text-text-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function SettingsStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${accent ? 'border-accent/25 bg-accent/8' : 'border-border-subtle bg-surface-0/45'}`}>
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className={`mt-1 text-base font-semibold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</div>
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
    <section className="rounded-3xl border border-border-subtle/55 bg-surface-1/78 p-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)] xl:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <p className="max-w-3xl text-[13px] leading-6 text-text-secondary/80">{description}</p>
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

export const settingsLabelClass = 'mb-1.5 block text-[12px] font-medium text-text-secondary'
export const settingsHintClass = 'mt-2 text-[11px] leading-relaxed text-text-muted'
export const settingsFieldCardClass = 'rounded-lg border border-border-subtle bg-surface-0/45 p-3'
export const settingsSurfaceCardClass = 'rounded-md border border-border-subtle bg-surface-2/55 p-3'
export const settingsInputClass = 'relative block w-full appearance-none rounded-lg border border-zinc-950/10 bg-white px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] text-sm/6 text-zinc-950 shadow-sm transition-colors placeholder:text-zinc-500 hover:border-zinc-950/20 focus:outline-hidden sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20'
export const settingsSelectClass = `${settingsInputClass} pr-[calc(--spacing(10)-1px)]`
export const settingsMonoInputClass = `${settingsInputClass} font-mono`
export const settingsTextAreaClass = `${settingsInputClass} min-h-32 resize-y leading-6`
export const settingsCheckboxClass = 'size-4 rounded-[0.3125rem] border border-zinc-950/15 bg-white text-accent shadow-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 dark:border-white/15 dark:bg-white/5'
export const settingsRadioClass = 'size-4 border border-zinc-950/15 bg-white text-accent shadow-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 dark:border-white/15 dark:bg-white/5'
export const settingsRangeClass = 'w-full cursor-pointer accent-accent'
export const settingsPrimaryButtonClass = 'relative inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-700/90 bg-blue-600 px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] text-sm/6 font-semibold text-white shadow-sm transition data-[hover=true]:bg-blue-500 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50'
export const settingsSoftButtonClass = 'relative inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] text-sm/6 font-semibold text-blue-700 transition hover:bg-blue-500/15 dark:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50'
export const settingsSecondaryButtonClass = 'relative inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-950/10 bg-white px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] text-sm/6 font-semibold text-zinc-950 shadow-sm transition hover:bg-zinc-950/2.5 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50'
export const settingsDangerButtonClass = 'relative inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-700/90 bg-red-600 px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] text-sm/6 font-semibold text-white shadow-sm transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50'

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
        {description && <p className="mt-1 text-[12px] leading-6 text-text-muted">{description}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} color="blue" aria-label={label} className="shrink-0" />
    </div>
  )
}