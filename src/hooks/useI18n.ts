import { useCallback } from 'react'
import { useAppStore } from '@/store/appStore'
import { t as rawT, setI18nLocale } from '@/services/i18n'

export function useI18n() {
  const locale = useAppStore((s) => s.locale)
  setI18nLocale(locale)
  // Return a locale-bound t function so React detects changes when locale switches
  const t = useCallback(
    (key: string, fallback?: string) => rawT(key, fallback),
    [locale, rawT]
  )
  return { t, locale }
}
