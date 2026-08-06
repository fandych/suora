import clsx from 'clsx'
import type React from 'react'
import { Switch as ShadSwitch } from '@/components/ui/switch'

export function SwitchGroup({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="control"
      {...props}
      className={clsx(
        className,
        'space-y-3 **:data-[slot=label]:font-normal',
        'has-data-[slot=description]:space-y-6 has-data-[slot=description]:**:data-[slot=label]:font-medium',
      )}
    />
  )
}

export function SwitchField({ className, ...props }: { className?: string } & React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="field"
      {...props}
      className={clsx(
        className,
        'grid grid-cols-[1fr_auto] gap-x-8 gap-y-1 sm:grid-cols-[1fr_auto]',
        '*:data-[slot=control]:col-start-2 *:data-[slot=control]:self-start sm:*:data-[slot=control]:mt-0.5',
        '*:data-[slot=label]:col-start-1 *:data-[slot=label]:row-start-1',
        '*:data-[slot=description]:col-start-1 *:data-[slot=description]:row-start-2',
        'has-data-[slot=description]:**:data-[slot=label]:font-medium',
      )}
    />
  )
}

export function Switch({
  className,
  onChange,
  ...props
}: {
  color?: string
  className?: string
  onChange?: (checked: boolean) => void
} & Omit<React.ComponentProps<typeof ShadSwitch>, 'onCheckedChange' | 'onChange'>) {
  return <ShadSwitch {...props} onCheckedChange={onChange} className={clsx('data-checked:bg-accent', className)} />
}
