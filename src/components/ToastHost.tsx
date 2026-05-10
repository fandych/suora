// Toast host — renders all active toasts in a fixed stack at the top-right.

import { useState, useCallback } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { useToastStore, type ToastKind } from '@/services/toast'

const KIND_STYLES: Record<ToastKind, string> = {
  info:    'bg-surface-2/95 border-border-subtle/60 text-text-primary',
  success: 'bg-surface-2/95 border-success/40 text-text-primary',
  warning: 'bg-surface-2/95 border-warning/40 text-text-primary',
  error:   'bg-surface-2/95 border-danger/40 text-text-primary',
}

const KIND_ICON: Record<ToastKind, string> = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  error: '✕',
}

const KIND_ICON_CLS: Record<ToastKind, string> = {
  info:    'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  error:   'text-danger',
}

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  const [dismissing, setDismissing] = useState<Set<number>>(new Set())
  const { t: translate } = useI18n()

  const handleDismiss = useCallback((id: number) => {
    setDismissing((prev) => new Set(prev).add(id))
    setTimeout(() => {
      dismiss(id)
      setDismissing((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 200) // match CSS transition duration
  }, [dismiss])

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-4 right-4 toast-host-layer flex flex-col gap-2 max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-[14px] border shadow-lg backdrop-blur-xl transition-all duration-200 ${dismissing.has(toast.id) ? 'opacity-0 translate-x-4' : 'animate-fade-in-scale'} ${KIND_STYLES[toast.kind]}`}
        >
          <span className={`text-[14px] font-bold mt-0.5 ${KIND_ICON_CLS[toast.kind]}`}>
            {KIND_ICON[toast.kind]}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium content-wrap-anywhere">{toast.message}</div>
            {toast.detail && (
              <div className="mt-1 text-[11.5px] text-text-muted content-wrap-anywhere">{toast.detail}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleDismiss(toast.id)}
            className="text-text-muted/70 hover:text-text-primary text-[12px] transition-colors leading-none -mr-1 -mt-1 p-1"
            aria-label={translate('common.close', 'Close')}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
