import type { ChannelConfigRecord, ChannelStatus } from "@/types/channel"

export function getChannelCredentialIssues(channel: ChannelConfigRecord) {
  const missing = (items: Array<string | null>) => items.filter(Boolean) as string[]
  switch (channel.platform) {
    case "email":
      return missing([
        !channel.emailImapHost ? "IMAP host" : null,
        !channel.emailImapUser ? "IMAP user" : null,
        !channel.emailUseGlobalMailService && !channel.emailSmtpHost ? "SMTP host" : null,
        !channel.emailUseGlobalMailService && !channel.emailFromAddress ? "From address" : null,
      ])
    case "wechat":
      return missing([
        !channel.wechatCorpId ? "Corp ID" : null,
        !channel.wechatAgentId ? "Agent ID" : null,
        !channel.appSecret ? "App secret" : null,
        !channel.wechatToken ? "Verification token" : null,
      ])
    case "wechat_personal":
      return (channel.wechatPersonalBindingStatus === "bound" &&
        channel.wechatPersonalBotToken &&
        channel.wechatPersonalBaseUrl) ||
        channel.wechatPersonalWebhookUrl
        ? []
        : ["Start QR binding or provide a bridge webhook URL"]
    case "wechat_official":
      return missing([
        !channel.wechatOfficialAppId ? "Official Account App ID" : null,
        !channel.wechatOfficialAppSecret ? "Official Account app secret" : null,
        !channel.wechatOfficialToken ? "Verification token" : null,
      ])
    case "wechat_miniprogram":
      return missing([
        !channel.wechatMiniProgramAppId ? "Mini Program App ID" : null,
        !channel.wechatMiniProgramAppSecret ? "Mini Program app secret" : null,
        !channel.wechatMiniProgramToken ? "Verification token" : null,
      ])
    case "feishu":
      return missing([
        !channel.feishuAppId ? "App ID" : null,
        !channel.feishuAppSecret ? "App secret" : null,
        !channel.feishuVerificationToken ? "Verification token" : null,
      ])
    case "dingtalk":
      return channel.connectionMode === "stream"
        ? missing([
            !channel.dingtalkClientId ? "Client ID" : null,
            !channel.dingtalkClientSecret ? "Client secret" : null,
          ])
        : missing([
            !channel.dingtalkWebhookUrl ? "Webhook URL" : null,
            !channel.dingtalkSigningSecret ? "Signing secret" : null,
          ])
    case "telegram":
      return channel.telegramBotToken ? [] : ["Bot token"]
    case "teams":
      return missing([!channel.teamsAppId ? "App ID" : null, !channel.teamsAppPassword ? "App password" : null])
    case "custom":
      return channel.connectionMode === "stream"
        ? channel.customWebsocketUrl
          ? []
          : ["WebSocket URL"]
        : channel.customWebhookUrl
          ? []
          : ["Webhook URL"]
    default:
      return []
  }
}

function hasChannelCredentials(channel: ChannelConfigRecord) {
  return getChannelCredentialIssues(channel).length === 0
}

function inferBindingState(channel: ChannelConfigRecord): NonNullable<ChannelConfigRecord["bindingState"]> {
  if (channel.platform === "wechat_personal" && channel.wechatPersonalBindingStatus === "error") return "error"
  if (channel.platform === "wechat_personal" && channel.wechatPersonalBindingStatus === "bound") return "connected"
  if (channel.enabled && hasChannelCredentials(channel)) return "connected"
  if (hasChannelCredentials(channel)) return "ready"
  return "unconfigured"
}

function inferStatus(channel: ChannelConfigRecord): ChannelStatus {
  return channel.enabled ? (hasChannelCredentials(channel) ? "active" : "error") : "inactive"
}

export function normalizeChannelRuntimeState(channel: ChannelConfigRecord) {
  const bindingState = inferBindingState(channel)
  return { ...channel, bindingState, status: inferStatus({ ...channel, bindingState }) }
}
