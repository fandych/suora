import clsx from 'clsx'
import type React from 'react'
import { Checkbox as ShadCheckbox } from '@/components/ui/checkbox'

export function CheckboxGroup({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="control"
      {...props}
      className={clsx(
        className,
        'space-y-3',
        'has-data-[slot=description]:space-y-6 has-data-[slot=description]:**:data-[slot=label]:font-medium',
      )}
    />
  )
}

export function CheckboxField({ className, ...props }: { className?: string } & React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="field"
      {...props}
      className={clsx(
        className,
        'grid grid-cols-[1.125rem_1fr] gap-x-4 gap-y-1 sm:grid-cols-[1rem_1fr]',
        '*:data-[slot=control]:col-start-1 *:data-[slot=control]:row-start-1 *:data-[slot=control]:mt-0.75 sm:*:data-[slot=control]:mt-1',
        '*:data-[slot=label]:col-start-2 *:data-[slot=label]:row-start-1',
        '*:data-[slot=description]:col-start-2 *:data-[slot=description]:row-start-2',
        'has-data-[slot=description]:**:data-[slot=label]:font-medium',
      )}
    />
  )
}

export function Checkbox({
  className,
  onChange,
  ...props
}: {
  color?: string
  className?: string
  onChange?: (checked: boolean) => void
} & Omit<React.ComponentProps<typeof ShadCheckbox>, 'onCheckedChange' | 'onChange'>) {
  return (
    <ShadCheckbox
      {...props}
      onCheckedChange={onChange}
      className={clsx('data-checked:bg-accent data-checked:border-accent', className)}
    />
  )
}
