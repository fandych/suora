// Unified form controls — Input / Select / TextArea.
//
// Goal: every native input/select/textarea in the app shares the same visual
// language (surface, border, focus ring, disabled state). Components are
// drop-in replacements for the native elements: they forward refs and accept
// every native prop, plus an optional `size` variant and an `invalid` flag.
//
// Two size variants:
//   - 'md' (default): used in settings forms, editors, dialogs.
//   - 'sm':           used in inline toolbars (e.g. chat top bar).
//
// Custom `className` is appended last so callers can override layout
// (`flex-1`, `w-full`, etc.) without losing the shared styling.

import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

export type ControlSize = 'sm' | 'md'

const SIZE_BASE: Record<ControlSize, string> = {
  md: 'rounded-md px-3 py-2.5 text-sm',
  sm: 'rounded-md px-2.5 py-2 text-[12.5px] font-medium',
}

const SHARED =
  'border bg-surface-1 text-text-primary placeholder-text-muted/55 transition-colors ' +
  'focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/25 ' +
  'hover:border-border disabled:cursor-not-allowed disabled:opacity-50'

const SHARED_SM_TONE = 'bg-surface-1 text-text-secondary'

function controlClass(size: ControlSize, invalid: boolean | undefined, extra: string | undefined) {
  const tone = size === 'sm' ? SHARED_SM_TONE : ''
  const border = invalid
    ? 'border-danger/60 focus:border-danger/70 focus:ring-danger/25'
    : 'border-border-subtle/55'
  return [SHARED, border, tone, SIZE_BASE[size], extra].filter(Boolean).join(' ')
}

// ─── Input ─────────────────────────────────────────────────────────

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: ControlSize
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', invalid, className, ...rest },
  ref,
) {
  return (
    <input ref={ref} className={controlClass(size, invalid, className)} {...rest} />
  )
})

// ─── Select ────────────────────────────────────────────────────────
//
// Uses appearance-none + a CSS-painted chevron so the dropdown arrow looks
// the same on every platform / theme.

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: ControlSize
  invalid?: boolean
}

const SELECT_CHEVRON =
  "appearance-none bg-no-repeat bg-[right_0.85rem_center] bg-[length:12px_12px] pr-9 " +
  "bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238D8D9E' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")]"

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { size = 'md', invalid, className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={`${SELECT_CHEVRON} ${controlClass(size, invalid, className)}`}
      {...rest}
    >
      {children}
    </select>
  )
})

// ─── TextArea ──────────────────────────────────────────────────────

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  size?: ControlSize
  invalid?: boolean
  /** When true, removes the default chrome (border, surface, padding) so the
   *  textarea can be embedded in a custom-styled container (e.g. chat input
   *  composer) while still inheriting font, color and placeholder treatment. */
  ghost?: boolean
}

const TEXTAREA_GHOST =
  'bg-transparent border-0 text-text-primary placeholder-text-muted/40 ' +
  'focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-35 ' +
  'resize-none text-[15px] leading-relaxed'

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { size = 'md', invalid, ghost, className, ...rest },
  ref,
) {
  if (ghost) {
    return <textarea ref={ref} className={[TEXTAREA_GHOST, className].filter(Boolean).join(' ')} {...rest} />
  }
  return (
    <textarea
      ref={ref}
      className={`${controlClass(size, invalid, className)} resize-y leading-6 min-h-24`}
      {...rest}
    />
  )
})
