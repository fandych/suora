# Chat Technical Index

1. Broad handbook (EN): [../MODULE_ARCHITECTURE_EN.md#1-chat](../MODULE_ARCHITECTURE_EN.md#1-chat)
2. Broad handbook (ZH): [../MODULE_ARCHITECTURE_ZH.md#1-chat](../MODULE_ARCHITECTURE_ZH.md#1-chat)
3. Deep dive (EN): [../CHAT_DEEP_DIVE_EN.md](../CHAT_DEEP_DIVE_EN.md)
4. Deep dive (ZH): [../CHAT_DEEP_DIVE_ZH.md](../CHAT_DEEP_DIVE_ZH.md)
5. 真实路由是 `/chat`。
6. 入口布局文件是 `src/components/chat/ChatLayout.tsx`。
7. 主行为入口是 `src/components/chat/ChatMain.tsx`。
8. 会话轨由 `SessionList` 提供。
9. 侧栏宽度通过 `useResizablePanel` 管理。
10. 首屏后侧栏通过延迟装载完成补全。
11. 主要状态域包括 `sessions`。
12. 主要状态域包括 `activeSession`。
13. 主要状态域包括 `sessionTabs`。
14. 同时依赖 `selectedModel`、`agents`、`skills`。
15. 关键 AI 入口是 `src/hooks/useAIChat.ts`。
16. 模型调用抽象位于 `src/services/aiService.ts`。
17. Slash 指令经命令分发服务进入聊天链路。
18. 工具事件会回传到 Chat UI。
19. Chat 是工作台执行面，不是孤立功能页。
20. 主要风险来自工具调用、附件和宽权限 Agent。
21. Secure Storage 警告会直接影响密钥持久化体验。
22. 常见失败模式包括 provider 故障与上下文污染。
23. 工具异常要先区分权限问题和环境问题。
24. 附近测试包括 `ChatMain.test.tsx`。
25. 附近测试包括 `ChatMessages.test.tsx`。
26. 附近测试包括 `SessionList.test.tsx`。
27. 修改前先确认路由、store 域和主服务入口。
28. 修改后先验证消息发送、会话切换和工具事件展示。
29. 当前最好的深读入口是上面的 deep dive 文档。
30. 技术治理目标是执行链路清楚、权限边界明确、失败快速定位。