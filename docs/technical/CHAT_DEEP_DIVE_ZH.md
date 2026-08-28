# Suora Chat 技术深挖（30 个技术落点）

## 1. 路由与装载

1. Chat 的真实路由是 `/chat`。
2. 入口布局文件是 `src/components/chat/ChatLayout.tsx`。
3. `ChatLayout` 负责会话侧栏与主聊天区的拼装。
4. 会话侧栏通过 `lazy` 延迟装载。
5. `scheduleAfterPaint` 用于在首屏绘制后再展开侧栏内容。

## 2. 组件结构

6. `SessionList` 负责会话轨列表。
7. `ChatMain` 承担大部分聊天行为复杂度。
8. `ResizeHandle` 负责会话侧栏宽度调整。
9. `useResizablePanel` 把宽度状态持久化为模块偏好。
10. 骨架态侧栏避免了首屏闪烁与空布局跳动。

## 3. 状态与类型

11. Chat 主要消费 `sessions` 状态域。
12. Chat 主要消费 `activeSession` 状态域。
13. Chat 主要消费 `sessionTabs` 状态域。
14. Chat 同时依赖 `selectedModel`、`agents`、`skills`。
15. 关键共享类型来自 `src/types/` 中的 `Session`、消息类型、`Agent`、`Model`。

## 4. 服务与运行链路

16. `src/hooks/useAIChat.ts` 是聊天 AI 交互的主要入口。
17. `src/services/aiService.ts` 是模型调用抽象层。
18. Slash 或控制命令通过命令分发服务进入聊天链路。
19. 工具调用与结果事件由服务层回传给聊天 UI。
20. Chat 不是独立岛，而是全局工作台执行面。

## 5. 安全与失败模式

21. 工具权限同时受 Agent 配置与全局安全策略约束。
22. Secure Storage 异常会直接影响 Chat 的密钥可持续性。
23. 回复失败先应分辨 provider 问题与上下文问题。
24. 工具异常先应分辨权限问题与环境问题。
25. 会话污染是 Chat 常见的逻辑故障源，而不是 UI 故障源。

## 6. 测试与修改检查

26. 附近测试锚点包括 `ChatMain.test.tsx`。
27. 附近测试锚点包括 `ChatMessages.test.tsx`。
28. 附近测试锚点包括 `SessionList.test.tsx`。
29. 修改 Chat 时应优先验证消息发送、会话切换和工具事件。
30. Chat 技术治理的目标是执行链路清楚、权限边界明确、失败可快速定位。