import type { ChannelConfigRecord, ChannelStatus } from "@/data/domain/models"

export function buildChannelWebhookUrl(channel: ChannelConfigRecord) {
  if (channel.connectionMode === "stream") {
    return "Stream transport"
  }

  const normalizedPath = channel.webhookPath.startsWith("/") ? channel.webhookPath : `/${channel.webhookPath}`
  return `https://local.suora.test${normalizedPath}`
}

export function getChannelCredentialIssues(channel: ChannelConfigRecord) {
  switch (channel.platform) {
    case "email": {
      return [
        !channel.emailImapHost ? "IMAP host" : null,
        !channel.emailImapUser ? "IMAP user" : null,
        !channel.emailUseGlobalMailService && !channel.emailSmtpHost ? "SMTP host" : null,
        !channel.emailUseGlobalMailService && !channel.emailFromAddress ? "From address" : null,
      ].filter(Boolean) as string[]
    }
    case "wechat": {
      return [
        !channel.wechatCorpId ? "Corp ID" : null,
        !channel.wechatAgentId ? "Agent ID" : null,
        !channel.appSecret ? "App secret" : null,
        !channel.wechatToken ? "Verification token" : null,
      ].filter(Boolean) as string[]
    }
    case "wechat_personal": {
      if (channel.wechatPersonalBindingStatus === "bound" && channel.wechatPersonalBotToken && channel.wechatPersonalBaseUrl) {
        return []
      }

      if (channel.wechatPersonalWebhookUrl) {
        return []
      }

      return ["Start QR binding or provide a bridge webhook URL"]
    }
    case "wechat_official": {
      return [
        !channel.wechatOfficialAppId ? "Official Account App ID" : null,
        !channel.wechatOfficialAppSecret ? "Official Account app secret" : null,
        !channel.wechatOfficialToken ? "Verification token" : null,
      ].filter(Boolean) as string[]
    }
    case "wechat_miniprogram": {
      return [
        !channel.wechatMiniProgramAppId ? "Mini Program App ID" : null,
        !channel.wechatMiniProgramAppSecret ? "Mini Program app secret" : null,
        !channel.wechatMiniProgramToken ? "Verification token" : null,
      ].filter(Boolean) as string[]
    }
    case "feishu": {
      return [
        !channel.feishuAppId ? "App ID" : null,
        !channel.feishuAppSecret ? "App secret" : null,
        !channel.feishuVerificationToken ? "Verification token" : null,
      ].filter(Boolean) as string[]
    }
    case "dingtalk": {
      if (channel.connectionMode === "stream") {
        return [
          !channel.dingtalkClientId ? "Client ID" : null,
          !channel.dingtalkClientSecret ? "Client secret" : null,
        ].filter(Boolean) as string[]
      }

      return [
        !channel.dingtalkWebhookUrl ? "Webhook URL" : null,
        !channel.dingtalkSigningSecret ? "Signing secret" : null,
      ].filter(Boolean) as string[]
    }
    case "telegram":
      return !channel.telegramBotToken ? ["Bot token"] : []
    case "teams": {
      return [
        !channel.teamsAppId ? "App ID" : null,
        !channel.teamsAppPassword ? "App password" : null,
      ].filter(Boolean) as string[]
    }
    case "custom": {
      if (channel.connectionMode === "stream") {
        return !channel.customWebsocketUrl ? ["WebSocket URL"] : []
      }

      return !channel.customWebhookUrl ? ["Webhook URL"] : []
    }
    case "web":
    default:
      return []
  }
}

export function hasChannelCredentialFootprint(channel: ChannelConfigRecord) {
  return getChannelCredentialIssues(channel).length === 0
}

export function inferChannelBindingState(channel: ChannelConfigRecord): NonNullable<ChannelConfigRecord["bindingState"]> {
  if (channel.platform === "wechat_personal" && channel.wechatPersonalBindingStatus === "error") {
    return "error"
  }

  if (channel.platform === "wechat_personal" && channel.wechatPersonalBindingStatus === "bound") {
    return "connected"
  }

  if (channel.enabled && hasChannelCredentialFootprint(channel)) {
    return "connected"
  }

  if (hasChannelCredentialFootprint(channel)) {
    return "ready"
  }

  const hasAnyDraft = Boolean(
    channel.webhookSecret ||
    channel.appId ||
    channel.appSecret ||
    channel.wechatCorpId ||
    channel.wechatMiniProgramAppId ||
    channel.wechatMiniProgramToken ||
    channel.feishuAppId ||
    channel.dingtalkClientId ||
    channel.telegramBotToken ||
    channel.teamsAppId ||
    channel.emailImapHost ||
    channel.customWebhookUrl ||
    channel.customWebsocketUrl ||
    channel.wechatPersonalWebhookUrl ||
    channel.wechatPersonalQrCodeUrl
  )

  return hasAnyDraft ? "draft" : "unconfigured"
}

export function inferChannelStatus(channel: ChannelConfigRecord): ChannelStatus {
  if (!channel.enabled) {
    return "inactive"
  }

  return hasChannelCredentialFootprint(channel) ? "active" : "error"
}

export function normalizeChannelConfig(channel: ChannelConfigRecord) {
  const bindingState = inferChannelBindingState(channel)
  return {
    ...channel,
    bindingState,
    status: inferChannelStatus({
      ...channel,
      bindingState,
    }),
  }
}