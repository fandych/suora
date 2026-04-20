import type { ReactNode } from 'react'

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
    <section className="rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)] xl:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{eyebrow}</div>
          <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{title}</h3>
          {description && <p className="mt-2 max-w-3xl text-[13px] leading-6 text-text-secondary/80">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function SettingsStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-3xl border px-4 py-3 ${accent ? 'border-accent/18 bg-accent/10' : 'border-border-subtle/55 bg-surface-0/60'}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted/45">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</div>
    </div>
  )
}

export const settingsLabelClass = 'mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted/55'
export const settingsHintClass = 'mt-2 text-[11px] leading-relaxed text-text-muted'
export const settingsFieldCardClass = 'rounded-3xl border border-border-subtle/45 bg-surface-0/60 p-4'
export const settingsSurfaceCardClass = 'rounded-2xl border border-border-subtle/45 bg-surface-2/65 p-3'
export const settingsInputClass = 'w-full rounded-2xl border border-border-subtle/55 bg-surface-2/80 px-3.5 py-3 text-sm text-text-primary placeholder-text-muted/55 transition-colors focus:border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50'
export const settingsSelectClass = settingsInputClass
export const settingsMonoInputClass = `${settingsInputClass} font-mono`
export const settingsTextAreaClass = `${settingsInputClass} min-h-32 resize-y leading-6`
export const settingsCheckboxClass = 'h-4 w-4 rounded border-border bg-surface-2 text-accent focus:ring-accent/30'
export const settingsRadioClass = 'h-4 w-4 border-border bg-surface-2 text-accent focus:ring-accent/30'
export const settingsRangeClass = 'w-full cursor-pointer accent-accent'
export const settingsPrimaryButtonClass = 'inline-flex items-center justify-center gap-1.5 rounded-2xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50'
export const settingsSoftButtonClass = 'inline-flex items-center justify-center gap-1.5 rounded-2xl border border-accent/20 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50'
export const settingsSecondaryButtonClass = 'inline-flex items-center justify-center gap-1.5 rounded-2xl border border-border-subtle/55 bg-surface-0/70 px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-accent/18 hover:bg-surface-0/90 disabled:cursor-not-allowed disabled:opacity-50'
export const settingsDangerButtonClass = 'inline-flex items-center justify-center gap-1.5 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-50'

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
      <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${checked ? 'border-accent/30 bg-accent/18' : 'border-border-subtle/55 bg-surface-2/80'}`}
        aria-label={label}
      >
        <span
          className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  )
}