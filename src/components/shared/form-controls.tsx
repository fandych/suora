import clsx from 'clsx'
import React, { forwardRef } from 'react'
import { Input as ShadInput } from '@/components/ui/input'
import { Textarea as ShadTextarea } from '@/components/ui/textarea'

const nativeInputTypes = new Set([
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])

const sizeStyles = {
  md: 'px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)] text-base/6 sm:text-sm/6',
  sm: 'px-2.5 py-2 text-[12.5px] font-medium sm:px-2.5 sm:py-2 sm:text-[12.5px]',
} as const

type ControlSize = keyof typeof sizeStyles

function hasCustomAppearanceClasses(value?: string) {
  if (!value) return false
  return /(bg-|border|rounded|px-|py-|pl-|pr-|pt-|pb-|text-|placeholder:|font-|shadow|ring-|outline-|resize-|accent-)/.test(value)
}

export function InputGroup({ children }: React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      data-slot="control"
      className={clsx(
        'relative isolate block',
        'has-[[data-slot=icon]:first-child]:[&_input]:pl-10 has-[[data-slot=icon]:last-child]:[&_input]:pr-10 sm:has-[[data-slot=icon]:first-child]:[&_input]:pl-8 sm:has-[[data-slot=icon]:last-child]:[&_input]:pr-8',
        '*:data-[slot=icon]:pointer-events-none *:data-[slot=icon]:absolute *:data-[slot=icon]:top-3 *:data-[slot=icon]:z-10 *:data-[slot=icon]:size-5 sm:*:data-[slot=icon]:top-2.5 sm:*:data-[slot=icon]:size-4',
        '[&>[data-slot=icon]:first-child]:left-3 sm:[&>[data-slot=icon]:first-child]:left-2.5 [&>[data-slot=icon]:last-child]:right-3 sm:[&>[data-slot=icon]:last-child]:right-2.5',
        '*:data-[slot=icon]:text-zinc-500 dark:*:data-[slot=icon]:text-zinc-400',
      )}
    >
      {children}
    </span>
  )
}

type NativeInputProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'size'> & {
  size?: ControlSize
  invalid?: boolean
  wrapperClassName?: string
  controlClassName?: string
}

export const Input = forwardRef(function Input(
  { className, wrapperClassName, controlClassName, size = 'md', invalid, ...props }: NativeInputProps,
  ref: React.ForwardedRef<HTMLInputElement>,
) {
  const hasCustomControlAppearance = Boolean(controlClassName) || hasCustomAppearanceClasses(className)

  if (props.type && nativeInputTypes.has(props.type)) {
    return <input ref={ref} {...props} className={clsx(className, wrapperClassName, controlClassName)} />
  }

  return (
    <span
      data-slot="control"
      className={clsx(
        wrapperClassName,
        'relative block w-full',
        !hasCustomControlAppearance && [
          'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-surface-0 before:shadow-sm',
          'dark:before:hidden',
        ],
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-accent/35',
        'has-data-disabled:opacity-50 has-data-disabled:before:bg-zinc-950/5 has-data-disabled:before:shadow-none',
      )}
    >
      <ShadInput
        ref={ref}
        {...props}
        aria-invalid={invalid || undefined}
        className={clsx(
          'relative block w-full appearance-none',
          !hasCustomControlAppearance && 'rounded-lg',
          !hasCustomControlAppearance && sizeStyles[size],
          !hasCustomControlAppearance && 'text-text-primary placeholder:text-text-muted/60 border-border-subtle/70 bg-surface-1/72',
          'focus-visible:ring-accent/35',
          className,
          controlClassName,
        )}
      />
    </span>
  )
})

type NativeTextareaProps = React.ComponentPropsWithoutRef<'textarea'> & {
  resizable?: boolean
  size?: ControlSize
  invalid?: boolean
  ghost?: boolean
  wrapperClassName?: string
  controlClassName?: string
}

const ghostStyles =
  'bg-transparent border-0 text-text-primary placeholder-text-muted/40 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-35 resize-none text-[15px] leading-relaxed'

export const TextArea = forwardRef(function TextArea(
  { className, wrapperClassName, controlClassName, resizable = true, size = 'md', invalid, ghost = false, ...props }: NativeTextareaProps,
  ref: React.ForwardedRef<HTMLTextAreaElement>,
) {
  const hasCustomControlAppearance = Boolean(controlClassName) || hasCustomAppearanceClasses(className)

  if (ghost) {
    return <textarea ref={ref} {...props} className={clsx(ghostStyles, className, wrapperClassName, controlClassName)} />
  }

  return (
    <span
      data-slot="control"
      className={clsx(
        wrapperClassName,
        'relative block w-full',
        !hasCustomControlAppearance && [
          'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-surface-0 before:shadow-sm',
          'dark:before:hidden',
        ],
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-accent/35',
        'has-data-disabled:opacity-50 has-data-disabled:before:bg-zinc-950/5 has-data-disabled:before:shadow-none',
      )}
    >
      <ShadTextarea
        ref={ref}
        {...props}
        aria-invalid={invalid || undefined}
        className={clsx(
          'relative block h-full w-full appearance-none',
          !hasCustomControlAppearance && 'rounded-lg',
          !hasCustomControlAppearance && sizeStyles[size],
          !hasCustomControlAppearance && 'text-text-primary placeholder:text-text-muted/60 border-border-subtle/70 bg-surface-1/72',
          resizable ? 'resize-y' : 'resize-none',
          className,
          controlClassName,
        )}
      />
    </span>
  )
})

type NativeSelectProps = Omit<React.ComponentPropsWithoutRef<'select'>, 'size'> & {
  size?: ControlSize
  invalid?: boolean
  wrapperClassName?: string
  controlClassName?: string
}

export const Select = forwardRef(function Select(
  { className, wrapperClassName, controlClassName, multiple, size = 'md', invalid, children, ...props }: NativeSelectProps,
  ref: React.ForwardedRef<HTMLSelectElement>,
) {
  const hasCustomControlAppearance = Boolean(controlClassName) || hasCustomAppearanceClasses(className)

  return (
    <span
      data-slot="control"
      className={clsx(
        wrapperClassName,
        'group relative block w-full',
        !hasCustomControlAppearance && [
          'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-surface-0 before:shadow-sm',
          'dark:before:hidden',
        ],
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset has-[:focus-visible]:after:ring-2 has-[:focus-visible]:after:ring-accent/35',
        'has-[:disabled]:opacity-50 has-[:disabled]:before:bg-zinc-950/5 has-[:disabled]:before:shadow-none',
      )}
    >
      <select
        ref={ref}
        {...props}
        multiple={multiple}
        aria-invalid={invalid || undefined}
        className={clsx(
          'relative block w-full appearance-none',
          !hasCustomControlAppearance && 'rounded-lg',
          !hasCustomControlAppearance && (multiple ? sizeStyles[size] : `pr-[calc(--spacing(10)-1px)] ${sizeStyles[size]}`),
          !hasCustomControlAppearance && 'text-text-primary border border-border-subtle/70 bg-surface-1/72 focus:outline-none',
          !hasCustomControlAppearance && 'disabled:border-zinc-950/20 dark:disabled:border-white/15 dark:disabled:bg-white/2.5',
          className,
          controlClassName,
        )}
      >
        {children}
      </select>
      {!multiple && (
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <svg className="size-5 stroke-text-muted sm:size-4" viewBox="0 0 16 16" aria-hidden="true" fill="none">
            <path d="M5.75 10.75L8 13L10.25 10.75" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10.25 5.25L8 3L5.75 5.25" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </span>
  )
})
