# Suora Channels 技术深挖（30 个技术落点）

## 1. 路由与布局

1. Channels 的真实路由是 `/channels`。
2. 入口布局文件是 `src/components/channels/ChannelLayout.tsx`。
3. 详情标签包括 config、messages、users、health、debug。
4. `ChannelEditor` 是配置主面板。
5. `ChannelPanels` 提供消息、用户、健康和调试观察面。

## 2. 状态与类型

6. 主要 store 域包括 `channels`。
7. 主要 store 域包括 `channelMessages`。
8. 主要 store 域包括 `channelHealth`。
9. 主要 store 域包括 `channelUsers` 与 `channelTokens`。
10. `ChannelPlatform` 当前覆盖微信、飞书、钉钉、Slack、Telegram、Discord、Teams、Email、Custom 等。

## 3. 运行链路

11. 前端运行行为锚点是 `src/services/channelMessageHandler.ts`。
12. Electron 侧运行锚点是 `electron/channelService.ts`。
13. webhook 服务状态与 URL 由前端可见。
14. stream 模式与 webhook 模式有不同的外部暴露边界。
15. reply Agent 绑定决定了渠道消息的下游执行角色。

## 4. 平台现实

16. `wechat_personal` 是单独的平台类型，不应和企业微信混写。
17. Email 通道包含 IMAP/SMTP 与规则动作链，不是普通文本消息通道。
18. Custom 通道依赖认证头与 payload 模板。
19. 白名单 `allowedChats` 是重要安全边界。
20. `autoReply` 开关直接影响无人值守回复风险。

## 5. 风险与故障模式

21. 平台凭据与邮箱口令都是高敏感配置。
22. 消息能收不能回时要同时排查平台侧和模型侧。
23. webhook 模式问题常出在回调 URL/secret 不一致。
24. stream 模式问题常出在连接状态与认证链路。
25. Debug 面板是渠道故障定位的关键观察面。

## 6. 测试与修改检查

26. 附近测试锚点包括 `ChannelEditor.test.tsx`。
27. 附近测试锚点包括 `ChannelPanels.test.tsx`。
28. 附近测试锚点包括 `channelMessageHandler.test.ts`。
29. 修改 Channels 时应优先验证配置切换、标签展示与运行观察面。
30. Channels 技术治理的目标是平台接入稳定、证据可查、权限边界清楚、自动回复可控。