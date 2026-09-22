import type { FormatXMLElementFn, PrimitiveType } from "intl-messageformat"
import { useIntl, type MessageDescriptor } from "react-intl"
import type { PreferenceLanguage } from "@/types/preference"
import { zhMessages } from "@/lib/i18n/messages-zh"

type MessageValues = Record<string, PrimitiveType | FormatXMLElementFn<string, string>>

export function getIntlLocale(language: PreferenceLanguage) {
  return language === "en" ? "en" : "zh-CN"
}

export function getIntlMessages(language: PreferenceLanguage) {
  return language === "en" ? {} : zhMessages
}

export function useAppIntl() {
  const intl = useIntl()

  return {
    intl,
    language: intl.locale.startsWith("zh") ? "zh" : "en",
    t: (id: string, defaultMessage: string, values?: MessageValues) =>
      intl.formatMessage({ id, defaultMessage }, values),
    formatMessage: (descriptor: MessageDescriptor, values?: MessageValues) => intl.formatMessage(descriptor, values),
  }
}
