import clsx from 'clsx'
import type React from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'

const sizes = {
  xs: 'sm:max-w-xs',
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
  '5xl': 'sm:max-w-5xl',
} as const

type CloseHandler = ((open: boolean) => void) | (() => void)

function handleClose(onClose?: CloseHandler) {
  if (!onClose) return
  ;(onClose as (open: boolean) => void)(false)
}

export function Alert({
  size = 'md',
  className,
  children,
  open,
  onClose,
}: {
  open: boolean
  onClose?: CloseHandler
  size?: keyof typeof sizes
  className?: string
  children: React.ReactNode
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose(onClose)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-120 bg-zinc-950/15 backdrop-blur-xs data-ending-style:opacity-0" />
        <div className="fixed inset-0 z-120 grid min-h-full grid-rows-[1fr_auto_1fr] justify-items-center p-8 sm:grid-rows-[1fr_auto_3fr] sm:p-4">
          <AlertDialog.Popup className={clsx(sizes[size], 'relative z-[120] row-start-2 w-full rounded-2xl bg-surface-1 p-8 text-text-primary shadow-lg ring-1 ring-border-subtle sm:p-6', className)}>
            {children}
          </AlertDialog.Popup>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

export function AlertTitle({ className, ...props }: React.ComponentProps<typeof AlertDialog.Title>) {
  return <AlertDialog.Title {...props} className={clsx('text-center text-base/6 font-semibold text-balance text-text-primary sm:text-left sm:text-sm/6 sm:text-wrap', className)} />
}

export function AlertDescription({ className, ...props }: React.ComponentProps<typeof AlertDialog.Description>) {
  return <AlertDialog.Description {...props} className={clsx('mt-2 text-center text-pretty text-text-secondary sm:text-left', className)} />
}

export function AlertBody({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={clsx('mt-4', className)} />
}

export function AlertActions({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={clsx('mt-6 flex flex-col-reverse items-center justify-end gap-3 *:w-full sm:mt-4 sm:flex-row sm:*:w-auto', className)} />
}
