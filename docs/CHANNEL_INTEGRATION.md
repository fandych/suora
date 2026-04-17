# Channel Integration - WeChat, Feishu, DingTalk

Suora 支持通过手机端的钉钉、微信、飞书直接与桌面助理聊天，采用兼容 OpenClaw 的 channel 架构方案。

## 概述

Channel Integration 功能允许用户通过移动端应用（微信、飞书、钉钉）直接与桌面助理进行对话。系统通过 webhook 服务器接收来自这些平台的消息，并将回复发送回移动端。

### 核心特性

- **多平台支持**: 微信（企业微信）、飞书、钉钉
- **Webhook 服务器**: 内置 HTTP 服务器接收平台消息
- **签名验证**: 支持各平台的签名验证机制
- **自动回复**: 配置 Agent 自动处理和回复消息
- **消息路由**: 支持白名单控制，仅响应指定聊天/群组

## 架构设计

```
Mobile App (WeChat/Feishu/DingTalk)
         ↓
  Webhook (HTTP POST)
         ↓
Channel Service (Express Server)
         ↓
  Signature Verification
         ↓
Message Handler (Electron Main Process)
         ↓
Renderer Process → Agent → AI Response
         ↓
Send Reply (Platform API)
```

## 快速开始

### 1. 配置 Channel

在 Suora 中添加新的 Channel 配置：

```typescript
const channelConfig: ChannelConfig = {
  id: 'my-feishu-channel',
  name: '飞书工作群',
  platform: 'feishu',
  enabled: true,
  status: 'inactive',

  // Webhook 配置
  webhookPath: '/webhook/feishu/my-channel-id',
  webhookSecret: 'your-webhook-secret',

  // 平台配置
  appId: 'your-app-id',
  appSecret: 'your-app-secret',
  verificationToken: 'your-verification-token',
  encryptKey: 'your-encrypt-key',

  // 行为配置
  autoReply: true,
  replyAgentId: 'default-assistant',
  allowedChats: [],  // 空数组表示接受所有聊天

  // 统计信息
  createdAt: Date.now(),
  messageCount: 0,
}

// 添加到 store
useAppStore.getState().addChannel(channelConfig)
```

### 2. 启动 Webhook 服务器

通过工具或手动调用：

```typescript
// 方式 1: 使用 builtin-channels skill 工具
// Agent 可以调用 channel_start_server 工具

// 方式 2: 通过 IPC 直接调用
await window.electron.invoke('channel:start')
```

默认端口：`3000`（可通过环境变量 `CHANNEL_PORT` 修改）

### 3. 配置平台 Webhook

#### 飞书 (Feishu/Lark)

1. 进入飞书开放平台创建应用
2. 配置 Webhook URL: `http://your-domain:3000/webhook/feishu/your-channel-id`
3. 开启消息接收能力
4. 配置事件订阅：`im.message.receive_v1`
5. 保存 App ID、App Secret、Verification Token、Encrypt Key

**URL 验证**：首次配置时，飞书会发送 `url_verification` 事件，系统会自动返回 challenge 值完成验证。

#### 钉钉 (DingTalk)

1. 进入钉钉开放平台创建企业内部应用或机器人
2. 配置 Webhook URL: `http://your-domain:3000/webhook/dingtalk/your-channel-id`
3. 开启消息推送
4. 保存 App Key、App Secret

**签名验证**：钉钉使用 HMAC-SHA256 签名，系统会自动验证。

#### 企业微信 (WeChat Work)

1. 进入企业微信管理后台创建应用
2. 配置 Webhook URL: `http://your-domain:3000/webhook/wechat/your-channel-id`
3. 配置接收消息服务器
4. 保存 Token、EncodingAESKey

**URL 验证**：首次配置时，微信会发送 GET 请求带 echostr 参数，系统会自动返回。

## 平台特定配置

### 飞书消息格式

```json
{
  "header": {
    "event_type": "im.message.receive_v1",
    "event_id": "...",
    "create_time": "1612345678"
  },
  "event": {
    "sender": {
      "sender_id": {
        "user_id": "user-xxx",
        "union_id": "union-xxx"
      }
    },
    "message": {
      "message_id": "msg-xxx",
      "chat_id": "oc_xxx",
      "chat_type": "group",
      "content": "{\"text\":\"你好\"}"
    }
  }
}
```

### 钉钉消息格式

```json
{
  "msgtype": "text",
  "msgId": "msg-xxx",
  "createAt": 1612345678000,
  "conversationType": "2",
  "conversationId": "xxx",
  "senderId": "user-xxx",
  "senderNick": "张三",
  "text": {
    "content": "你好"
  }
}
```

### 企业微信消息格式

```xml
<xml>
  <ToUserName><![CDATA[toUser]]></ToUserName>
  <FromUserName><![CDATA[fromUser]]></FromUserName>
  <CreateTime>1348831860</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[你好]]></Content>
  <MsgId>1234567890123456</MsgId>
</xml>
```

## 安全性

### 签名验证

所有平台都支持签名验证，确保消息来自官方平台：

- **飞书**: SHA256(timestamp + nonce + encryptKey + body)
- **钉钉**: HMAC-SHA256(timestamp + "\n" + appSecret)
- **企业微信**: SHA1(sort([token, timestamp, nonce, body]))

### 白名单控制

通过 `allowedChats` 配置仅响应特定聊天/群组：

```typescript
{
  allowedChats: ['oc_xxx', 'oc_yyy']  // 仅响应这两个群组
}
```

### 端口安全

建议生产环境：
1. 使用反向代理（Nginx/Caddy）
2. 配置 HTTPS
3. 限制访问源 IP
4. 使用防火墙规则

## 使用示例

### 示例 1: 创建飞书工作助理

```typescript
// 1. 创建专门的飞书 Agent
const feishuAgent: Agent = {
  id: 'feishu-work-assistant',
  name: '飞书工作助理',
  avatar: '🤖',
  systemPrompt: '你是一个专业的工作助理，帮助用户处理日常工作任务。回复要简洁专业。',
  modelId: 'anthropic:claude-3-opus',
  skills: ['builtin-filesystem', 'builtin-shell', 'builtin-web', 'builtin-todo'],
  temperature: 0.7,
  maxTokens: 2048,
  enabled: true,
  autoLearn: true,
}

useAppStore.getState().addAgent(feishuAgent)

// 2. 创建 Channel 配置
const channel: ChannelConfig = {
  id: 'feishu-work',
  name: '飞书工作群',
  platform: 'feishu',
  enabled: true,
  status: 'inactive',
  webhookPath: '/webhook/feishu/work',
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET,
  verificationToken: process.env.FEISHU_VERIFICATION_TOKEN,
  encryptKey: process.env.FEISHU_ENCRYPT_KEY,
  autoReply: true,
  replyAgentId: 'feishu-work-assistant',
  allowedChats: ['oc_work_group_id'],
  createdAt: Date.now(),
  messageCount: 0,
}

useAppStore.getState().addChannel(channel)

// 3. 启动服务器
await window.electron.invoke('channel:start')
```

### 示例 2: 监听消息事件

```typescript
// 在 Renderer 进程中监听 channel 消息
window.electron.on('channel:message', (event, data) => {
  const { channel, message } = data
  console.log(`收到来自 ${channel.platform} 的消息:`, message.content)

  // 可以在这里触发特定逻辑
  // 例如：记录日志、触发通知等
})
```

### 示例 3: 主动发送消息

```typescript
// 通过 Agent 调用工具发送消息
// Agent 可以使用 channel_send_message 工具

// 或通过 IPC 直接调用
await window.electron.invoke('channel:sendMessage',
  'feishu-work',  // channelId
  'oc_xxx',       // chatId
  '任务已完成！'   // content
)
```

## 环境变量

```bash
# Webhook 服务器配置
CHANNEL_PORT=3000
WEBHOOK_HOST=your-domain.com
NODE_ENV=production

# 飞书配置
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_VERIFICATION_TOKEN=xxx
FEISHU_ENCRYPT_KEY=xxx

# 钉钉配置
DINGTALK_APP_KEY=xxx
DINGTALK_APP_SECRET=xxx

# 企业微信配置
WECHAT_CORP_ID=xxx
WECHAT_AGENT_ID=xxx
WECHAT_SECRET=xxx
```

## API 参考

### IPC Channels

#### `channel:start`
启动 webhook 服务器

**返回**: `{ success: boolean, message?: string, error?: string }`

#### `channel:stop`
停止 webhook 服务器

**返回**: `{ success: boolean, error?: string }`

#### `channel:status`
获取服务器状态

**返回**: `{ running: boolean }`

#### `channel:register`
注册 channels

**参数**: `channels: ChannelConfig[]`

**返回**: `{ success: boolean, error?: string }`

#### `channel:getWebhookUrl`
获取 webhook URL

**参数**: `channel: ChannelConfig`

**返回**: `{ success: boolean, url?: string, error?: string }`

#### `channel:sendMessage`
发送消息

**参数**: `channelId: string, chatId: string, content: string`

**返回**: `{ success: boolean, message?: string, error?: string }`

### Builtin Tools

#### `channel_start_server`
启动 channel webhook 服务器

#### `channel_stop_server`
停止 channel webhook 服务器

#### `channel_server_status`
检查 channel 服务器状态

#### `channel_send_message`
通过 channel 发送消息

**参数**:
- `channel_id`: Channel ID
- `chat_id`: 聊天/群组 ID
- `content`: 消息内容

## 故障排查

### 问题 1: Webhook URL 无法访问

**原因**: 防火墙或端口未开放

**解决**:
```bash
# 检查端口是否被占用
netstat -an | grep 3000

# 开放端口（Linux）
sudo ufw allow 3000

# 测试连接
curl http://localhost:3000/health
```

### 问题 2: 签名验证失败

**原因**: 配置错误或时间不同步

**解决**:
1. 确认 `appSecret`/`encryptKey` 配置正确
2. 检查服务器时间是否准确：`date`
3. 查看日志中的详细错误信息

### 问题 3: 消息无法接收

**原因**: Channel 未启用或 Agent 未配置

**解决**:
1. 确认 Channel `enabled: true`
2. 确认 `replyAgentId` 配置正确
3. 检查 `allowedChats` 白名单
4. 查看 Electron 主进程日志

### 问题 4: 生产环境部署

**推荐配置**:

```nginx
# Nginx 反向代理配置
server {
    listen 443 ssl;
    server_name webhook.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /webhook/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 最佳实践

1. **Agent 专用化**: 为不同平台创建专门的 Agent，调整 systemPrompt 和 temperature
2. **消息去重**: 某些平台可能重复发送消息，建议根据 messageId 去重
3. **异步处理**: AI 响应可能较慢，建议先返回 200 OK，然后异步发送回复
4. **错误处理**: 捕获并记录所有错误，避免服务器崩溃
5. **监控告警**: 配置日志监控和告警机制
6. **备份配置**: 定期备份 Channel 配置
7. **测试环境**: 先在测试环境验证，再部署生产

## 路线图

- [ ] 支持个人微信（通过 wechaty）
- [ ] 支持更多消息类型（图片、文件、语音）
- [ ] 支持群组 @ 提及过滤
- [ ] 添加消息队列处理
- [ ] 支持 Slack、Teams 等国际平台
- [ ] 可视化 Channel 配置界面
- [ ] 消息统计和分析面板

## 相关文档

- [CLAUDE.md](../CLAUDE.md) - 项目架构文档
- [FEATURES.md](../FEATURES.md) - 功能特性文档
- [飞书开放平台](https://open.feishu.cn/document/home/index)
- [钉钉开放平台](https://open.dingtalk.com/)
- [企业微信 API](https://developer.work.weixin.qq.com/)

## License

MIT
