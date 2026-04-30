# Suora Channel Integration Guide

Suora can route inbound messages from chat platforms into the desktop workbench and let a selected agent handle replies. This guide reflects the current channel system implemented in the application.

## Supported Platforms

The current channel editor supports these platforms:

| Platform | Code | Notes |
| --- | --- | --- |
| WeChat Work | `wechat` | Enterprise WeChat integration |
| WeChat Official Account | `wechat_official` | Public account callback flow |
| WeChat Mini Program | `wechat_miniprogram` | Mini program messaging flow |
| Feishu / Lark | `feishu` | Token and encrypt-key verification |
| DingTalk | `dingtalk` | Webhook or stream mode |
| Slack | `slack` | Bot token and signing secret |
| Telegram | `telegram` | Bot token from BotFather |
| Discord | `discord` | Bot token and application ID |
| Microsoft Teams | `teams` | App ID, password, and optional tenant |
| Custom Channel | `custom` | User-defined outbound webhook shape |

## Channel Concepts

Each channel record contains four groups of information:

1. Identity: channel name, platform, and optional custom branding.
2. Transport: webhook or stream delivery mode.
3. Credentials: platform-specific keys and secrets.
4. Behavior: enabled state, auto-reply, assigned reply agent, and allowed chat whitelist.

Suora also tracks runtime information per channel, including message count, last activity time, health checks, users, and debug history.

## Webhook vs Stream

Suora currently supports two transport modes:

| Mode | When to use it | Notes |
| --- | --- | --- |
| Webhook | Platforms that push HTTP callbacks to your desktop runtime | Requires the local channel server to be running and the callback URL to be reachable |
| Stream | Platforms that can keep a persistent live connection | Best when you do not want to expose a public inbound callback URL |

In the current UI, DingTalk exposes a first-class transport choice between `stream` and `webhook`. Other platforms primarily follow webhook-style configuration unless the platform runtime adds stream support behind the scenes.

## Typical Setup Flow

1. Open the Channels module and create a new channel.
2. Choose the platform and enter a descriptive channel name.
3. Select the reply agent that should answer inbound messages.
4. Choose the transport mode when the platform supports it.
5. Enter the required credentials for that platform.
6. Save the channel.
7. If the channel uses webhook delivery, start the local channel server and copy the generated callback URL into the upstream platform console.
8. Send a test message and inspect the Messages, Users, Health, and Debug tabs.

## Platform-Specific Fields

### Feishu / Lark

Recommended fields:

- `appId`
- `appSecret`
- `verificationToken`
- `encryptKey`

Use this when your Feishu bot must verify webhook traffic and decrypt payloads.

### DingTalk

Recommended fields:

- `appId`
- `appSecret`
- `connectionMode`

Choose `stream` when you want the desktop app to keep a live connection without exposing a public HTTP endpoint.

### WeChat Work / Official / Mini Program

Depending on the WeChat surface, you may need:

- `appId`
- `appSecret`
- verification token fields
- encrypt key fields

When using webhook delivery, configure the callback URL exactly as shown in the channel detail panel.

### Slack

Required fields normally include:

- `slackBotToken`
- `slackSigningSecret`

These allow Suora to verify inbound events and send replies as the bot.

### Telegram

Required field:

- `telegramBotToken`

Get the token from BotFather and paste it into the channel editor.

### Discord

Typical fields:

- `discordBotToken`
- `discordApplicationId`

These identify the bot runtime and enable outbound replies.

### Microsoft Teams

Typical fields:

- `teamsAppId`
- `teamsAppPassword`
- `teamsTenantId` (optional for single-tenant setups)

### Custom Channel

Custom channels are useful when you want to bridge Suora to an internal bot gateway or unsupported platform.

Current custom fields include:

- `customWebhookUrl`
- `customAuthHeader`
- `customAuthValue`
- `customPayloadTemplate`
- `customPlatformName`
- `customPlatformIcon`

The payload template can include placeholders such as `{{content}}` and `{{chatId}}`.

## Runtime Panels

The channel detail view includes these panels:

| Panel | Purpose |
| --- | --- |
| Config | Review the current platform, mode, agent assignment, auto-reply, and callback details |
| Messages | Inspect recent inbound and outbound traffic |
| Users | View tracked users per channel |
| Health | Review latency, last checks, and recent health signals |
| Debug | Inspect runtime diagnostics for failed or suspicious traffic |

## Safety and Routing

Channel behavior currently supports:

- Enabling or disabling the channel without deleting configuration
- Auto-reply on or off
- Binding one agent per channel as the reply owner
- Restricting inbound handling to allowed chat IDs
- Tracking channel health separately from enablement state

When troubleshooting, verify these items in order:

1. The channel is enabled.
2. The assigned agent still exists and is enabled.
3. The channel server is running for webhook-based channels.
4. The callback URL in the upstream platform exactly matches the URL shown by Suora.
5. Tokens, signing secrets, and encrypt keys are current.
6. The upstream chat ID is not blocked by `allowedChats`.

## Operational Advice

- Prefer stream mode when available and you do not want to expose a public callback endpoint.
- Use webhook mode when the platform requires HTTP callbacks.
- Start with one channel per agent use case so routing stays predictable.
- Use the Health and Debug tabs before rotating credentials.
- Keep webhook secrets and bot tokens in the channel config only; do not hard-code them in prompts or skill content.