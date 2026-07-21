// Global confirmation dialog host — renders the top of the confirm queue.
// Mounted once near the root of the app (App.tsx).

import { useCallback, useEffect, useRef } from 'react'
import { Alert, AlertActions, AlertDescription, AlertTitle } from '@/components/catalyst-ui/alert'
import { Button } from '@/components/catalyst-ui/button'
import { useConfirmStore } from '@/services/confirmDialog'
import { useI18n } from '@/hooks/useI18n'

export function ConfirmDialogHost() {
  const queue = useConfirmStore((s) => s.queue)
  const resolveTop = useConfirmStore((s) => s.resolveTop)
  const { t } = useI18n()
  const confirmBtnRef = useRef<HTMLButtonElement>(null)
  // Timestamp of when the current dialog became visible. Used to swallow the
  // trailing pointer/keyboard events from the interaction that *opened* the
  // dialog, which Headless UI's Dialog would otherwise treat as an outside
  // click / dismiss and close it immediately (observed in the Electron shell).
  const openedAtRef = useRef(0)

  const current = queue[0]

  useEffect(() => {
    if (!current) {
      openedAtRef.current = 0
      return
    }
    openedAtRef.current = Date.now()
  }, [current?.id])

  // Ignore dismiss requests that arrive within a short guard window after the
  // dialog opens — these are the tail end of the click/keypress that triggered
  // it, not a genuine user dismissal.
  const OPEN_GUARD_MS = 300
  const requestDismiss = useCallback(() => {
    if (Date.now() - openedAtRef.current < OPEN_GUARD_MS) return
    resolveTop(false)
  }, [resolveTop])

  useEffect(() => {
    if (!current) return

    // Focus the confirm button on open.
    const focusTimer = setTimeout(() => confirmBtnRef.current?.focus(), 30)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestDismiss()
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
  }, [current, requestDismiss, resolveTop])

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
    <Alert open={true} onClose={requestDismiss} size="md" className="border border-border-subtle/60 bg-surface-1 text-text-primary shadow-2xl">
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

