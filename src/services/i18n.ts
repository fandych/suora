import en from './i18n.en.json'
import zh from './i18n.zh.json'
import type { AppLocale } from '@/types'

type TranslationKey = string
type TranslationMap = Record<TranslationKey, string>

const translations: Record<AppLocale, TranslationMap> = {
  en,
  zh,
}

let currentLocale: AppLocale = 'en'

export function normalizeAppLocale(locale: string | null | undefined): AppLocale {
  return locale === 'zh' ? 'zh' : 'en'
}

export function setI18nLocale(locale: string | null | undefined) {
  currentLocale = normalizeAppLocale(locale)
}

export function getLocale(): AppLocale {
  return currentLocale
}

export function t(key: TranslationKey, fallback?: string): string {
  return translations[currentLocale]?.[key] || translations.en[key] || fallback || key
}
