import clsx from 'clsx'
import type React from 'react'
import {
  Dialog as DialogRoot,
  DialogContent,
  DialogDescription as DialogPrimitiveDescription,
  DialogTitle as DialogPrimitiveTitle,
} from '@/components/ui/dialog'

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

export function Dialog({
  size = 'lg',
  className,
  backdropClassName: _backdropClassName,
  children,
  open,
  onClose,
}: {
  open: boolean
  onClose?: CloseHandler
  size?: keyof typeof sizes
  className?: string
  backdropClassName?: string
  children: React.ReactNode
}) {
  return (
    <DialogRoot open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose(onClose)}>
      <DialogContent showCloseButton={false} className={clsx(sizes[size], 'bg-surface-1 text-text-primary border-border-subtle/70', className)}>
        {children}
      </DialogContent>
    </DialogRoot>
  )
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitiveTitle>) {
  return <DialogPrimitiveTitle {...props} className={clsx('text-lg/6 font-semibold text-balance text-text-primary sm:text-base/6', className)} />
}

export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitiveDescription>) {
  return <DialogPrimitiveDescription {...props} className={clsx('mt-2 text-pretty text-text-secondary', className)} />
}

export function DialogBody({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={clsx('mt-6', className)} />
}

export function DialogActions({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={clsx('mt-8 flex flex-col-reverse items-center justify-end gap-3 *:w-full sm:flex-row sm:*:w-auto', className)} />
}
