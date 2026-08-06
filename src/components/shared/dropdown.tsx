import clsx from 'clsx'
import type React from 'react'
import { Menu } from '@base-ui/react/menu'

function parseAnchor(anchor: string) {
  const [side, align] = anchor.split(' ')
  return {
    side: side === 'top' ? 'top' : 'bottom',
    align: align === 'start' || align === 'end' ? align : 'center',
  } as const
}

export function Dropdown(props: React.ComponentProps<typeof Menu.Root>) {
  return <Menu.Root {...props} />
}

export function DropdownButton({
  as: _as,
  className,
  children,
  ...props
}: { className?: string; as?: React.ElementType } & Omit<React.ComponentProps<typeof Menu.Trigger>, 'render'>) {
  return (
    <Menu.Trigger {...props} className={className}>
      {children}
    </Menu.Trigger>
  )
}

export function DropdownMenu({
  anchor = 'bottom',
  className,
  children,
  ...props
}: {
  className?: string
  anchor?: string
  children?: React.ReactNode
} & Omit<React.ComponentProps<typeof Menu.Popup>, 'children'>) {
  const { side, align } = parseAnchor(anchor)

  return (
    <Menu.Portal>
      <Menu.Positioner side={side} align={align} sideOffset={8} className="z-110">
        <Menu.Popup
          {...props}
          className={clsx(
            className,
            'isolate w-max rounded-xl p-1 outline outline-transparent overflow-y-auto bg-surface-2/95 backdrop-blur-xl shadow-xl ring-1 ring-border-subtle',
            'supports-[grid-template-columns:subgrid]:grid supports-[grid-template-columns:subgrid]:grid-cols-[auto_1fr_1.5rem_0.5rem_auto]',
            'data-[ending-style]:opacity-0 transition-opacity',
          )}
        >
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}

export function DropdownItem({ className, children, ...props }: { className?: string } & React.ComponentProps<typeof Menu.Item>) {
  return (
    <Menu.Item
      {...props}
      className={clsx(
        className,
        'group cursor-default rounded-lg px-3.5 py-2.5 text-left text-base/6 text-text-primary focus:outline-hidden sm:px-3 sm:py-1.5 sm:text-sm/6',
        'data-[highlighted]:bg-accent/15 data-[highlighted]:text-accent data-[disabled]:opacity-50',
        'col-span-full grid grid-cols-[auto_1fr_1.5rem_0.5rem_auto] items-center supports-[grid-template-columns:subgrid]:grid-cols-subgrid',
        '*:data-[slot=icon]:col-start-1 *:data-[slot=icon]:row-start-1 *:data-[slot=icon]:mr-2.5 *:data-[slot=icon]:-ml-0.5 *:data-[slot=icon]:size-5 sm:*:data-[slot=icon]:mr-2 sm:*:data-[slot=icon]:size-4',
        '*:data-[slot=icon]:text-text-muted data-[highlighted]:*:data-[slot=icon]:text-accent',
      )}
    >
      {children}
    </Menu.Item>
  )
}

export function DropdownHeader({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={clsx('col-span-5 px-3.5 pt-2.5 pb-1 sm:px-3', className)} />
}

export function DropdownSection({ className, ...props }: React.ComponentProps<typeof Menu.Group>) {
  return <Menu.Group {...props} className={clsx('col-span-full supports-[grid-template-columns:subgrid]:grid supports-[grid-template-columns:subgrid]:grid-cols-[auto_1fr_1.5rem_0.5rem_auto]', className)} />
}

export function DropdownHeading({ className, ...props }: React.ComponentProps<typeof Menu.GroupLabel>) {
  return <Menu.GroupLabel {...props} className={clsx('col-span-full grid grid-cols-[1fr_auto] gap-x-12 px-3.5 pt-2 pb-1 text-sm/5 font-medium text-text-muted sm:px-3 sm:text-xs/5', className)} />
}

export function DropdownDivider({ className, ...props }: React.ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator {...props} className={clsx('col-span-full mx-3.5 my-1 h-px border-0 bg-border-subtle sm:mx-3', className)} />
}

export function DropdownLabel({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} data-slot="label" className={clsx('col-start-2 row-start-1', className)} />
}

export function DropdownDescription({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} data-slot="description" className={clsx('col-span-2 col-start-2 row-start-2 text-sm/5 text-text-muted data-[highlighted]:text-accent sm:text-xs/5', className)} />
}

export function DropdownShortcut({ keys, className, ...props }: { keys: string | string[]; className?: string } & React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div {...props} className={clsx('col-start-5 row-start-1 flex justify-self-end', className)}>
      {(Array.isArray(keys) ? keys : keys.split('')).map((char, index) => (
        <kbd
          key={index}
          className={clsx(
            'min-w-[2ch] text-center font-sans text-text-muted capitalize',
            index > 0 && char.length > 1 && 'pl-1',
          )}
        >
          {char}
        </kbd>
      ))}
    </div>
  )
}
