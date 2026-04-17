// Global confirmation dialog host — renders the top of the confirm queue.
// Mounted once near the root of the app (App.tsx).

import { useEffect, useRef } from 'react'
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="suora-confirm-title"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={() => resolveTop(false)}
    >
      <div
        className="w-full max-w-md mx-4 bg-surface-1 border border-border-subtle/60 rounded-[18px] shadow-2xl p-6 animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="suora-confirm-title"
          className={`text-[16px] font-semibold ${current.danger ? 'text-danger' : 'text-text-primary'}`}
        >
          {current.title}
        </h2>
        <p className="mt-3 text-[14px] text-text-secondary leading-relaxed whitespace-pre-wrap">
          {current.body}
        </p>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => resolveTop(false)}
            className="px-4 py-2 text-[13px] rounded-xl bg-surface-2/60 hover:bg-surface-3/60 text-text-secondary hover:text-text-primary transition-colors font-medium"
          >
            {cancelText}
          </button>
          <button
            type="button"
            ref={confirmBtnRef}
            onClick={() => resolveTop(true)}
            className={`px-4 py-2 text-[13px] rounded-xl transition-colors font-medium focus:outline-none focus:ring-2 ${
              current.danger
                ? 'bg-danger/90 hover:bg-danger text-white focus:ring-danger/40'
                : 'bg-accent/90 hover:bg-accent text-white focus:ring-accent/40'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
