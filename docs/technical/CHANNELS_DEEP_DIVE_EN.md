# Suora Channels Technical Deep Dive (30 Technical Points)

## 1. Route and layout

1. The real Channels route is `/channels`.
2. The layout entry file is `src/components/channels/ChannelLayout.tsx`.
3. Detail tabs include config, messages, users, health, and debug.
4. `ChannelEditor` is the main configuration surface.
5. `ChannelPanels` provides the runtime observation surfaces.

## 2. State and types

6. Key store domains include `channels`.
7. Key store domains include `channelMessages`.
8. Key store domains include `channelHealth`.
9. Key store domains include `channelUsers` and `channelTokens`.
10. `ChannelPlatform` currently includes WeChat variants, Feishu, DingTalk, Slack, Telegram, Discord, Teams, Email, and Custom.

## 3. Runtime path

11. Renderer-side behavior is anchored in `src/services/channelMessageHandler.ts`.
12. Electron-side behavior is anchored in `electron/channelService.ts`.
13. Webhook service state and callback URLs are visible from the UI.
14. Stream and webhook modes have different exposure and routing boundaries.
15. Reply-agent binding defines downstream role ownership for inbound traffic.

## 4. Platform reality

16. `wechat_personal` is its own platform type and must not be flattened into enterprise WeChat.
17. The Email channel includes IMAP, SMTP, filters, and action chains rather than plain message routing only.
18. Custom channels rely on auth headers and payload templates.
19. `allowedChats` is a key safety boundary.
20. `autoReply` directly changes unattended-reply risk.

## 5. Risk and failure modes

21. Platform credentials and mailbox passwords are high-sensitivity configuration objects.
22. Inbound-success but reply-failure states require both platform-side and model-side checks.
23. Webhook problems often come from mismatched callback URLs or secrets.
24. Stream problems often come from connection state and authentication edges.
25. The Debug tab is a primary failure-localization surface.

## 6. Tests and change checks

26. Nearby tests include `ChannelEditor.test.tsx`.
27. Nearby tests include `ChannelPanels.test.tsx`.
28. Nearby tests include `channelMessageHandler.test.ts`.
29. Channels changes should first validate configuration switching, tab behavior, and runtime observation surfaces.
30. The technical goal of Channels maintenance is stable integration, observable evidence, explicit safety boundaries, and controlled automation.