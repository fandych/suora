import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { IconPicker } from '@/components/icons/IconPicker'
import { useI18n } from '@/hooks/useI18n'
import type { ChannelConfig, ChannelConnectionMode, ChannelPlatform, EmailFilterRule, EmailAction, EmailFilterField, EmailFilterOperator, EmailActionType } from '@/types'
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
  const [wechatLoginBusy, setWechatLoginBusy] = useState(false)
  const [wechatLoginError, setWechatLoginError] = useState('')
  const [wechatVerifyRequired, setWechatVerifyRequired] = useState(false)
  const [wechatVerifyCode, setWechatVerifyCode] = useState('')
  const [wechatLoginSessionKey, setWechatLoginSessionKey] = useState('')
  const isValid = draft.name.trim().length > 0
  const selectableAgents = useMemo(
    () => agents.filter((agent) => agent.enabled !== false || agent.id === draft.replyAgentId),
    [agents, draft.replyAgentId],
  )
  const platformLabel = draft.platform === 'custom'
    ? draft.customPlatformName?.trim() || t('channels.customChannel', 'Custom Channel')
    : getPlatformDisplayName(draft.platform)
  const selectedAgent = agents.find((agent) => agent.id === draft.replyAgentId)
  const supportsAppCredentials = draft.platform === 'feishu' || draft.platform === 'dingtalk' || draft.platform === 'wechat' || draft.platform === 'wechat_official' || draft.platform === 'wechat_miniprogram'
  const modeLabel = draft.connectionMode === 'stream' ? t('channels.stream', 'Stream') : t('channels.webhook', 'Webhook')

  const handleSave = () => {
    setSaveError('')
    if (!isValid) {
      setSaveError(t('channels.channelNameRequired', 'Channel name is required'))
      return
    }
    onSave(draft)
  }

  const waitForWeChatLogin = useCallback(async (sessionKey: string, verifyCode?: string) => {
    setWechatLoginBusy(true)
    setWechatLoginError('')

    try {
      const result = await window.electron.invoke(
        'channel:wechatPersonalLoginWait',
        sessionKey,
        verifyCode,
        480000,
      ) as {
        success?: boolean
        status?: string
        message?: string
        qrCodeUrl?: string
        botToken?: string
        baseUrl?: string
        accountId?: string
        userId?: string
      }

      setWechatLoginBusy(false)
      if (result.qrCodeUrl) {
        setDraft((current) => ({
          ...current,
          wechatPersonalQrCodeUrl: result.qrCodeUrl,
        }))
      }

      if (result.status === 'connected' && result.botToken) {
        setWechatVerifyRequired(false)
        setWechatVerifyCode('')
        setWechatLoginError('')
        setDraft((current) => ({
          ...current,
          connectionMode: 'stream',
          wechatPersonalBindingStatus: 'bound',
          wechatPersonalBotToken: result.botToken,
          wechatPersonalBaseUrl: result.baseUrl,
          wechatPersonalAccountId: result.accountId,
          wechatPersonalUserId: result.userId,
        }))
        return
      }

      if (result.status === 'already_bound') {
        setWechatVerifyRequired(false)
        setWechatVerifyCode('')
        setDraft((current) => ({
          ...current,
          connectionMode: 'stream',
          wechatPersonalBindingStatus: current.wechatPersonalBotToken ? 'bound' : current.wechatPersonalBindingStatus || 'pending',
        }))
        return
      }

      if (result.status === 'need_verifycode') {
        setWechatVerifyRequired(true)
        setWechatLoginError(result.message || '')
        setDraft((current) => ({
          ...current,
          connectionMode: 'stream',
          wechatPersonalBindingStatus: 'pending',
        }))
        return
      }

      if (result.status === 'expired') {
        setWechatVerifyRequired(false)
        setWechatVerifyCode('')
        setWechatLoginError(result.message || '')
        setDraft((current) => ({
          ...current,
          connectionMode: 'stream',
          wechatPersonalBindingStatus: 'pending',
        }))
        return
      }

      if (result.status === 'timeout') {
        setWechatLoginError(result.message || '')
        return
      }

      setWechatVerifyRequired(false)
      setWechatLoginError(result.message || t('channels.wechatPersonalLoginFailed', 'WeChat binding failed.'))
    } catch (error) {
      setWechatLoginBusy(false)
      setWechatLoginError(error instanceof Error ? error.message : String(error))
    }
  }, [t])

  const handleStartWeChatLogin = useCallback(async () => {
    setWechatLoginBusy(true)
    setWechatLoginError('')
    setWechatVerifyRequired(false)
    setWechatVerifyCode('')

    try {
      const result = await window.electron.invoke('channel:wechatPersonalLoginStart', true) as {
        success?: boolean
        message?: string
        qrCodeUrl?: string
        sessionKey?: string
      }

      if (!result.success || !result.qrCodeUrl || !result.sessionKey) {
        setWechatLoginBusy(false)
        setWechatLoginError(result.message || t('channels.wechatPersonalQrFailed', 'Unable to create a WeChat QR code.'))
        return
      }

      setWechatLoginSessionKey(result.sessionKey)
      setDraft((current) => ({
        ...current,
        connectionMode: 'stream',
        wechatPersonalBindingStatus: 'pending',
        wechatPersonalQrCodeUrl: result.qrCodeUrl,
      }))
      void waitForWeChatLogin(result.sessionKey)
    } catch (error) {
      setWechatLoginBusy(false)
      setWechatLoginError(error instanceof Error ? error.message : String(error))
    }
  }, [t, waitForWeChatLogin])

  const handleSubmitWeChatVerifyCode = useCallback(() => {
    if (!wechatLoginSessionKey || !wechatVerifyCode.trim()) return
    void waitForWeChatLogin(wechatLoginSessionKey, wechatVerifyCode.trim())
  }, [wechatLoginSessionKey, wechatVerifyCode, waitForWeChatLogin])

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
                  onChange={(event) => {
                    const platform = event.target.value as ChannelPlatform
                    setDraft({
                      ...draft,
                      platform,
                      connectionMode: platform === 'wechat_personal' ? 'stream' : draft.connectionMode,
                    })
                  }}
                  aria-label={t('channels.platform', 'Platform')}
                  className={INPUT_CLASS}
                >
                  <optgroup label={t('channels.chinesePlatforms', 'Chinese Platforms')}>
                    <option value="feishu">{getPlatformDisplayName('feishu')}</option>
                    <option value="dingtalk">{getPlatformDisplayName('dingtalk')}</option>
                    <option value="wechat">{getPlatformDisplayName('wechat')}</option>
                    <option value="wechat_personal">{getPlatformDisplayName('wechat_personal')}</option>
                    <option value="wechat_official">{getPlatformDisplayName('wechat_official')}</option>
                    <option value="wechat_miniprogram">{getPlatformDisplayName('wechat_miniprogram')}</option>
                  </optgroup>
                  <optgroup label={t('channels.internationalPlatforms', 'International Platforms')}>
                    <option value="slack">{getPlatformDisplayName('slack')}</option>
                    <option value="telegram">{getPlatformDisplayName('telegram')}</option>
                    <option value="discord">{getPlatformDisplayName('discord')}</option>
                    <option value="teams">{getPlatformDisplayName('teams')}</option>
                    <option value="email">{getPlatformDisplayName('email')}</option>
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

          {supportsAppCredentials && (
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
              eyebrow={getPlatformDisplayName('feishu')}
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
              eyebrow={getPlatformDisplayName('slack')}
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
                    placeholder={t('channels.slackBotTokenPlaceholder', 'xoxb-...')}
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
              eyebrow={getPlatformDisplayName('telegram')}
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
                  placeholder={t('channels.telegramBotTokenPlaceholder', '123456:ABC-DEF1234...')}
                  className={INPUT_CLASS}
                />
                <p className="mt-2 text-[11px] leading-5 text-text-muted">{t('channels.telegramBotTokenHint', 'Bot token from @BotFather on Telegram.')}</p>
              </label>
            </EditorSection>
          )}

          {draft.platform === 'discord' && (
            <EditorSection
              eyebrow={getPlatformDisplayName('discord')}
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
              eyebrow={getPlatformDisplayName('teams')}
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
              eyebrow={getPlatformDisplayName('wechat_official')}
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

          {draft.platform === 'wechat_personal' && (
            <EditorSection
              eyebrow={getPlatformDisplayName('wechat_personal')}
              title={t('channels.wechatPersonalBridge', 'Personal WeChat Login')}
              description={t('channels.wechatPersonalBridgeHint', 'Generate a QR code, scan it in WeChat, and Suora will store the personal WeChat bot credentials for direct inbound polling and outbound replies.')}
            >
              <div className="rounded-3xl border border-accent/16 bg-accent/8 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-text-primary">{t('channels.wechatPersonalQuickBind', 'Direct QR binding')}</div>
                    <p className="mt-1 text-[12px] leading-6 text-text-secondary/80">{t('channels.wechatPersonalQuickBindHint', 'Use the Tencent OpenClaw-style QR login flow to bind a personal WeChat account without an external bridge service.')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleStartWeChatLogin()}
                    disabled={wechatLoginBusy}
                    className="rounded-2xl border border-accent/18 bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <IconifyIcon name="action-scan" size={14} color="currentColor" />
                      {wechatLoginBusy
                        ? t('channels.wechatPersonalBindingInProgress', 'Waiting for scan…')
                        : draft.wechatPersonalBotToken
                          ? t('channels.wechatPersonalRebind', 'Rebind WeChat')
                          : t('channels.wechatPersonalStartBinding', 'Generate QR Code')}
                    </span>
                  </button>
                </div>
                {wechatLoginError && <p className="mt-3 text-[12px] leading-5 text-amber-400">{wechatLoginError}</p>}
                {wechatVerifyRequired && (
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                    <label className="block">
                      <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.wechatPersonalVerifyCode', 'Pairing Code')}</span>
                      <input
                        type="text"
                        value={wechatVerifyCode}
                        onChange={(event) => setWechatVerifyCode(event.target.value)}
                        aria-label={t('channels.wechatPersonalVerifyCode', 'Pairing Code')}
                        placeholder={t('channels.wechatPersonalVerifyCodePlaceholder', 'Enter the digits shown in WeChat')}
                        className={INPUT_CLASS}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleSubmitWeChatVerifyCode}
                      disabled={wechatLoginBusy || !wechatVerifyCode.trim()}
                      className="self-end rounded-2xl border border-accent/18 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/18 disabled:opacity-50"
                    >
                      {t('channels.wechatPersonalSubmitVerifyCode', 'Submit Code')}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.wechatPersonalQrCodeUrl', 'QR Code URL')}</span>
                  <input
                    type="text"
                    value={draft.wechatPersonalQrCodeUrl || ''}
                    onChange={(event) => setDraft({ ...draft, wechatPersonalQrCodeUrl: event.target.value })}
                    aria-label={t('channels.wechatPersonalQrCodeUrl', 'QR Code URL')}
                    placeholder={t('channels.wechatPersonalQrCodePlaceholder', 'Generated after clicking “Generate QR Code”')}
                    className={INPUT_CLASS}
                  />
                  <p className="mt-2 text-[11px] leading-5 text-text-muted">{t('channels.wechatPersonalQrCodeHint', 'Suora fills this with the latest QR image URL so the operator can scan and bind the account.')}</p>
                </label>
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.wechatPersonalBindingStatus', 'Binding Status')}</span>
                  <select
                    value={draft.wechatPersonalBindingStatus || 'unbound'}
                    onChange={(event) => setDraft({ ...draft, wechatPersonalBindingStatus: event.target.value as ChannelConfig['wechatPersonalBindingStatus'] })}
                    aria-label={t('channels.wechatPersonalBindingStatus', 'Binding Status')}
                    className={INPUT_CLASS}
                  >
                    <option value="unbound">{t('channels.bindingStatusUnbound', 'Not bound')}</option>
                    <option value="pending">{t('channels.bindingStatusPending', 'Waiting for scan')}</option>
                    <option value="bound">{t('channels.bindingStatusBound', 'Bound')}</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.wechatPersonalBaseUrl', 'API Base URL')}</span>
                  <input
                    type="text"
                    value={draft.wechatPersonalBaseUrl || ''}
                    onChange={(event) => setDraft({ ...draft, wechatPersonalBaseUrl: event.target.value })}
                    aria-label={t('channels.wechatPersonalBaseUrl', 'API Base URL')}
                    placeholder={t('channels.wechatPersonalBaseUrlPlaceholder', 'Defaults to https://ilinkai.weixin.qq.com')}
                    className={INPUT_CLASS}
                  />
                  <p className="mt-2 text-[11px] leading-5 text-text-muted">{t('channels.wechatPersonalBaseUrlHint', 'Override this only if your personal WeChat backend uses a different compatible API host.')}</p>
                </label>
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.wechatPersonalAccountId', 'Bound Account ID')}</span>
                  <input
                    type="text"
                    value={draft.wechatPersonalAccountId || ''}
                    onChange={(event) => setDraft({ ...draft, wechatPersonalAccountId: event.target.value })}
                    aria-label={t('channels.wechatPersonalAccountId', 'Bound Account ID')}
                    placeholder={t('channels.wechatPersonalAccountIdPlaceholder', 'Filled automatically after a successful QR login')}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.wechatPersonalBotToken', 'Bot Token')}</span>
                  <input
                    type="password"
                    value={draft.wechatPersonalBotToken || ''}
                    onChange={(event) => setDraft({ ...draft, wechatPersonalBotToken: event.target.value })}
                    aria-label={t('channels.wechatPersonalBotToken', 'Bot Token')}
                    placeholder={t('channels.wechatPersonalBotTokenPlaceholder', 'Filled automatically after a successful QR login')}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.wechatPersonalUserId', 'Last User ID')}</span>
                  <input
                    type="text"
                    value={draft.wechatPersonalUserId || ''}
                    onChange={(event) => setDraft({ ...draft, wechatPersonalUserId: event.target.value })}
                    aria-label={t('channels.wechatPersonalUserId', 'Last User ID')}
                    placeholder={t('channels.wechatPersonalUserIdPlaceholder', 'Filled after the QR login flow reports a user ID')}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.wechatPersonalWebhookUrl', 'Outgoing Webhook URL')}</span>
                  <input
                    type="text"
                    value={draft.wechatPersonalWebhookUrl || ''}
                    onChange={(event) => setDraft({ ...draft, wechatPersonalWebhookUrl: event.target.value })}
                    aria-label={t('channels.wechatPersonalWebhookUrl', 'Outgoing Webhook URL')}
                    placeholder={t('channels.wechatPersonalWebhookPlaceholder', 'https://bridge.example.com/wechat/send')}
                    className={INPUT_CLASS}
                  />
                  <p className="mt-2 text-[11px] leading-5 text-text-muted">{t('channels.wechatPersonalWebhookHint', 'Optional fallback bridge endpoint. Leave blank when you use the built-in QR login flow.')}</p>
                </label>
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.wechatPersonalAuthToken', 'Bridge Auth Token')}</span>
                  <input
                    type="password"
                    value={draft.wechatPersonalAuthToken || ''}
                    onChange={(event) => setDraft({ ...draft, wechatPersonalAuthToken: event.target.value })}
                    aria-label={t('channels.wechatPersonalAuthToken', 'Bridge Auth Token')}
                    placeholder={t('channels.wechatPersonalAuthTokenPlaceholder', 'Optional bearer or shared token')}
                    className={INPUT_CLASS}
                  />
                  <p className="mt-2 text-[11px] leading-5 text-text-muted">{t('channels.wechatPersonalAuthTokenHint', 'Used only when the optional fallback bridge endpoint requires bearer authentication.')}</p>
                </label>
              </div>

              {draft.wechatPersonalQrCodeUrl ? (
                <div className="rounded-3xl border border-border-subtle/45 bg-surface-0/55 p-4">
                  <div className="text-[12px] font-medium text-text-primary">{t('channels.wechatPersonalScanTitle', 'Scan to bind')}</div>
                  <p className="mt-1 text-[11px] leading-5 text-text-secondary/78">{t('channels.wechatPersonalScanHint', 'Open WeChat on the target account, scan this QR code, and keep this editor open until Suora finishes the binding flow.')}</p>
                  <img
                    src={draft.wechatPersonalQrCodeUrl}
                    alt={t('channels.wechatPersonalQrPreview', 'Personal WeChat QR')}
                    className="mt-4 h-48 w-48 rounded-3xl border border-border-subtle/55 bg-white object-contain p-3 shadow-sm"
                  />
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-border-subtle/55 bg-surface-0/40 p-4 text-[12px] leading-6 text-text-secondary/80">
                  {t('channels.wechatPersonalAwaitingQr', 'Add the bridge QR code URL to preview the binding code here for operators.')}
                </div>
              )}
            </EditorSection>
          )}

          {draft.platform === 'email' && (
            <EmailChannelConfig draft={draft} setDraft={setDraft} t={t} INPUT_CLASS={INPUT_CLASS} />
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
                  placeholder={t('channels.customWebhookUrlPlaceholder', 'https://your-api.example.com/send')}
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

// ─── Email Channel Configuration Sub-component ──────────────────────

function EmailChannelConfig({
  draft,
  setDraft,
  t,
  INPUT_CLASS,
}: {
  draft: ChannelConfig
  setDraft: (d: ChannelConfig) => void
  t: (key: string, fallback: string) => string
  INPUT_CLASS: string
}) {
  const filters = draft.emailFilters || []
  const actions = draft.emailActions || []

  const addFilter = () => {
    const newFilter: EmailFilterRule = {
      id: crypto.randomUUID(),
      field: 'subject',
      operator: 'contains',
      value: '',
      enabled: true,
    }
    setDraft({ ...draft, emailFilters: [...filters, newFilter] })
  }

  const updateFilter = (id: string, updates: Partial<EmailFilterRule>) => {
    setDraft({
      ...draft,
      emailFilters: filters.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })
  }

  const removeFilter = (id: string) => {
    setDraft({ ...draft, emailFilters: filters.filter((f) => f.id !== id) })
  }

  const addAction = () => {
    const newAction: EmailAction = {
      id: crypto.randomUUID(),
      type: 'auto_reply',
      enabled: true,
      useAgent: true,
    }
    setDraft({ ...draft, emailActions: [...actions, newAction] })
  }

  const updateAction = (id: string, updates: Partial<EmailAction>) => {
    setDraft({
      ...draft,
      emailActions: actions.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })
  }

  const removeAction = (id: string) => {
    setDraft({ ...draft, emailActions: actions.filter((a) => a.id !== id) })
  }

  const FILTER_FIELDS: { value: EmailFilterField; label: string }[] = [
    { value: 'subject', label: t('channels.emailFilterSubject', 'Subject') },
    { value: 'from', label: t('channels.emailFilterFrom', 'From') },
    { value: 'to', label: t('channels.emailFilterTo', 'To') },
    { value: 'cc', label: t('channels.emailFilterCc', 'CC') },
    { value: 'body', label: t('channels.emailFilterBody', 'Body') },
    { value: 'has_attachment', label: t('channels.emailFilterHasAttachment', 'Has Attachment') },
  ]

  const FILTER_OPERATORS: { value: EmailFilterOperator; label: string }[] = [
    { value: 'contains', label: t('channels.emailOpContains', 'Contains') },
    { value: 'not_contains', label: t('channels.emailOpNotContains', 'Not Contains') },
    { value: 'equals', label: t('channels.emailOpEquals', 'Equals') },
    { value: 'starts_with', label: t('channels.emailOpStartsWith', 'Starts With') },
    { value: 'ends_with', label: t('channels.emailOpEndsWith', 'Ends With') },
    { value: 'regex', label: t('channels.emailOpRegex', 'Regex') },
    { value: 'is_true', label: t('channels.emailOpIsTrue', 'Is True') },
  ]

  const ACTION_TYPES: { value: EmailActionType; label: string }[] = [
    { value: 'auto_reply', label: t('channels.emailActionAutoReply', 'Auto Reply') },
    { value: 'forward', label: t('channels.emailActionForward', 'Forward') },
    { value: 'label', label: t('channels.emailActionLabel', 'Label / Tag') },
    { value: 'agent_process', label: t('channels.emailActionAgentProcess', 'Agent Process') },
    { value: 'webhook', label: t('channels.emailActionWebhook', 'Webhook') },
  ]

  return (
    <>
      <EditorSection
        eyebrow={t('channels.emailImap', 'IMAP')}
        title={t('channels.emailImapConfig', 'IMAP Configuration')}
        description={t('channels.emailImapConfigHint', 'Configure the IMAP server to monitor incoming emails. The channel will periodically poll the mailbox for new messages matching your filter rules.')}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.emailImapHost', 'IMAP Host')}</span>
            <input
              type="text"
              value={draft.emailImapHost || ''}
              onChange={(e) => setDraft({ ...draft, emailImapHost: e.target.value })}
              placeholder={t('channels.emailImapHostPlaceholder', 'e.g. imap.gmail.com')}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.emailImapPort', 'IMAP Port')}</span>
            <input
              type="number"
              value={draft.emailImapPort || 993}
              onChange={(e) => setDraft({ ...draft, emailImapPort: parseInt(e.target.value) || 993 })}
              className={INPUT_CLASS}
            />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.emailImapUser', 'Username / Email')}</span>
            <input
              type="text"
              value={draft.emailImapUser || ''}
              onChange={(e) => setDraft({ ...draft, emailImapUser: e.target.value })}
              placeholder={t('channels.emailImapUserPlaceholder', 'your@email.com')}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.emailImapPassword', 'Password')}</span>
            <input
              type="password"
              value={draft.emailImapPassword || ''}
              onChange={(e) => setDraft({ ...draft, emailImapPassword: e.target.value })}
              placeholder={t('channels.emailImapPasswordPlaceholder', 'App password or IMAP password')}
              className={INPUT_CLASS}
            />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.emailImapMailbox', 'Mailbox')}</span>
            <input
              type="text"
              value={draft.emailImapMailbox || 'INBOX'}
              onChange={(e) => setDraft({ ...draft, emailImapMailbox: e.target.value })}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.emailPollInterval', 'Poll Interval (seconds)')}</span>
            <input
              type="number"
              value={draft.emailPollInterval || 60}
              onChange={(e) => setDraft({ ...draft, emailPollInterval: Math.max(10, parseInt(e.target.value) || 60) })}
              min={10}
              className={INPUT_CLASS}
            />
          </label>
        </div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={draft.emailImapTls !== false}
            onChange={(e) => setDraft({ ...draft, emailImapTls: e.target.checked })}
            className="h-4 w-4 rounded border-border-subtle text-accent focus:ring-2 focus:ring-accent/20"
          />
          <span className="text-sm text-text-secondary">{t('channels.emailUseTls', 'Use TLS / SSL')}</span>
        </label>
      </EditorSection>

      <EditorSection
        eyebrow={t('channels.emailSmtp', 'SMTP')}
        title={t('channels.emailSmtpConfig', 'SMTP Configuration')}
        description={t('channels.emailSmtpConfigHint', 'Configure SMTP for sending reply emails. If not set, replies will use the IMAP credentials with common SMTP defaults.')}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.emailSmtpHost', 'SMTP Host')}</span>
            <input
              type="text"
              value={draft.emailSmtpHost || ''}
              onChange={(e) => setDraft({ ...draft, emailSmtpHost: e.target.value })}
              placeholder={t('channels.emailSmtpHostPlaceholder', 'e.g. smtp.gmail.com')}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.emailSmtpPort', 'SMTP Port')}</span>
            <input
              type="number"
              value={draft.emailSmtpPort || 465}
              onChange={(e) => setDraft({ ...draft, emailSmtpPort: parseInt(e.target.value) || 465 })}
              className={INPUT_CLASS}
            />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.emailSmtpUser', 'SMTP Username')}</span>
            <input
              type="text"
              value={draft.emailSmtpUser || ''}
              onChange={(e) => setDraft({ ...draft, emailSmtpUser: e.target.value })}
              placeholder={t('channels.emailSmtpUserPlaceholder', 'Leave blank to use IMAP username')}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.emailSmtpPassword', 'SMTP Password')}</span>
            <input
              type="password"
              value={draft.emailSmtpPassword || ''}
              onChange={(e) => setDraft({ ...draft, emailSmtpPassword: e.target.value })}
              placeholder={t('channels.emailSmtpPasswordPlaceholder', 'Leave blank to use IMAP password')}
              className={INPUT_CLASS}
            />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.emailFromName', 'From Name')}</span>
            <input
              type="text"
              value={draft.emailFromName || ''}
              onChange={(e) => setDraft({ ...draft, emailFromName: e.target.value })}
              placeholder={t('channels.emailFromNamePlaceholder', 'e.g. Support Bot')}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[12px] font-medium text-text-muted">{t('channels.emailFromAddress', 'From Address')}</span>
            <input
              type="text"
              value={draft.emailFromAddress || ''}
              onChange={(e) => setDraft({ ...draft, emailFromAddress: e.target.value })}
              placeholder={t('channels.emailFromAddressPlaceholder', 'Leave blank to use IMAP email')}
              className={INPUT_CLASS}
            />
          </label>
        </div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={draft.emailSmtpTls !== false}
            onChange={(e) => setDraft({ ...draft, emailSmtpTls: e.target.checked })}
            className="h-4 w-4 rounded border-border-subtle text-accent focus:ring-2 focus:ring-accent/20"
          />
          <span className="text-sm text-text-secondary">{t('channels.emailSmtpUseTls', 'Use TLS / SSL for SMTP')}</span>
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={draft.emailMarkAsRead !== false}
            onChange={(e) => setDraft({ ...draft, emailMarkAsRead: e.target.checked })}
            className="h-4 w-4 rounded border-border-subtle text-accent focus:ring-2 focus:ring-accent/20"
          />
          <span className="text-sm text-text-secondary">{t('channels.emailMarkAsRead', 'Mark processed emails as read')}</span>
        </label>
      </EditorSection>

      <EditorSection
        eyebrow={t('channels.emailFilters', 'Filters')}
        title={t('channels.emailFilterRules', 'Email Filter Rules')}
        description={t('channels.emailFilterRulesHint', 'Define rules to filter incoming emails. Only emails matching ALL enabled rules will be processed. Leave empty to process all incoming emails.')}
      >
        {filters.map((filter) => (
          <div key={filter.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border-subtle/45 bg-surface-0/55 p-3">
            <input
              type="checkbox"
              checked={filter.enabled}
              onChange={(e) => updateFilter(filter.id, { enabled: e.target.checked })}
              className="h-4 w-4 rounded border-border-subtle text-accent focus:ring-2 focus:ring-accent/20"
            />
            <select
              value={filter.field}
              onChange={(e) => updateFilter(filter.id, { field: e.target.value as EmailFilterField })}
              className="rounded-xl border border-border-subtle/55 bg-surface-2/80 px-2 py-1.5 text-xs text-text-primary"
            >
              {FILTER_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <select
              value={filter.operator}
              onChange={(e) => updateFilter(filter.id, { operator: e.target.value as EmailFilterOperator })}
              className="rounded-xl border border-border-subtle/55 bg-surface-2/80 px-2 py-1.5 text-xs text-text-primary"
            >
              {FILTER_OPERATORS.filter((op) => filter.field === 'has_attachment' ? op.value === 'is_true' : op.value !== 'is_true').map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            {filter.field !== 'has_attachment' && (
              <input
                type="text"
                value={filter.value}
                onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                placeholder={t('channels.emailFilterValuePlaceholder', 'Keyword or pattern...')}
                className="min-w-0 flex-1 rounded-xl border border-border-subtle/55 bg-surface-2/80 px-2 py-1.5 text-xs text-text-primary placeholder-text-muted/55"
              />
            )}
            <button
              type="button"
              onClick={() => removeFilter(filter.id)}
              className="rounded-lg p-1.5 text-text-muted hover:bg-red-500/12 hover:text-red-400"
            >
              <IconifyIcon name="ui-close" size={12} color="currentColor" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addFilter}
          className="rounded-2xl border border-dashed border-border-subtle/55 bg-surface-0/40 px-4 py-3 text-sm font-medium text-text-muted transition-colors hover:border-accent/30 hover:text-accent"
        >
          <span className="inline-flex items-center gap-1.5"><IconifyIcon name="ui-plus" size={14} color="currentColor" /> {t('channels.emailAddFilter', 'Add Filter Rule')}</span>
        </button>
      </EditorSection>

      <EditorSection
        eyebrow={t('channels.emailActionsLabel', 'Actions')}
        title={t('channels.emailActionsConfig', 'Email Actions')}
        description={t('channels.emailActionsConfigHint', 'Configure what happens when an email matches the filter rules. Multiple actions can be executed for each matched email.')}
      >
        {actions.map((action) => (
          <div key={action.id} className="space-y-3 rounded-2xl border border-border-subtle/45 bg-surface-0/55 p-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={action.enabled}
                onChange={(e) => updateAction(action.id, { enabled: e.target.checked })}
                className="h-4 w-4 rounded border-border-subtle text-accent focus:ring-2 focus:ring-accent/20"
              />
              <select
                value={action.type}
                onChange={(e) => updateAction(action.id, { type: e.target.value as EmailActionType })}
                className="rounded-xl border border-border-subtle/55 bg-surface-2/80 px-2 py-1.5 text-xs text-text-primary"
              >
                {ACTION_TYPES.map((at) => (
                  <option key={at.value} value={at.value}>{at.label}</option>
                ))}
              </select>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => removeAction(action.id)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-red-500/12 hover:text-red-400"
              >
                <IconifyIcon name="ui-close" size={12} color="currentColor" />
              </button>
            </div>

            {(action.type === 'auto_reply' || action.type === 'agent_process') && (
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={action.useAgent !== false}
                  onChange={(e) => updateAction(action.id, { useAgent: e.target.checked })}
                  className="h-4 w-4 rounded border-border-subtle text-accent focus:ring-2 focus:ring-accent/20"
                />
                <span className="text-xs text-text-secondary">{t('channels.emailUseAgent', 'Use channel reply agent to generate response')}</span>
              </label>
            )}

            {action.type === 'auto_reply' && !action.useAgent && (
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-text-muted">{t('channels.emailReplyTemplate', 'Reply Template')}</span>
                <textarea
                  value={action.replyTemplate || ''}
                  onChange={(e) => updateAction(action.id, { replyTemplate: e.target.value })}
                  placeholder={t('channels.emailReplyTemplatePlaceholder', 'Use {{subject}}, {{from}}, {{body}} as placeholders')}
                  rows={3}
                  className="w-full rounded-xl border border-border-subtle/55 bg-surface-2/80 px-3 py-2 font-mono text-xs text-text-primary placeholder-text-muted/55 focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </label>
            )}

            {action.type === 'forward' && (
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-text-muted">{t('channels.emailForwardTo', 'Forward To')}</span>
                <input
                  type="email"
                  value={action.forwardTo || ''}
                  onChange={(e) => updateAction(action.id, { forwardTo: e.target.value })}
                  placeholder={t('channels.emailForwardToPlaceholder', 'recipient@example.com')}
                  className={INPUT_CLASS}
                />
              </label>
            )}

            {action.type === 'label' && (
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-text-muted">{t('channels.emailLabelName', 'Label')}</span>
                <input
                  type="text"
                  value={action.label || ''}
                  onChange={(e) => updateAction(action.id, { label: e.target.value })}
                  placeholder={t('channels.emailLabelPlaceholder', 'e.g. processed, support')}
                  className={INPUT_CLASS}
                />
              </label>
            )}

            {action.type === 'webhook' && (
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-text-muted">{t('channels.emailWebhookUrl', 'Webhook URL')}</span>
                <input
                  type="text"
                  value={action.webhookUrl || ''}
                  onChange={(e) => updateAction(action.id, { webhookUrl: e.target.value })}
                  placeholder={t('channels.emailWebhookUrlPlaceholder', 'https://your-api.example.com/email-hook')}
                  className={INPUT_CLASS}
                />
              </label>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addAction}
          className="rounded-2xl border border-dashed border-border-subtle/55 bg-surface-0/40 px-4 py-3 text-sm font-medium text-text-muted transition-colors hover:border-accent/30 hover:text-accent"
        >
          <span className="inline-flex items-center gap-1.5"><IconifyIcon name="ui-plus" size={14} color="currentColor" /> {t('channels.emailAddAction', 'Add Action')}</span>
        </button>
      </EditorSection>
    </>
  )
}
