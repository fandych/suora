import { useState } from 'react'
import { ICON_DATA } from '@/components/icons/IconifyIcons'
import { IconPicker } from '@/components/icons/IconPicker'
import type { ChannelConfig, ChannelConnectionMode, ChannelPlatform } from '@/types'

export function ChannelEditor({
  channel,
  agents,
  isNew,
  onSave,
  onCancel,
}: {
  channel: ChannelConfig
  agents: { id: string; name: string; avatar?: string }[]
  isNew: boolean
  onSave: (ch: ChannelConfig) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<ChannelConfig>({ ...channel })
  const [saveError, setSaveError] = useState('')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const isValid = draft.name.trim().length > 0

  const handleSave = () => {
    setSaveError('')
    if (!isValid) {
      setSaveError('Channel name is required')
      return
    }
    onSave(draft)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-13 px-6 flex items-center justify-between border-b border-border-subtle shrink-0">
        <h2 className="text-sm font-semibold text-text-primary">
          {isNew ? 'New Channel' : `Edit: ${channel.name}`}
        </h2>
        <div className="flex items-center gap-2">
          {saveError && <span className="text-xs text-red-400">{saveError}</span>}
          <button onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-surface-2 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSave}
            disabled={!isValid}
            className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50">
            Save
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Name</label>
          <input type="text" value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            aria-label="Channel name"
            className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Platform</label>
          <select value={draft.platform}
            onChange={(e) => setDraft({ ...draft, platform: e.target.value as ChannelPlatform })}
            aria-label="Platform"
            className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors">
            <optgroup label="Chinese Platforms">
              <option value="feishu">飞书 Feishu / Lark</option>
              <option value="dingtalk">钉钉 DingTalk</option>
              <option value="wechat">企业微信 WeChat Work</option>
              <option value="wechat_official">微信公众号 WeChat Official</option>
              <option value="wechat_miniprogram">微信小程序 WeChat Mini Program</option>
            </optgroup>
            <optgroup label="International Platforms">
              <option value="slack">Slack</option>
              <option value="telegram">Telegram</option>
              <option value="discord">Discord</option>
              <option value="teams">Microsoft Teams</option>
            </optgroup>
            <optgroup label="Other">
              <option value="custom">Custom Channel</option>
            </optgroup>
          </select>
        </div>
        {(draft.platform === 'feishu' || draft.platform === 'dingtalk' || draft.platform === 'wechat' || draft.platform === 'wechat_official' || draft.platform === 'wechat_miniprogram') && (
          <>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">App ID</label>
              <input type="text" value={draft.appId || ''}
                onChange={(e) => setDraft({ ...draft, appId: e.target.value })}
                className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                placeholder="Your application ID" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">App Secret</label>
              <input type="password" value={draft.appSecret || ''}
                onChange={(e) => setDraft({ ...draft, appSecret: e.target.value })}
                className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                placeholder="Your application secret" />
            </div>
          </>
        )}
        {draft.platform === 'dingtalk' && (
          <div className="p-4 bg-surface-2/50 rounded-lg border border-border-subtle space-y-4">
            <p className="text-xs font-medium text-text-secondary">DingTalk Configuration</p>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Connection Mode</label>
              <select value={draft.connectionMode || 'webhook'}
                onChange={(e) => setDraft({ ...draft, connectionMode: e.target.value as ChannelConnectionMode })}
                aria-label="Connection mode"
                className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors">
                <option value="stream">Stream Mode (WebSocket long connection, recommended)</option>
                <option value="webhook">Webhook Mode (HTTP callback)</option>
              </select>
              <p className="text-[10px] text-text-muted mt-1.5">
                {(draft.connectionMode || 'webhook') === 'stream'
                  ? 'Stream mode uses WebSocket — no public IP needed. Ideal for desktop apps.'
                  : 'Webhook mode requires a public URL for DingTalk to send callbacks to.'}
              </p>
            </div>
          </div>
        )}
        {draft.platform === 'feishu' && (
          <div className="p-4 bg-surface-2/50 rounded-lg border border-border-subtle space-y-4">
            <p className="text-xs font-medium text-text-secondary">Feishu Configuration</p>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Verification Token</label>
              <input type="text" value={draft.verificationToken || ''}
                onChange={(e) => setDraft({ ...draft, verificationToken: e.target.value })}
                aria-label="Verification token"
                className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Encrypt Key</label>
              <input type="password" value={draft.encryptKey || ''}
                onChange={(e) => setDraft({ ...draft, encryptKey: e.target.value })}
                aria-label="Encrypt key"
                className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
            </div>
          </div>
        )}
        {draft.platform === 'slack' && (
          <div className="p-4 bg-surface-2/50 rounded-lg border border-border-subtle space-y-4">
            <p className="text-xs font-medium text-text-secondary">Slack Configuration</p>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Bot Token</label>
              <input type="password" value={draft.slackBotToken || ''}
                onChange={(e) => setDraft({ ...draft, slackBotToken: e.target.value })}
                aria-label="Slack bot token"
                placeholder="xoxb-..."
                className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
              <p className="text-[10px] text-text-muted mt-1.5">Bot User OAuth Token from your Slack App settings</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Signing Secret</label>
              <input type="password" value={draft.slackSigningSecret || ''}
                onChange={(e) => setDraft({ ...draft, slackSigningSecret: e.target.value })}
                aria-label="Slack signing secret"
                className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
              <p className="text-[10px] text-text-muted mt-1.5">Used to verify incoming webhook requests from Slack</p>
            </div>
          </div>
        )}
        {draft.platform === 'telegram' && (
          <div className="p-4 bg-surface-2/50 rounded-lg border border-border-subtle space-y-4">
            <p className="text-xs font-medium text-text-secondary">Telegram Configuration</p>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Bot Token</label>
              <input type="password" value={draft.telegramBotToken || ''}
                onChange={(e) => setDraft({ ...draft, telegramBotToken: e.target.value })}
                aria-label="Telegram bot token"
                placeholder="123456:ABC-DEF1234..."
                className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
              <p className="text-[10px] text-text-muted mt-1.5">Bot token from @BotFather on Telegram</p>
            </div>
          </div>
        )}
        {draft.platform === 'discord' && (
          <div className="p-4 bg-surface-2/50 rounded-lg border border-border-subtle space-y-4">
            <p className="text-xs font-medium text-text-secondary">Discord Configuration</p>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Bot Token</label>
              <input type="password" value={draft.discordBotToken || ''}
                onChange={(e) => setDraft({ ...draft, discordBotToken: e.target.value })}
                aria-label="Discord bot token"
                className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
              <p className="text-[10px] text-text-muted mt-1.5">Bot token from the Discord Developer Portal</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Application ID</label>
              <input type="text" value={draft.discordApplicationId || ''}
                onChange={(e) => setDraft({ ...draft, discordApplicationId: e.target.value })}
                aria-label="Discord application ID"
                className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
              <p className="text-[10px] text-text-muted mt-1.5">Your Discord application ID</p>
            </div>
          </div>
        )}
        {draft.platform === 'teams' && (
          <div className="p-4 bg-surface-2/50 rounded-lg border border-border-subtle space-y-4">
            <p className="text-xs font-medium text-text-secondary">Microsoft Teams Configuration</p>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">App ID</label>
              <input type="text" value={draft.teamsAppId || ''}
                onChange={(e) => setDraft({ ...draft, teamsAppId: e.target.value })}
                aria-label="Teams app ID"
                className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
              <p className="text-[10px] text-text-muted mt-1.5">Microsoft App ID from Azure Bot registration</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">App Password</label>
              <input type="password" value={draft.teamsAppPassword || ''}
                onChange={(e) => setDraft({ ...draft, teamsAppPassword: e.target.value })}
                aria-label="Teams app password"
                className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
              <p className="text-[10px] text-text-muted mt-1.5">Client secret from Azure Bot registration</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Tenant ID (optional)</label>
              <input type="text" value={draft.teamsTenantId || ''}
                onChange={(e) => setDraft({ ...draft, teamsTenantId: e.target.value })}
                aria-label="Teams tenant ID"
                className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
              <p className="text-[10px] text-text-muted mt-1.5">Azure AD Tenant ID for single-tenant apps (leave empty for multi-tenant)</p>
            </div>
          </div>
        )}
        {draft.platform === 'wechat_official' && (
          <div className="p-4 bg-surface-2/50 rounded-lg border border-border-subtle space-y-4">
            <p className="text-xs font-medium text-text-secondary">WeChat Official Account Configuration</p>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Verification Token</label>
              <input type="text" value={draft.wechatOfficialToken || ''}
                onChange={(e) => setDraft({ ...draft, wechatOfficialToken: e.target.value })}
                aria-label="WeChat Official verification token"
                className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
              <p className="text-[10px] text-text-muted mt-1.5">Token configured in the WeChat Official Account management portal for message verification</p>
            </div>
          </div>
        )}
        {draft.platform === 'custom' && (
          <div className="p-4 bg-surface-2/50 rounded-lg border border-border-subtle space-y-4">
            <p className="text-xs font-medium text-text-secondary">Custom Channel Configuration</p>
            <p className="text-[10px] text-text-muted leading-relaxed">
              Define your own channel integration. Incoming messages are received via webhook at the standard endpoint.
              Configure how outgoing (reply) messages are sent below.
            </p>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Platform Name</label>
              <input type="text" value={draft.customPlatformName || ''}
                onChange={(e) => setDraft({ ...draft, customPlatformName: e.target.value })}
                aria-label="Custom platform name"
                placeholder="e.g., LINE, WhatsApp, My Bot"
                className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Platform Icon</label>
              <div className="flex gap-2">
                <input type="text" value={draft.customPlatformIcon || ''}
                  onChange={(e) => setDraft({ ...draft, customPlatformIcon: e.target.value })}
                  aria-label="Custom platform icon"
                  placeholder="e.g., mdi:chat, lucide:bot"
                  className="flex-1 px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
                <button
                  type="button"
                  onClick={() => setShowIconPicker(true)}
                  className="px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-xs text-text-secondary hover:bg-surface-2 hover:text-accent transition-colors shrink-0"
                >
                  Browse
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
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Outgoing Webhook URL</label>
              <input type="text" value={draft.customWebhookUrl || ''}
                onChange={(e) => setDraft({ ...draft, customWebhookUrl: e.target.value })}
                aria-label="Custom webhook URL"
                placeholder="https://your-api.example.com/send"
                className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
              <p className="text-[10px] text-text-muted mt-1.5">URL where outgoing (reply) messages will be POSTed</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Auth Header Name</label>
              <input type="text" value={draft.customAuthHeader || ''}
                onChange={(e) => setDraft({ ...draft, customAuthHeader: e.target.value })}
                aria-label="Custom auth header"
                placeholder="e.g., Authorization, X-API-Key"
                className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Auth Header Value</label>
              <input type="password" value={draft.customAuthValue || ''}
                onChange={(e) => setDraft({ ...draft, customAuthValue: e.target.value })}
                aria-label="Custom auth value"
                placeholder="e.g., Bearer your-token"
                className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Payload Template (JSON)</label>
              <textarea value={draft.customPayloadTemplate || '{\n  "chat_id": "{{chatId}}",\n  "text": "{{content}}"\n}'}
                onChange={(e) => setDraft({ ...draft, customPayloadTemplate: e.target.value })}
                aria-label="Custom payload template"
                rows={5}
                className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-xs text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
              <p className="text-[10px] text-text-muted mt-1.5">
                Use <code className="px-1 py-0.5 bg-surface-3 rounded text-[9px]">{'{{content}}'}</code> and <code className="px-1 py-0.5 bg-surface-3 rounded text-[9px]">{'{{chatId}}'}</code> as placeholders
              </p>
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Reply Agent</label>
          <select value={draft.replyAgentId}
            onChange={(e) => setDraft({ ...draft, replyAgentId: e.target.value })}
            aria-label="Reply agent"
            className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors">
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>{ICON_DATA[agent.avatar || ''] ? '●' : (agent.avatar || '●')} {agent.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-3 p-4 bg-surface-2/50 rounded-lg border border-border-subtle">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input type="checkbox" checked={draft.autoReply}
              onChange={(e) => setDraft({ ...draft, autoReply: e.target.checked })}
              className="w-4 h-4 rounded border-border-subtle text-accent focus:ring-2 focus:ring-accent/20" />
            <div className="flex-1">
              <div className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">Enable Auto Reply</div>
              <div className="text-xs text-text-muted">Automatically respond to incoming messages</div>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input type="checkbox" checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-border-subtle text-accent focus:ring-2 focus:ring-accent/20" />
            <div className="flex-1">
              <div className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">Enable Channel</div>
              <div className="text-xs text-text-muted">Activate this channel integration</div>
            </div>
          </label>
        </div>
      </div>
    </div>
  )
}
