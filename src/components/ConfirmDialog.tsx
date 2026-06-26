// Global confirmation dialog host — renders the top of the confirm queue.
// Mounted once near the root of the app (App.tsx).

import { useEffect, useRef } from 'react'
import { Alert, AlertActions, AlertDescription, AlertTitle } from '@/components/catalyst-ui/alert'
import { Button } from '@/components/catalyst-ui/button'
import { useConfirmStore } from '@/services/confirmDialog'
import { useI18n } from '@/hooks/useI18n'

export function ConfirmDialogHost() {
  const queue = useConfirmStore((s) => s.queue)
  const resolveTop = useConfirmStore((s) => s.resolveTop)
  const { t } = useI18n()
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  const current = queue[0]

  useEffect(() => {
    if (!current) return

    // Focus the confirm button on open.
    const focusTimer = setTimeout(() => confirmBtnRef.current?.focus(), 30)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        resolveTop(false)
      } else if (e.key === 'Enter' && (e.target as HTMLElement | null)?.tagName !== 'BUTTON') {
        e.preventDefault()
        resolveTop(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(focusTimer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [current, resolveTop])

  if (!current) return null

  const confirmText = current.confirmText === 'Confirm'
    ? t('common.confirm', 'Confirm')
    : current.confirmText
  const cancelText = current.cancelText === 'Cancel'
    ? t('common.cancel', 'Cancel')
    : current.cancelText
  const choices = current.choices?.length ? current.choices : undefined
  const primaryChoiceIndex = choices ? Math.max(0, choices.findIndex((item) => item.variant === 'primary')) : -1
  const buttonVariant = (variant: 'primary' | 'danger' | 'secondary' | undefined) => {
    if (variant === 'danger') return 'danger' as const
    if (variant === 'primary') return 'primary' as const
    return 'secondary' as const
  }

  return (
    <Alert open={true} onClose={() => resolveTop(false)} size="md" className="border border-border-subtle/60 bg-surface-1 text-text-primary shadow-2xl">
      <AlertTitle id="suora-confirm-title" className={current.danger ? 'text-danger dark:text-red-400' : 'text-text-primary dark:text-white'}>
          {current.title}
      </AlertTitle>
      <AlertDescription className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-text-secondary dark:text-zinc-400">
          {current.body}
      </AlertDescription>
      <AlertActions className="mt-6">
          <Button type="button" variant="secondary" onClick={() => resolveTop(false)} className="rounded-xl px-4 py-2 text-[13px]">
            {cancelText}
          </Button>
          {choices ? (
            choices.map((choice, index) => (
              <Button
                key={choice.value}
                type="button"
                ref={index === primaryChoiceIndex ? confirmBtnRef : undefined}
                onClick={() => resolveTop(choice.value)}
                variant={buttonVariant(choice.variant)}
                className="rounded-xl px-4 py-2 text-[13px]"
              >
                {choice.label}
              </Button>
            ))
          ) : (
            <Button
              type="button"
              ref={confirmBtnRef}
              onClick={() => resolveTop(true)}
              variant={current.danger ? 'danger' : 'primary'}
              className="rounded-xl px-4 py-2 text-[13px]"
            >
              {confirmText}
            </Button>
          )}
      </AlertActions>
    </Alert>
  )
}

