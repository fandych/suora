import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import React, { forwardRef } from 'react'

const sizeStyles = {
  md: 'px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)] text-base/6 sm:text-sm/6',
  sm: 'px-2.5 py-2 text-[12.5px] font-medium sm:px-2.5 sm:py-2 sm:text-[12.5px]',
} as const

type TextareaSize = keyof typeof sizeStyles

const ghostStyles =
  'bg-transparent border-0 text-text-primary placeholder-text-muted/40 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-35 resize-none text-[15px] leading-relaxed'

type NativeTextareaProps = React.ComponentPropsWithoutRef<'textarea'> & {
  resizable?: boolean
  size?: TextareaSize
  invalid?: boolean
  ghost?: boolean
}

export const Textarea = forwardRef(function Textarea(
  {
    className,
    resizable = true,
    size = 'md',
    invalid,
    ghost = false,
    ...props
  }: NativeTextareaProps,
  ref: React.ForwardedRef<HTMLTextAreaElement>
) {
  if (ghost) {
    return <textarea ref={ref} {...props} className={clsx(ghostStyles, className)} />
  }

  return (
    <span
      data-slot="control"
      className={clsx([
        className,
        // Basic layout
        'relative block w-full',
        // Background color + shadow applied to inset pseudo element, so shadow blends with border in light mode
        'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm',
        // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo
        'dark:before:hidden',
        // Focus ring
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500',
        // Disabled state
        'has-data-disabled:opacity-50 has-data-disabled:before:bg-zinc-950/5 has-data-disabled:before:shadow-none',
      ])}
    >
      <Headless.Textarea
        ref={ref}
        {...props}
        className={clsx([
          // Basic layout
          'relative block h-full w-full appearance-none rounded-lg',
          sizeStyles[size],
          // Typography
          'text-zinc-950 placeholder:text-zinc-500 dark:text-white',
          // Border
          'border border-zinc-950/10 data-hover:border-zinc-950/20 dark:border-white/10 dark:data-hover:border-white/20',
          // Background color
          'bg-transparent dark:bg-white/5',
          // Hide default focus styles
          'focus:outline-hidden',
          // Invalid state
          invalid && 'data-invalid',
          'data-invalid:border-red-500 data-invalid:data-hover:border-red-500 dark:data-invalid:border-red-600 dark:data-invalid:data-hover:border-red-600',
          // Disabled state
          'disabled:border-zinc-950/20 dark:disabled:border-white/15 dark:disabled:bg-white/2.5 dark:data-hover:disabled:border-white/15',
          // Resizable
          resizable ? 'resize-y' : 'resize-none',
        ])}
      />
    </span>
  )
})
