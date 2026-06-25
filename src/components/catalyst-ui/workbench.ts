import clsx from 'clsx'

export const workbenchSidebarCardClass =
  'rounded-3xl border border-border-subtle/55 bg-surface-0/48 p-3.5 shadow-[0_12px_28px_rgba(15,23,42,0.05)]'

export const workbenchSidebarEmptyClass =
  'rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center'

export const workbenchSidebarSearchInputClass =
  'min-h-10 w-full rounded-2xl border border-border-subtle/55 bg-surface-2/82 py-2.5 pl-10 pr-10 text-[13px] leading-5 text-text-primary placeholder:text-text-muted/55'

export const workbenchSidebarMetaClass =
  'mt-2 flex items-center justify-between text-[11px] text-text-muted/72'

export const workbenchSidebarPrimaryActionClass =
  'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-accent-hover'

export const workbenchSidebarAccentActionClass =
  'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl bg-accent/12 px-3.5 py-2 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/20'

export const workbenchSidebarSubtleActionClass =
  'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-border-subtle/60 bg-surface-0/72 px-3.5 py-2 text-[12px] font-semibold text-text-secondary transition-colors hover:border-accent/18 hover:bg-accent/8 hover:text-accent'

export const workbenchSidebarIconClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border-subtle/45 bg-surface-0/78 text-accent shadow-sm'

export const workbenchSidebarTitleClass = 'truncate text-[14px] font-semibold text-text-primary'
export const workbenchSidebarDescriptionClass = 'mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-text-secondary/82'
export const workbenchSidebarPillClass = 'rounded-full bg-surface-3/85 px-2.5 py-1 text-[10px] text-text-muted'

export const workbenchHeroSectionClass =
  'rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7'

export const workbenchDetailSectionClass =
  'rounded-[28px] border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)] xl:p-6'

export const workbenchSectionEyebrowClass =
  'font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45'

export const workbenchSectionTitleClass =
  'mt-2 text-[20px] font-semibold tracking-tight text-text-primary'

export const workbenchSectionDescriptionClass =
  'mt-1 text-[13px] leading-relaxed text-text-secondary/80'

export const workbenchDetailRowClass =
  'flex items-center justify-between gap-4 rounded-2xl border border-border-subtle/45 bg-surface-0/55 px-4 py-3 text-sm'

export const workbenchInfoCardClass =
  'rounded-2xl border border-border-subtle/55 bg-surface-1/72 px-4 py-3.5'

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
    accent ? 'border-accent/18 bg-accent/10' : 'border-border-subtle/55 bg-surface-0/60',
  )
}

export function workbenchSidebarItemClass(active: boolean, inactiveClassName?: string) {
  return clsx(
    'group flex w-full items-stretch! justify-start! rounded-3xl border px-4 py-3.5 text-left transition-all duration-200',
    active
      ? 'border-accent/20 bg-accent/10 text-text-primary shadow-[0_14px_34px_rgba(var(--t-accent-rgb),0.07)]'
      : inactiveClassName ?? 'border-transparent bg-surface-1/20 text-text-secondary hover:border-border-subtle/60 hover:bg-surface-3/55 hover:text-text-primary',
  )
}

export function workbenchSegmentButtonClass(active: boolean) {
  return clsx(
    'inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-center text-[12px] font-semibold transition-colors',
    active ? 'bg-accent/15 text-accent' : 'text-text-muted hover:bg-surface-3/60 hover:text-text-primary',
  )
}