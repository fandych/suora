import { protectCredential, revealCredential, revealCredentialState } from "@/electron/infrastructure/credential-vault"

const CREDENTIAL_FIELDS = [
  "emailImapPassword",
  "emailSmtpPassword",
  "webhookSecret",
  "appSecret",
  "verificationToken",
  "encryptKey",
  "telegramBotToken",
  "teamsAppPassword",
  "wechatToken",
  "wechatEncodingAesKey",
  "wechatOfficialAppSecret",
  "wechatOfficialToken",
  "wechatMiniProgramAppSecret",
  "wechatMiniProgramToken",
  "wechatMiniProgramEncodingAesKey",
  "wechatPersonalAuthToken",
  "wechatPersonalBotToken",
  "feishuAppSecret",
  "feishuVerificationToken",
  "feishuEncryptKey",
  "dingtalkClientSecret",
  "dingtalkSigningSecret",
  "customAuthValue",
] as const

export const channelCredentialFields = CREDENTIAL_FIELDS

export function preserveConfiguredChannelCredentials(next: ChannelCredentialConfig, current: ChannelCredentialConfig) {
  const merged = { ...next }
  for (const field of CREDENTIAL_FIELDS) {
    if (merged[field] === "" && typeof current[field] === "string" && current[field]) {
      merged[field] = current[field]
    }
  }
  return merged
}

type ChannelCredentialConfig = Record<string, unknown>

function mapChannelCredentials(config: ChannelCredentialConfig, mapper: (value: string) => string) {
  const next = { ...config }
  for (const field of CREDENTIAL_FIELDS) {
    if (typeof next[field] === "string") {
      next[field] = mapper(next[field])
    }
  }
  return next
}

export function protectChannelCredentials(config: ChannelCredentialConfig) {
  return mapChannelCredentials(config, protectCredential)
}

export function revealChannelCredentials(config: ChannelCredentialConfig) {
  return mapChannelCredentials(config, revealCredential)
}

export function revealChannelCredentialsWithState(config: ChannelCredentialConfig) {
  const next = { ...config }
  const legacyPlaintextFields: string[] = []
  for (const field of CREDENTIAL_FIELDS) {
    if (typeof next[field] === "string") {
      const credential = revealCredentialState(next[field])
      next[field] = credential.value
      if (credential.legacyPlaintext && credential.value) legacyPlaintextFields.push(field)
    }
  }
  return { config: next, legacyPlaintextFields }
}

export function redactChannelCredentials(config: ChannelCredentialConfig) {
  const next = { ...config }
  for (const field of CREDENTIAL_FIELDS) {
    if (typeof next[field] === "string") {
      next[`${field}Configured`] = Boolean(next[field])
      next[field] = ""
    }
  }
  return next
}

export function redactChannelDetail(detail: Record<string, unknown>) {
  if (!detail.channel || typeof detail.channel !== "object") return detail
  return { ...detail, channel: redactChannelCredentials(detail.channel as ChannelCredentialConfig) }
}
