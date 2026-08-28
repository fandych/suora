# Channels Technical Index

1. Broad handbook (EN): [../MODULE_ARCHITECTURE_EN.md#8-channels](../MODULE_ARCHITECTURE_EN.md#8-channels)
2. Broad handbook (ZH): [../MODULE_ARCHITECTURE_ZH.md#8-channels](../MODULE_ARCHITECTURE_ZH.md#8-channels)
3. Deep dive (EN): [../CHANNELS_DEEP_DIVE_EN.md](../CHANNELS_DEEP_DIVE_EN.md)
4. Deep dive (ZH): [../CHANNELS_DEEP_DIVE_ZH.md](../CHANNELS_DEEP_DIVE_ZH.md)
5. 真实路由是 `/channels`。
6. 入口布局文件是 `src/components/channels/ChannelLayout.tsx`。
7. 详情标签包括 config、messages、users、health、debug。
8. `ChannelEditor` 是主配置面板。
9. `ChannelPanels` 是主要观察面集合。
10. 主要状态域包括 `channels`。
11. 主要状态域包括 `channelMessages`。
12. 主要状态域包括 `channelHealth`。
13. 主要状态域包括 `channelUsers` 与 `channelTokens`。
14. `ChannelPlatform` 当前覆盖微信系、飞书、钉钉、Slack、Telegram、Discord、Teams、Email、Custom。
15. 前端运行锚点是 `src/services/channelMessageHandler.ts`。
16. Electron 运行锚点是 `electron/channelService.ts`。
17. webhook 状态与 URL 在前端可见。
18. stream 与 webhook 有不同外部暴露边界。
19. reply Agent 绑定决定下游角色归属。
20. `wechat_personal` 是独立平台类型。
21. Email 通道包含 IMAP/SMTP 与规则动作链。
22. Custom 通道依赖认证头与 payload 模板。
23. `allowedChats` 是重要安全边界。
24. `autoReply` 直接影响无人值守风险。
25. 附近测试包括 `ChannelEditor.test.tsx`。
26. 附近测试包括 `ChannelPanels.test.tsx`。
27. 附近测试包括 `channelMessageHandler.test.ts`。
28. 修改后优先验证配置切换、标签展示与运行观察面。
29. 当前最好的深读入口是上面的 deep dive 文档。
30. 技术治理目标是平台接入稳定、证据可查、权限边界清楚、自动回复可控。