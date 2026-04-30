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

export const settingsLabelClass = 'mb-1.5 block text-[12px] font-medium text-text-secondary'
export const settingsHintClass = 'mt-2 text-[11px] leading-relaxed text-text-muted'
export const settingsFieldCardClass = 'rounded-lg border border-border-subtle bg-surface-0/45 p-3'
export const settingsSurfaceCardClass = 'rounded-md border border-border-subtle bg-surface-2/55 p-3'
export const settingsInputClass = 'w-full rounded-md border border-border-subtle bg-surface-1 px-3 py-2.5 text-sm text-text-primary placeholder-text-muted/55 transition-colors focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50'
export const settingsSelectClass = settingsInputClass
export const settingsMonoInputClass = `${settingsInputClass} font-mono`
export const settingsTextAreaClass = `${settingsInputClass} min-h-32 resize-y leading-6`
export const settingsCheckboxClass = 'h-4 w-4 rounded border-border bg-surface-2 text-accent focus:ring-accent/30'
export const settingsRadioClass = 'h-4 w-4 border-border bg-surface-2 text-accent focus:ring-accent/30'
export const settingsRangeClass = 'w-full cursor-pointer accent-accent'
export const settingsPrimaryButtonClass = 'inline-flex items-center justify-center gap-1.5 rounded-md border border-accent bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50'
export const settingsSoftButtonClass = 'inline-flex items-center justify-center gap-1.5 rounded-md border border-accent/25 bg-accent/10 px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50'
export const settingsSecondaryButtonClass = 'inline-flex items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-1 px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50'
export const settingsDangerButtonClass = 'inline-flex items-center justify-center gap-1.5 rounded-md border border-danger/25 bg-danger/10 px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-50'

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
        className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors ${checked ? 'border-accent/30 bg-accent/20' : 'border-border-subtle bg-surface-2'}`}
        aria-label={label}
      >
        <span
          className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>
    </div>
  )
}