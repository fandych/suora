import type { ChannelConfigRecord, ChannelConnectionMode, ChannelDetail, ChannelPlatform, ChannelRuntimeState, ProviderConfigRecord } from "@/data/domain/models"
import { DEFAULT_PREFERENCES } from "@/data/domain/preference-settings"

export const DEFAULT_CHANNEL_AGENT_ID = "agent-general-assistant"
export const DEFAULT_CHANNEL_MODEL_ID = "gpt-5"
export const DEFAULT_CHANNEL_DESCRIPTIONS: Partial<Record<ChannelPlatform, string>> = {
  web: "Handle browser and generic webhook events for workspace automation.",
  email: "Process inbound email conversations and send automated replies.",
  wechat: "Connect an Enterprise WeChat application for inbound and outbound messaging.",
  wechat_personal: "Bind a personal WeChat account through QR login for direct chat automation.",
  wechat_official: "Receive and answer Official Account messages through the public platform webhook.",
  wechat_miniprogram: "Connect a WeChat Mini Program for custom service and message routing through a dedicated OpenAPI credential set.",
  feishu: "Manage Feishu bot events and route responses through the workspace agent flow.",
  dingtalk: "Receive DingTalk bot messages and send agent replies back to conversations.",
  telegram: "Connect a Telegram bot and manage inbound chat delivery.",
  teams: "Wire Microsoft Teams app credentials into the channel runtime.",
  custom: "Define a custom transport and payload contract for an unsupported channel platform.",
}

type ChannelTemplate = {
  title: string
  platform: ChannelPlatform
  connectionMode: ChannelConnectionMode
  customPlatformName?: string
  customPlatformIcon?: string
}

export const CHANNEL_CATALOG_TEMPLATES: ChannelTemplate[] = [
  { title: "Personal WeChat", platform: "wechat_personal", connectionMode: "stream" },
  { title: "Enterprise WeChat", platform: "wechat", connectionMode: "webhook" },
  { title: "WeChat Official Account", platform: "wechat_official", connectionMode: "webhook" },
  { title: "WeChat Mini Program", platform: "wechat_miniprogram", connectionMode: "webhook" },
  { title: "Feishu", platform: "feishu", connectionMode: "webhook" },
  { title: "DingTalk", platform: "dingtalk", connectionMode: "stream" },
  { title: "QQ", platform: "custom", connectionMode: "webhook", customPlatformName: "QQ", customPlatformIcon: "qq" },
  { title: "Microsoft Teams", platform: "teams", connectionMode: "webhook" },
  { title: "Telegram", platform: "telegram", connectionMode: "webhook" },
  { title: "Email Inbox", platform: "email", connectionMode: "stream" },
  { title: "Custom Webhook", platform: "custom", connectionMode: "webhook", customPlatformName: "Custom Webhook" },
  { title: "Custom WebSocket", platform: "custom", connectionMode: "stream", customPlatformName: "Custom WebSocket" },
]

export function buildChannelCatalogId(template: Pick<ChannelTemplate, "title" | "customPlatformName">) {
  const slugSource = template.customPlatformName?.trim() || template.title
  return `catalog-${slugSource.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`
}

export function getDefaultChannelDescription(platform: ChannelPlatform, customPlatformName?: string) {
  if (platform === "custom" && customPlatformName?.trim().toLowerCase() === "qq") {
    return "Connect QQ messages through a custom delivery endpoint while preserving QQ-specific branding in the workbench."
  }

  return DEFAULT_CHANNEL_DESCRIPTIONS[platform] ?? ""
}

export function applyDefaultChannelDescription(channel: ChannelConfigRecord) {
  if (channel.description?.trim()) {
    return channel.description
  }

  return getDefaultChannelDescription(channel.platform, channel.customPlatformName)
}

export function resolveDefaultChannelModel(providers: ProviderConfigRecord[]) {
  const configuredProviders = providers.filter((provider) => provider.enabled && provider.models.some((model) => model.enabled))
  const preferredProvider = configuredProviders.find((provider) => provider.id === DEFAULT_PREFERENCES.defaultModelProviderId)
  const fallbackProvider = preferredProvider ?? configuredProviders[0] ?? providers.find((provider) => provider.id === DEFAULT_PREFERENCES.defaultModelProviderId) ?? providers[0]
  const fallbackModel = fallbackProvider?.models.find((model) => model.enabled) ?? fallbackProvider?.models[0]

  return {
    providerId: fallbackProvider?.id ?? DEFAULT_PREFERENCES.defaultModelProviderId,
    modelId: fallbackModel?.id ?? DEFAULT_CHANNEL_MODEL_ID,
  }
}

export function createDefaultChannelRuntime(): ChannelRuntimeState {
  return {
    messages: [],
    users: [],
    health: {
      isHealthy: null,
      errorCount: 0,
    },
    debugLog: [],
  }
}

export function createDefaultChannelConfig(params: {
  id: string
  title: string
  platform: ChannelPlatform
  now: number
  connectionMode?: ChannelConnectionMode
  customPlatformName?: string
  customPlatformIcon?: string
  providerId?: string
  modelId?: string
}) {
  return {
    id: params.id,
    title: params.title,
    description: getDefaultChannelDescription(params.platform, params.customPlatformName),
    platform: params.platform,
    enabled: false,
    status: "inactive",
    connectionMode: params.connectionMode ?? (params.platform === "wechat_personal" ? "stream" : "webhook"),
    webhookPath: `/channels/${params.id}`,
    webhookSecret: "",
    autoReply: true,
    replyAgentId: DEFAULT_CHANNEL_AGENT_ID,
    providerId: params.providerId ?? DEFAULT_PREFERENCES.defaultModelProviderId,
    modelId: params.modelId ?? DEFAULT_CHANNEL_MODEL_ID,
    createdAt: params.now,
    updatedAt: params.now,
    messageCount: 0,
    emailFilters: [],
    emailActions: [],
    emailMarkAsRead: true,
    customPlatformName: params.customPlatformName,
    customPlatformIcon: params.customPlatformIcon,
    wechatPersonalBindingStatus: params.platform === "wechat_personal" ? "unbound" : undefined,
  } satisfies Partial<ChannelConfigRecord>
}

export function buildUnboundChannelDetail(detail: ChannelDetail): ChannelDetail {
  return {
    ...detail,
    channel: {
      ...detail.channel,
      enabled: false,
      bindingState: "unconfigured",
      status: "inactive",
      wechatPersonalBindingStatus: detail.channel.platform === "wechat_personal" ? "unbound" : detail.channel.wechatPersonalBindingStatus,
      wechatPersonalQrStatus: undefined,
      wechatPersonalSessionKey: undefined,
      wechatPersonalQrCodeUrl: undefined,
      wechatPersonalBotToken: undefined,
      wechatPersonalBaseUrl: undefined,
      wechatPersonalAccountId: undefined,
      wechatPersonalUserId: undefined,
    },
    runtime: {
      ...detail.runtime,
      debugLog: detail.runtime.debugLog,
    },
  }
}