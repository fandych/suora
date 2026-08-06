import clsx from 'clsx'
import React, { forwardRef } from 'react'
import { Button as ShadButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type LegacyColor =
  | 'accent'
  | 'blue'
  | 'red'
  | 'green'
  | 'emerald'
  | 'warning'
  | 'orange'
  | 'amber'
  | 'zinc'
  | 'dark/zinc'
  | 'light'
  | 'white'
  | 'dark'
  | 'dark/white'

type CommonButtonProps = {
  className?: string
  children: React.ReactNode
  variant?: ButtonVariant
  color?: LegacyColor
  outline?: boolean
  plain?: boolean
  unstyled?: boolean
}

type ButtonLinkProps = CommonButtonProps & {
  href: string
} & Omit<React.ComponentPropsWithoutRef<'a'>, 'color' | 'href'>

type ButtonNativeProps = CommonButtonProps & {
  href?: never
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'>

type ButtonProps = ButtonLinkProps | ButtonNativeProps

const Anchor = forwardRef<HTMLAnchorElement, React.ComponentPropsWithoutRef<'a'>>(
  function Anchor(props, ref) {
    return <a {...props} ref={ref} />
  },
)

function resolveVariant({
  variant,
  color,
  outline,
  plain,
}: Pick<ButtonProps, 'variant' | 'color' | 'outline' | 'plain'>): React.ComponentProps<typeof ShadButton>['variant'] {
  if (variant === 'secondary' || outline) return 'outline'
  if (variant === 'ghost' || plain) return 'ghost'
  if (variant === 'danger' || color === 'red') return 'destructive'
  return 'default'
}

function resolveToneClass(color: LegacyColor | undefined) {
  switch (color) {
    case 'blue':
    case 'accent':
      return 'bg-accent text-white hover:bg-accent-hover border-accent/20'
    case 'green':
    case 'emerald':
      return 'bg-emerald-600 text-white hover:bg-emerald-500 border-emerald-500/30'
    case 'warning':
    case 'orange':
    case 'amber':
      return 'bg-amber-500 text-amber-950 hover:bg-amber-400 border-amber-400/30'
    case 'zinc':
    case 'dark/zinc':
    case 'dark':
      return 'bg-surface-3 text-text-primary hover:bg-surface-4 border-border'
    case 'light':
    case 'white':
    case 'dark/white':
      return 'bg-surface-1 text-text-primary hover:bg-surface-2 border-border-subtle'
    default:
      return null
  }
}

export const Button = forwardRef<HTMLElement, ButtonProps>(function Button(props, ref) {
  const {
    color,
    outline,
    plain,
    variant,
    unstyled = false,
    className,
    children,
  } = props
  const isLink = 'href' in props && typeof props.href === 'string'

  if (unstyled) {
    const unstyledClasses = clsx(
      className,
      'relative isolate inline-flex items-center justify-center gap-x-2 transition-colors',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      'disabled:opacity-50',
    )

    if (isLink) {
      const { href, ...linkProps } = props as ButtonLinkProps
      return (
        <Anchor {...linkProps} href={href} className={unstyledClasses} ref={ref as React.ForwardedRef<HTMLAnchorElement>}>
          <TouchTarget>{children}</TouchTarget>
        </Anchor>
      )
    }

    const { type, ...buttonProps } = props as ButtonNativeProps
    return (
      <button {...buttonProps} type={type ?? 'button'} className={unstyledClasses} ref={ref as React.ForwardedRef<HTMLButtonElement>}>
        <TouchTarget>{children}</TouchTarget>
      </button>
    )
  }

  const shadVariant = resolveVariant({ variant, color, outline, plain })
  const toneClass = resolveToneClass(color)
  const sharedClassName = cn(toneClass, className)

  if (isLink) {
    const { href, ...linkProps } = props as ButtonLinkProps
    return (
      <Anchor {...linkProps} href={href} className={sharedClassName} ref={ref as React.ForwardedRef<HTMLAnchorElement>}>
        <TouchTarget>
          <span className="inline-flex items-center gap-2">{children}</span>
        </TouchTarget>
      </Anchor>
    )
  }

  return (
    <ShadButton
      {...(props as ButtonNativeProps)}
      ref={ref as React.ForwardedRef<HTMLButtonElement>}
      type={(props as ButtonNativeProps).type ?? 'button'}
      variant={shadVariant}
      className={sharedClassName}
    >
      <TouchTarget>
        <span className="inline-flex items-center gap-2">{children}</span>
      </TouchTarget>
    </ShadButton>
  )
})

export function TouchTarget({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span
        className="absolute top-1/2 left-1/2 size-[max(100%,2.75rem)] -translate-x-1/2 -translate-y-1/2 pointer-fine:hidden"
        aria-hidden="true"
      />
      {children}
    </>
  )
}
