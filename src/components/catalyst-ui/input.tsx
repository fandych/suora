import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import React, { forwardRef } from 'react'

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

type InputSize = keyof typeof sizeStyles

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
        '*:data-[slot=icon]:text-zinc-500 dark:*:data-[slot=icon]:text-zinc-400'
      )}
    >
      {children}
    </span>
  )
}

const dateTypes = ['date', 'datetime-local', 'month', 'time', 'week']
type DateType = (typeof dateTypes)[number]

type NativeInputProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'size'> & {
  size?: InputSize
  invalid?: boolean
  type?: React.ComponentPropsWithoutRef<'input'>['type'] | DateType
  wrapperClassName?: string
  controlClassName?: string
}

export const Input = forwardRef(function Input(
  {
    className,
    wrapperClassName,
    controlClassName,
    size = 'md',
    invalid,
    ...props
  }: NativeInputProps,
  ref: React.ForwardedRef<HTMLInputElement>
) {
  const hasCustomControlAppearance = Boolean(controlClassName) || hasCustomAppearanceClasses(className)

  if (props.type && nativeInputTypes.has(props.type)) {
    return <input ref={ref} {...props} className={clsx(className, wrapperClassName, controlClassName)} />
  }

  return (
    <span
      data-slot="control"
      className={clsx([
        wrapperClassName,
        // Basic layout
        'relative block w-full',
        !hasCustomControlAppearance && [
          // Background color + shadow applied to inset pseudo element, so shadow blends with border in light mode
          'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-surface-0 before:shadow-sm',
          // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo
          'dark:before:hidden',
        ],
        // Focus ring
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-accent/35',
        // Disabled state
        'has-data-disabled:opacity-50 has-data-disabled:before:bg-zinc-950/5 has-data-disabled:before:shadow-none',
      ])}
    >
      <Headless.Input
        ref={ref}
        {...(props as Omit<NativeInputProps, 'size' | 'invalid'>)}
        className={clsx([
          // Date classes
          props.type &&
            dateTypes.includes(props.type) && [
              '[&::-webkit-datetime-edit-fields-wrapper]:p-0',
              '[&::-webkit-date-and-time-value]:min-h-[1.5em]',
              '[&::-webkit-datetime-edit]:inline-flex',
              '[&::-webkit-datetime-edit]:p-0',
              '[&::-webkit-datetime-edit-year-field]:p-0',
              '[&::-webkit-datetime-edit-month-field]:p-0',
              '[&::-webkit-datetime-edit-day-field]:p-0',
              '[&::-webkit-datetime-edit-hour-field]:p-0',
              '[&::-webkit-datetime-edit-minute-field]:p-0',
              '[&::-webkit-datetime-edit-second-field]:p-0',
              '[&::-webkit-datetime-edit-millisecond-field]:p-0',
              '[&::-webkit-datetime-edit-meridiem-field]:p-0',
            ],
          // Basic layout
          'relative block w-full appearance-none',
          !hasCustomControlAppearance && 'rounded-lg',
          !hasCustomControlAppearance && sizeStyles[size],
          // Typography
          !hasCustomControlAppearance && 'text-text-primary placeholder:text-text-muted/60',
          // Border
          !hasCustomControlAppearance && 'border border-border-subtle/70 data-hover:border-border/80',
          // Background color
          !hasCustomControlAppearance && 'bg-surface-1/72',
          // Hide default focus styles
          'focus:outline-hidden',
          // Invalid state
          invalid && 'data-invalid',
          !hasCustomControlAppearance && 'data-invalid:border-red-500 data-invalid:data-hover:border-red-500 dark:data-invalid:border-red-600 dark:data-invalid:data-hover:border-red-600',
          // Disabled state
          !hasCustomControlAppearance && 'data-disabled:border-zinc-950/20 dark:data-disabled:border-white/15 dark:data-disabled:bg-white/2.5 dark:data-hover:data-disabled:border-white/15',
          // System icons
          !hasCustomControlAppearance && 'scheme-dark',
          className,
          controlClassName,
        ])}
      />
    </span>
  )
})
