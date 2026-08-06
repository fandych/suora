import clsx from 'clsx'

export const workbenchSidebarCardClass =
  'rounded-[26px] border border-border/65 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--t-surface-1)_99%,transparent),color-mix(in_srgb,var(--t-surface-2)_92%,transparent))] p-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]'

export const workbenchSidebarEmptyClass =
  'rounded-[26px] border border-dashed border-border/60 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--t-surface-1)_98%,transparent),color-mix(in_srgb,var(--t-surface-0)_96%,transparent))] px-4 py-10 text-center'

export const workbenchSidebarSearchInputClass =
  'min-h-10 w-full rounded-[18px] border border-border/65 bg-surface-1/92 py-2.5 pl-10 pr-10 text-[13px] leading-5 text-text-primary placeholder:text-text-muted/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'

export const workbenchSidebarMetaClass =
  'mt-2 flex items-center justify-between text-[11px] text-text-muted/72'

export const workbenchSidebarPrimaryActionClass =
  'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-[16px] bg-accent px-3.5 py-2 text-[12px] font-semibold text-white shadow-[0_6px_16px_rgba(var(--t-accent-rgb),0.18)] transition-all hover:bg-accent-hover hover:shadow-[0_8px_20px_rgba(var(--t-accent-rgb),0.22)]'

export const workbenchSidebarAccentActionClass =
  'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-[16px] border border-accent/24 bg-accent/12 px-3.5 py-2 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/18'

export const workbenchSidebarSubtleActionClass =
  'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-[16px] border border-border/60 bg-surface-1/82 px-3.5 py-2 text-[12px] font-semibold text-text-secondary transition-colors hover:border-accent/18 hover:bg-accent/8 hover:text-accent'

export const workbenchSidebarIconClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border border-border/55 bg-surface-1/98 text-accent shadow-[0_4px_12px_rgba(15,23,42,0.04)]'

export const workbenchSidebarTitleClass = 'truncate text-[14px] font-semibold text-text-primary'
export const workbenchSidebarDescriptionClass = 'mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-text-secondary/82'
export const workbenchSidebarPillClass = 'rounded-full bg-surface-3/85 px-2.5 py-1 text-[10px] text-text-muted'

export const workbenchHeroSectionClass =
  'rounded-4xl border border-border-subtle/60 bg-linear-to-br from-surface-1/99 via-surface-1/97 to-surface-2/92 p-6 shadow-[0_10px_24px_rgba(15,23,42,0.05)] xl:p-7'

export const workbenchDetailSectionClass =
  'rounded-[28px] border border-border-subtle/55 bg-linear-to-br from-surface-1/99 via-surface-1/97 to-surface-2/90 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)] xl:p-6'

export const workbenchSectionEyebrowClass =
  'font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45'

export const workbenchSectionTitleClass =
  'mt-2 text-[20px] font-semibold tracking-tight text-text-primary'

export const workbenchSectionDescriptionClass =
  'mt-1 text-[13px] leading-relaxed text-text-secondary/80'

export const workbenchDetailRowClass =
  'flex items-center justify-between gap-4 rounded-2xl border border-border-subtle/45 bg-surface-0/72 px-4 py-3 text-sm'

export const workbenchInfoCardClass =
  'rounded-2xl border border-border-subtle/55 bg-surface-1/88 px-4 py-3.5'

export const workbenchSummaryLabelClass =
  'text-[10px] uppercase tracking-[0.16em] text-text-muted/45'

export const workbenchSummaryValueClass = 'mt-2 text-lg font-semibold text-text-primary'
export const workbenchSummaryHintClass = 'mt-1 text-[11px] text-text-muted/70'

export const workbenchPrimaryButtonClass =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(var(--t-accent-rgb),0.22)] transition-all hover:bg-accent-hover'

export const workbenchAccentButtonClass =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-accent/20 bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/15'

export const workbenchSubtleButtonClass =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-border-subtle/55 bg-surface-0/72 px-4 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:border-accent/18 hover:bg-accent/8 hover:text-accent'

export const workbenchNeutralButtonClass =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-surface-2 px-4 py-2.5 text-sm font-semibold text-text-muted transition-colors hover:bg-surface-3 hover:text-text-secondary'

export const workbenchDangerButtonClass =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-red-500/18 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/16'

export function workbenchSummaryStatClass(accent = false) {
  return clsx(
    'rounded-3xl border px-4 py-3',
    accent ? 'border-accent/14 bg-accent/7' : 'border-border-subtle/55 bg-surface-0/72',
  )
}

export function workbenchSidebarItemClass(active: boolean, inactiveClassName?: string) {
  return clsx(
    'group flex w-full items-stretch! justify-start! rounded-[24px] border px-4 py-3.5 text-left transition-all duration-200',
    active
      ? 'border-accent/20 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--t-accent)_10%,var(--t-surface-1)),color-mix(in_srgb,var(--t-accent-secondary)_5%,var(--t-surface-2)))] text-text-primary shadow-[0_8px_20px_rgba(var(--t-accent-rgb),0.07)]'
      : inactiveClassName ?? 'border-transparent bg-surface-1/48 text-text-secondary hover:border-border/60 hover:bg-surface-2/78 hover:text-text-primary',
  )
}

export function workbenchSegmentButtonClass(active: boolean) {
  return clsx(
    'inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-[16px] px-3 py-2 text-center text-[12px] font-semibold transition-colors',
    active ? 'bg-accent/16 text-accent shadow-[inset_0_0_0_1px_rgba(var(--t-accent-rgb),0.18)]' : 'text-text-muted hover:bg-surface-3/60 hover:text-text-primary',
  )
}
