import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import React, { forwardRef } from 'react'

const sizeStyles = {
  md: {
    single: 'pr-[calc(--spacing(10)-1px)] pl-[calc(--spacing(3.5)-1px)] sm:pr-[calc(--spacing(9)-1px)] sm:pl-[calc(--spacing(3)-1px)] py-[calc(--spacing(2.5)-1px)] sm:py-[calc(--spacing(1.5)-1px)] text-base/6 sm:text-sm/6',
    multiple: 'px-[calc(--spacing(3.5)-1px)] sm:px-[calc(--spacing(3)-1px)] py-[calc(--spacing(2.5)-1px)] sm:py-[calc(--spacing(1.5)-1px)] text-base/6 sm:text-sm/6',
  },
  sm: {
    single: 'pr-9 pl-2.5 py-2 text-[12.5px] font-medium sm:pr-9 sm:pl-2.5 sm:py-2 sm:text-[12.5px]',
    multiple: 'px-2.5 py-2 text-[12.5px] font-medium sm:px-2.5 sm:py-2 sm:text-[12.5px]',
  },
} as const

type SelectSize = keyof typeof sizeStyles

function hasCustomAppearanceClasses(value?: string) {
  if (!value) return false
  return /(bg-|border|rounded|px-|py-|pl-|pr-|pt-|pb-|text-|placeholder:|font-|shadow|ring-|outline-|resize-|accent-)/.test(value)
}

type NativeSelectProps = Omit<React.ComponentPropsWithoutRef<'select'>, 'size'> & {
  size?: SelectSize
  invalid?: boolean
  wrapperClassName?: string
  controlClassName?: string
}

export const Select = forwardRef(function Select(
  { className, wrapperClassName, controlClassName, multiple, size = 'md', invalid, ...props }: NativeSelectProps,
  ref: React.ForwardedRef<HTMLSelectElement>
) {
  const hasCustomControlAppearance = Boolean(controlClassName) || hasCustomAppearanceClasses(className)

  return (
    <span
      data-slot="control"
      className={clsx([
        wrapperClassName,
        // Basic layout
        'group relative block w-full',
        !hasCustomControlAppearance && [
          // Background color + shadow applied to inset pseudo element, so shadow blends with border in light mode
          'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-surface-0 before:shadow-sm',
          // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo
          'dark:before:hidden',
        ],
        // Focus ring
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset has-data-focus:after:ring-2 has-data-focus:after:ring-accent/35',
        // Disabled state
        'has-data-disabled:opacity-50 has-data-disabled:before:bg-zinc-950/5 has-data-disabled:before:shadow-none',
      ])}
    >
      <Headless.Select
        ref={ref}
        multiple={multiple}
        {...props}
        className={clsx([
          // Basic layout
          'relative block w-full appearance-none',
          !hasCustomControlAppearance && 'rounded-lg',
          !hasCustomControlAppearance && (multiple ? sizeStyles[size].multiple : sizeStyles[size].single),
          // Options (multi-select)
          '[&_optgroup]:font-semibold',
          // Typography
          !hasCustomControlAppearance && 'text-text-primary placeholder:text-text-muted/60 *:text-text-primary',
          // Border
          !hasCustomControlAppearance && 'border border-border-subtle/70 data-hover:border-border/80',
          // Background color
          !hasCustomControlAppearance && 'bg-surface-1/72 *:bg-surface-1',
          // Hide default focus styles
          'focus:outline-hidden',
          // Invalid state
          invalid && 'data-invalid',
          !hasCustomControlAppearance && 'data-invalid:border-red-500 data-invalid:data-hover:border-red-500 dark:data-invalid:border-red-600 dark:data-invalid:data-hover:border-red-600',
          // Disabled state
          !hasCustomControlAppearance && 'data-disabled:border-zinc-950/20 data-disabled:opacity-100 dark:data-disabled:border-white/15 dark:data-disabled:bg-white/2.5 dark:data-hover:data-disabled:border-white/15',
          className,
          controlClassName,
        ])}
      />
      {!multiple && (
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <svg
            className="size-5 stroke-text-muted group-has-data-disabled:stroke-text-muted/60 sm:size-4 forced-colors:stroke-[CanvasText]"
            viewBox="0 0 16 16"
            aria-hidden="true"
            fill="none"
          >
            <path d="M5.75 10.75L8 13L10.25 10.75" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10.25 5.25L8 3L5.75 5.25" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </span>
  )
})
