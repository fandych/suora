import { useMemo, useState, type ReactNode } from 'react'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { IconPicker } from '@/components/icons/IconPicker'
import { useI18n } from '@/hooks/useI18n'
import type { ChannelConfig, ChannelConnectionMode, ChannelPlatform } from '@/types'
import { ChannelPlatformIcon, getPlatformDisplayName } from './ChannelIcons'

function EditorSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-4xl border border-border-subtle/55 bg-linear-to-br from-surface-1/96 via-surface-1/88 to-surface-2/70 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)] xl:p-6">
      <div>
        <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{eyebrow}</div>
        <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">{title}</h3>
        {description && <p className="mt-2 max-w-2xl text-[13px] leading-6 text-text-secondary/80">{description}</p>}
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  )
}

const INPUT_CLASS = 'w-full rounded-2xl border border-border-subtle/55 bg-surface-2/80 px-3.5 py-3 text-sm text-text-primary placeholder-text-muted/55 focus:outline-none focus:ring-2 focus:ring-accent/20'
const TEXTAREA_CLASS = `${INPUT_CLASS} min-h-36 resize-y font-mono text-xs leading-6`

export function ChannelEditor({
  channel,
  agents,
  isNew,
  onSave,
  onCancel,
}: {
  channel: ChannelConfig
  agents: { id: string; name: string; avatar?: string; enabled?: boolean }[]
  isNew: boolean
  onSave: (ch: ChannelConfig) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<ChannelConfig>({ ...channel })
  const [saveError, setSaveError] = useState('')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const isValid = draft.name.trim().length > 0
  const selectableAgents = useMemo(
    () => agents.filter((agent) => agent.enabled !== false || agent.id === draft.replyAgentId),
    [agents, draft.replyAgentId],
  )
  const platformLabel = draft.platform === 'custom'
    ? draft.customPlatformName?.trim() || t('channels.customChannel', 'Custom Channel')
    : getPlatformDisplayName(draft.platform)
  const selectedAgent = agents.find((agent) => agent.id === draft.replyAgentId)
  const isChinesePlatform = draft.platform === 'feishu' || draft.platform === 'dingtalk' || draft.platform === 'wechat' || draft.platform === 'wechat_official' || draft.platform === 'wechat_miniprogram'
  const modeLabel = draft.connectionMode === 'stream' ? t('channels.stream', 'Stream') : t('channels.webhook', 'Webhook')

  const handleSave = () => {
    setSaveError('')
    if (!isValid) {
      setSaveError(t('channels.channelNameRequired', 'Channel name is required'))
      return
    }
    onSave(draft)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <section className="rounded-4xl border border-accent/12 bg-linear-to-br from-accent/10 via-surface-1/94 to-surface-2/72 p-6 shadow-[0_24px_70px_rgba(var(--t-accent-rgb),0.08)] xl:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-4xl border border-accent/12 bg-linear-to-br from-accent/18 via-accent/10 to-transparent text-accent shadow-[0_12px_36px_rgba(var(--t-accent-rgb),0.12)]">
              <ChannelPlatformIcon platform={draft.platform} size={30} customIcon={draft.customPlatformIcon} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted/45">{isNew ? t('channels.newChannel', 'New Channel') : t('channels.editChannel', 'Edit Channel')}</div>
              <h1 className="mt-2 text-[30px] font-semibold tracking-tight text-text-primary">{draft.name || t('channels.untitledChannel', 'Untitled channel')}</h1>
              <p className="mt-2 max-w-3xl text-[14px] leading-7 text-text-secondary/82">{t('channels.editorHeroHint', 'Set the platform identity, wire transport credentials, and decide which agent owns replies before the channel goes live.')}</p>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-3 xl:items-end">
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-2xl bg-surface-2 px-4 py-3 text-sm font-semibold text-text-muted transition-colors hover:bg-surface-3 hover:text-text-secondary"
              >
                <span className="inline-flex items-center gap-1.5"><IconifyIcon name="ui-close" size={14} color="currentColor" /> {t('common.cancel', 'Cancel')}</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isValid}
                className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(var(--t-accent-rgb),0.22)] transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-1.5"><IconifyIcon name="ui-check" size={14} color="currentColor" /> {t('common.save', 'Save')}</span>
              </button>
            </div>
            {saveError && <span className="text-right text-[12px] font-medium text-red-400">{saveError}</span>}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-text-secondary">
          <span className="rounded-full bg-surface-0/70 px-3 py-1">{platformLabel}</span>
          <span className="rounded-full bg-surface-0/70 px-3 py-1">{modeLabel}</span>
          <span className="rounded-full bg-surface-0/70 px-3 py-1">{selectedAgent?.name || t('common.noData', 'No agent selected')}</span>
          <span className={`rounded-full px-3 py-1 ${draft.autoReply ? 'bg-accent/12 text-accent' : 'bg-surface-0/70 text-text-secondary'}`}>{draft.autoReply ? t('channels.autoReplyEnabled', 'Auto reply on') : t('channels.autoReplyDisabled', 'Auto reply off')}</span>
          <span className={`rounded-full px-3 py-1 ${draft.enabled ? 'bg-green-500/12 text-green-400' : 'bg-surface-0/70 text-text-secondary'}`}>{draft.enabled ? t('channels.enabledChannel', 'Channel enabled') : t('channels.disabledChannel', 'Channel disabled')}</span>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <EditorSection
            eyebrow={t('channels.identity', 'Identity')}
            title={t('channels.channelIdentity', 'Channel Identity')}
            description={t('channels.channelIdentityHint', 'Name the integration, set its platform type, and define any custom branding that should appear in the workbench.')}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('common.name', 'Name')}</span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  aria-label={t('channels.channelNameField', 'Channel name')}
                  className={INPUT_CLASS}
                  placeholder={t('channels.channelNamePlaceholder', 'e.g. Customer support inbox')}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.platform', 'Platform')}</span>
                <select
                  value={draft.platform}
                  onChange={(event) => setDraft({ ...draft, platform: event.target.value as ChannelPlatform })}
                  aria-label={t('channels.platform', 'Platform')}
                  className={INPUT_CLASS}
                >
                  <optgroup label={t('channels.chinesePlatforms', 'Chinese Platforms')}>
                    <option value="feishu">飞书 Feishu / Lark</option>
                    <option value="dingtalk">钉钉 DingTalk</option>
                    <option value="wechat">企业微信 WeChat Work</option>
                    <option value="wechat_official">微信公众号 WeChat Official</option>
                    <option value="wechat_miniprogram">微信小程序 WeChat Mini Program</option>
                  </optgroup>
                  <optgroup label={t('channels.internationalPlatforms', 'International Platforms')}>
                    <option value="slack">Slack</option>
                    <option value="telegram">Telegram</option>
                    <option value="discord">Discord</option>
                    <option value="teams">Microsoft Teams</option>
                  </optgroup>
                  <optgroup label={t('channels.otherPlatforms', 'Other')}>
                    <option value="custom">{t('channels.customChannel', 'Custom Channel')}</option>
                  </optgroup>
                </select>
              </label>
            </div>

            {draft.platform === 'custom' && (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.customPlatformName', 'Platform Name')}</span>
                  <input
                    type="text"
                    value={draft.customPlatformName || ''}
                    onChange={(event) => setDraft({ ...draft, customPlatformName: event.target.value })}
                    aria-label={t('channels.customPlatformName', 'Platform Name')}
                    placeholder={t('channels.customPlatformPlaceholder', 'e.g. LINE, WhatsApp, My Bot')}
                    className={INPUT_CLASS}
                  />
                </label>

                <div>
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.customPlatformIcon', 'Platform Icon')}</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={draft.customPlatformIcon || ''}
                      onChange={(event) => setDraft({ ...draft, customPlatformIcon: event.target.value })}
                      aria-label={t('channels.customPlatformIcon', 'Platform Icon')}
                      placeholder={t('channels.customPlatformIconPlaceholder', 'e.g. mdi:chat, lucide:bot')}
                      className={INPUT_CLASS}
                    />
                    <button
                      type="button"
                      onClick={() => setShowIconPicker(true)}
                      className="shrink-0 rounded-2xl border border-border-subtle/55 bg-surface-2/80 px-4 py-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-3 hover:text-accent"
                    >
                      {t('common.browse', 'Browse')}
                    </button>
                  </div>
                  {showIconPicker && (
                    <IconPicker
                      value={draft.customPlatformIcon}
                      onSelect={(icon) => { setDraft({ ...draft, customPlatformIcon: icon }); setShowIconPicker(false) }}
                      onClose={() => setShowIconPicker(false)}
                    />
                  )}
                </div>
              </div>
            )}
          </EditorSection>

          {isChinesePlatform && (
            <EditorSection
              eyebrow={t('channels.credentials', 'Credentials')}
              title={t('channels.appCredentials', 'App Credentials')}
              description={t('channels.appCredentialsHint', 'These keys authenticate the channel against the upstream platform before messages can flow into the workspace.')}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.appId', 'App ID')}</span>
                  <input
                    type="text"
                    value={draft.appId || ''}
                    onChange={(event) => setDraft({ ...draft, appId: event.target.value })}
                    placeholder={t('channels.appIdPlaceholder', 'Your application ID')}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.appSecret', 'App Secret')}</span>
                  <input
                    type="password"
                    value={draft.appSecret || ''}
                    onChange={(event) => setDraft({ ...draft, appSecret: event.target.value })}
                    placeholder={t('channels.appSecretPlaceholder', 'Your application secret')}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>
            </EditorSection>
          )}

          {draft.platform === 'dingtalk' && (
            <EditorSection
              eyebrow={t('channels.transport', 'Transport')}
              title={t('channels.dingtalkTransport', 'DingTalk Transport')}
              description={t('channels.dingtalkTransportHint', 'Choose whether DingTalk reaches the app through a persistent socket or a public callback endpoint.')}
            >
              <label className="block">
                <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.connectionMode', 'Connection Mode')}</span>
                <select
                  value={draft.connectionMode || 'webhook'}
                  onChange={(event) => setDraft({ ...draft, connectionMode: event.target.value as ChannelConnectionMode })}
                  aria-label={t('channels.connectionMode', 'Connection Mode')}
                  className={INPUT_CLASS}
                >
                  <option value="stream">{t('channels.streamModeRecommended', 'Stream Mode (WebSocket, recommended)')}</option>
                  <option value="webhook">{t('channels.webhookModeHttp', 'Webhook Mode (HTTP callback)')}</option>
                </select>
              </label>
              <div className={`rounded-3xl border p-4 ${draft.connectionMode === 'stream' ? 'border-green-500/18 bg-green-500/8' : 'border-yellow-500/18 bg-yellow-500/8'}`}>
                <div className="text-sm font-semibold text-text-primary">{draft.connectionMode === 'stream' ? t('channels.streamMode', 'Stream Mode') : t('channels.webhook', 'Webhook')}</div>
                <p className="mt-2 text-[12px] leading-6 text-text-secondary/80">
                  {draft.connectionMode === 'stream'
                    ? t('channels.streamModeDesktopHint', 'Stream mode keeps the desktop app connected over WebSocket, so you do not need a public IP or reverse proxy.')
                    : t('channels.webhookModeDesktopHint', 'Webhook mode expects a reachable callback URL. Use it only when the platform must call back over HTTP.')}
                </p>
              </div>
            </EditorSection>
          )}

          {draft.platform === 'feishu' && (
            <EditorSection
              eyebrow="Feishu"
              title={t('channels.feishuVerification', 'Feishu Verification')}
              description={t('channels.feishuVerificationHint', 'Use the verification token and encrypt key from the Feishu bot console so webhook traffic can be validated correctly.')}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.verificationToken', 'Verification Token')}</span>
                  <input
                    type="text"
                    value={draft.verificationToken || ''}
                    onChange={(event) => setDraft({ ...draft, verificationToken: event.target.value })}
                    aria-label={t('channels.verificationToken', 'Verification Token')}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.encryptKey', 'Encrypt Key')}</span>
                  <input
                    type="password"
                    value={draft.encryptKey || ''}
                    onChange={(event) => setDraft({ ...draft, encryptKey: event.target.value })}
                    aria-label={t('channels.encryptKey', 'Encrypt Key')}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>
            </EditorSection>
          )}

          {draft.platform === 'slack' && (
            <EditorSection
              eyebrow="Slack"
              title={t('channels.slackBotAccess', 'Slack Bot Access')}
              description={t('channels.slackBotAccessHint', 'Paste the bot token and signing secret from your Slack app so inbound events can be trusted and replies can be delivered.')}
            >
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.botToken', 'Bot Token')}</span>
                  <input
                    type="password"
                    value={draft.slackBotToken || ''}
                    onChange={(event) => setDraft({ ...draft, slackBotToken: event.target.value })}
                    aria-label={t('channels.botToken', 'Bot Token')}
                    placeholder="xoxb-..."
                    className={INPUT_CLASS}
                  />
                  <p className="mt-2 text-[11px] leading-5 text-text-muted">{t('channels.slackBotTokenHint', 'Bot User OAuth Token from your Slack app settings.')}</p>
                </label>
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.signingSecret', 'Signing Secret')}</span>
                  <input
                    type="password"
                    value={draft.slackSigningSecret || ''}
                    onChange={(event) => setDraft({ ...draft, slackSigningSecret: event.target.value })}
                    aria-label={t('channels.signingSecret', 'Signing Secret')}
                    className={INPUT_CLASS}
                  />
                  <p className="mt-2 text-[11px] leading-5 text-text-muted">{t('channels.slackSigningSecretHint', 'Used to verify incoming webhook requests from Slack.')}</p>
                </label>
              </div>
            </EditorSection>
          )}

          {draft.platform === 'telegram' && (
            <EditorSection
              eyebrow="Telegram"
              title={t('channels.telegramBotAccess', 'Telegram Bot Access')}
              description={t('channels.telegramBotAccessHint', 'Use the bot token issued by @BotFather to authenticate outbound replies and webhook callbacks.')}
            >
              <label className="block">
                <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.botToken', 'Bot Token')}</span>
                <input
                  type="password"
                  value={draft.telegramBotToken || ''}
                  onChange={(event) => setDraft({ ...draft, telegramBotToken: event.target.value })}
                  aria-label={t('channels.botToken', 'Bot Token')}
                  placeholder="123456:ABC-DEF1234..."
                  className={INPUT_CLASS}
                />
                <p className="mt-2 text-[11px] leading-5 text-text-muted">{t('channels.telegramBotTokenHint', 'Bot token from @BotFather on Telegram.')}</p>
              </label>
            </EditorSection>
          )}

          {draft.platform === 'discord' && (
            <EditorSection
              eyebrow="Discord"
              title={t('channels.discordBotAccess', 'Discord Bot Access')}
              description={t('channels.discordBotAccessHint', 'Fill in the application credentials from the Discord developer portal before enabling the channel.')}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.botToken', 'Bot Token')}</span>
                  <input
                    type="password"
                    value={draft.discordBotToken || ''}
                    onChange={(event) => setDraft({ ...draft, discordBotToken: event.target.value })}
                    aria-label={t('channels.botToken', 'Bot Token')}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.applicationId', 'Application ID')}</span>
                  <input
                    type="text"
                    value={draft.discordApplicationId || ''}
                    onChange={(event) => setDraft({ ...draft, discordApplicationId: event.target.value })}
                    aria-label={t('channels.applicationId', 'Application ID')}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>
            </EditorSection>
          )}

          {draft.platform === 'teams' && (
            <EditorSection
              eyebrow="Teams"
              title={t('channels.teamsConfig', 'Teams Configuration')}
              description={t('channels.teamsConfigHint', 'Add the bot registration identifiers from Azure so Teams can authenticate and route bot traffic correctly.')}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.appId', 'App ID')}</span>
                  <input
                    type="text"
                    value={draft.teamsAppId || ''}
                    onChange={(event) => setDraft({ ...draft, teamsAppId: event.target.value })}
                    aria-label={t('channels.appId', 'App ID')}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.appPassword', 'App Password')}</span>
                  <input
                    type="password"
                    value={draft.teamsAppPassword || ''}
                    onChange={(event) => setDraft({ ...draft, teamsAppPassword: event.target.value })}
                    aria-label={t('channels.appPassword', 'App Password')}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.tenantIdOptional', 'Tenant ID (optional)')}</span>
                <input
                  type="text"
                  value={draft.teamsTenantId || ''}
                  onChange={(event) => setDraft({ ...draft, teamsTenantId: event.target.value })}
                  aria-label={t('channels.tenantIdOptional', 'Tenant ID (optional)')}
                  className={INPUT_CLASS}
                />
                <p className="mt-2 text-[11px] leading-5 text-text-muted">{t('channels.tenantIdHint', 'Use a tenant ID for single-tenant apps. Leave blank for multi-tenant registrations.')}</p>
              </label>
            </EditorSection>
          )}

          {draft.platform === 'wechat_official' && (
            <EditorSection
              eyebrow="WeChat"
              title={t('channels.wechatOfficialVerification', 'Official Account Verification')}
              description={t('channels.wechatOfficialVerificationHint', 'WeChat Official Accounts validate each request with the token configured in the management portal.')}
            >
              <label className="block">
                <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.verificationToken', 'Verification Token')}</span>
                <input
                  type="text"
                  value={draft.wechatOfficialToken || ''}
                  onChange={(event) => setDraft({ ...draft, wechatOfficialToken: event.target.value })}
                  aria-label={t('channels.verificationToken', 'Verification Token')}
                  className={INPUT_CLASS}
                />
                <p className="mt-2 text-[11px] leading-5 text-text-muted">{t('channels.wechatOfficialTokenHint', 'Token configured in the WeChat Official Account console for callback verification.')}</p>
              </label>
            </EditorSection>
          )}

          {draft.platform === 'custom' && (
            <EditorSection
              eyebrow={t('channels.customChannel', 'Custom Channel')}
              title={t('channels.customDelivery', 'Custom Delivery')}
              description={t('channels.customDeliveryHint', 'Define how outgoing replies leave the workspace when you are integrating a platform that is not built in.')}
            >
              <label className="block">
                <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.outgoingWebhookUrl', 'Outgoing Webhook URL')}</span>
                <input
                  type="text"
                  value={draft.customWebhookUrl || ''}
                  onChange={(event) => setDraft({ ...draft, customWebhookUrl: event.target.value })}
                  aria-label={t('channels.outgoingWebhookUrl', 'Outgoing Webhook URL')}
                  placeholder="https://your-api.example.com/send"
                  className={INPUT_CLASS}
                />
                <p className="mt-2 text-[11px] leading-5 text-text-muted">{t('channels.customWebhookUrlHint', 'Replies will be POSTed to this endpoint.')}</p>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.authHeaderName', 'Auth Header Name')}</span>
                  <input
                    type="text"
                    value={draft.customAuthHeader || ''}
                    onChange={(event) => setDraft({ ...draft, customAuthHeader: event.target.value })}
                    aria-label={t('channels.authHeaderName', 'Auth Header Name')}
                    placeholder={t('channels.authHeaderPlaceholder', 'e.g. Authorization, X-API-Key')}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.authHeaderValue', 'Auth Header Value')}</span>
                  <input
                    type="password"
                    value={draft.customAuthValue || ''}
                    onChange={(event) => setDraft({ ...draft, customAuthValue: event.target.value })}
                    aria-label={t('channels.authHeaderValue', 'Auth Header Value')}
                    placeholder={t('channels.authHeaderValuePlaceholder', 'e.g. Bearer your-token')}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.payloadTemplate', 'Payload Template (JSON)')}</span>
                <textarea
                  value={draft.customPayloadTemplate || '{\n  "chat_id": "{{chatId}}",\n  "text": "{{content}}"\n}'}
                  onChange={(event) => setDraft({ ...draft, customPayloadTemplate: event.target.value })}
                  aria-label={t('channels.payloadTemplate', 'Payload Template (JSON)')}
                  rows={6}
                  className={TEXTAREA_CLASS}
                />
                <p className="mt-2 text-[11px] leading-5 text-text-muted">{t('channels.payloadTemplateHint', 'Use {{content}} and {{chatId}} as placeholders inside the outgoing payload.')}</p>
              </label>
            </EditorSection>
          )}
        </div>

        <div className="space-y-6">
          <EditorSection
            eyebrow={t('channels.routing', 'Routing')}
            title={t('channels.replyRouting', 'Reply Routing')}
            description={t('channels.replyRoutingHint', 'Decide which agent owns the reply path for this channel and keep the handoff obvious for operators.')}
          >
            <label className="block">
              <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.replyAgent', 'Reply Agent')}</span>
              <select
                value={draft.replyAgentId}
                onChange={(event) => setDraft({ ...draft, replyAgentId: event.target.value })}
                aria-label={t('channels.replyAgent', 'Reply Agent')}
                className={INPUT_CLASS}
              >
                {selectableAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </label>

            <div className="rounded-3xl border border-border-subtle/45 bg-surface-0/55 p-4">
              <div className="text-[12px] font-medium text-text-primary">{selectedAgent?.name || t('common.noData', 'No agent selected')}</div>
              <p className="mt-2 text-[11px] leading-5 text-text-secondary/80">{t('channels.replyAgentHint', 'This agent will receive incoming channel messages and produce the outbound reply when auto reply is enabled.')}</p>
            </div>
          </EditorSection>

          <EditorSection
            eyebrow={t('channels.operations', 'Operations')}
            title={t('channels.deliveryStrategy', 'Delivery Strategy')}
            description={t('channels.deliveryStrategyHint', 'Review the route shape and whether this channel expects WebSocket streaming or a webhook callback.')}
          >
            <div className="rounded-3xl border border-border-subtle/45 bg-surface-0/55 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[12px] font-medium text-text-primary">{modeLabel}</div>
                  <p className="mt-1 text-[11px] leading-5 text-text-secondary/78">{draft.connectionMode === 'stream' ? t('channels.streamModeSummary', 'Best for always-on desktop integrations with no public ingress requirement.') : t('channels.webhookModeSummary', 'Use a callback route when the upstream platform must POST events into the workspace.')}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${draft.connectionMode === 'stream' ? 'bg-green-500/12 text-green-400' : 'bg-accent/12 text-accent'}`}>{modeLabel}</span>
              </div>
            </div>

            {draft.connectionMode !== 'stream' && (
              <div className="rounded-3xl border border-border-subtle/45 bg-surface-0/55 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-medium text-text-primary">{t('channels.webhookPath', 'Webhook Path')}</div>
                    <p className="mt-1 text-[11px] leading-5 text-text-secondary/78">{t('channels.webhookPathHint', 'The local channel server exposes this path once the webhook runtime is started.')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(draft.webhookPath).catch(() => {})}
                    className="rounded-xl border border-accent/18 bg-accent/10 px-3 py-2 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/18"
                  >
                    <span className="inline-flex items-center gap-1.5"><IconifyIcon name="ui-clipboard" size={13} color="currentColor" /> {t('common.copy', 'Copy')}</span>
                  </button>
                </div>
                <code className="mt-3 block break-all rounded-2xl bg-surface-3/60 px-3 py-2 text-xs text-accent">{draft.webhookPath}</code>
              </div>
            )}
          </EditorSection>

          <EditorSection
            eyebrow={t('channels.activation', 'Activation')}
            title={t('channels.runtimeSwitches', 'Runtime Switches')}
            description={t('channels.runtimeSwitchesHint', 'Keep auto reply and channel availability independent so you can stage a channel before fully enabling it.')}
          >
            <label className={`block cursor-pointer rounded-3xl border p-4 transition-colors ${draft.autoReply ? 'border-accent/20 bg-accent/8' : 'border-border-subtle/45 bg-surface-0/55 hover:bg-surface-2/60'}`}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={draft.autoReply}
                  onChange={(event) => setDraft({ ...draft, autoReply: event.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-border-subtle text-accent focus:ring-2 focus:ring-accent/20"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-text-primary">{t('channels.enableAutoReply', 'Enable Auto Reply')}</div>
                  <div className="mt-1 text-[12px] leading-6 text-text-secondary/80">{t('channels.enableAutoReplyHint', 'Automatically respond to inbound channel traffic through the selected reply agent.')}</div>
                </div>
              </div>
            </label>

            <label className={`block cursor-pointer rounded-3xl border p-4 transition-colors ${draft.enabled ? 'border-green-500/20 bg-green-500/8' : 'border-border-subtle/45 bg-surface-0/55 hover:bg-surface-2/60'}`}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-border-subtle text-accent focus:ring-2 focus:ring-accent/20"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-text-primary">{t('channels.enableChannel', 'Enable Channel')}</div>
                  <div className="mt-1 text-[12px] leading-6 text-text-secondary/80">{t('channels.enableChannelHint', 'Allow the integration to start receiving and processing traffic when the runtime is online.')}</div>
                </div>
              </div>
            </label>

            {!draft.enabled && (
              <div className="rounded-3xl border border-yellow-500/18 bg-yellow-500/8 p-4 text-[12px] leading-6 text-text-secondary/80">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary"><IconifyIcon name="ui-warning" size={14} color="currentColor" /> {t('channels.channelDisabledNotice', 'Channel is currently disabled')}</div>
                <p className="mt-2">{t('channels.channelDisabledNoticeHint', 'Keep the channel disabled while you are still staging credentials or testing delivery. You can enable it later without rebuilding the configuration.')}</p>
              </div>
            )}
          </EditorSection>
        </div>
      </div>
    </div>
  )
}
