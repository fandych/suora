# Suora Agents 技术深挖（30 个技术落点）

## 1. 路由与布局

1. Agents 的真实路由是 `/agents`。
2. 入口布局文件是 `src/components/agents/AgentsLayout.tsx`。
3. 左侧列表承担搜索与切换职责。
4. 右侧编辑区承担配置、测试与编排职责。
5. `AgentTestChat` 是模块内验证闭环的一部分。

## 2. 状态与类型

6. 主要 store 域包括 `agents`。
7. 主要 store 域包括 `agentVersions`。
8. 主要 store 域包括 `agentPerformance`。
9. 主要 store 域包括 `globalMemories` 与 `agentSelectionPreferences`。
10. `Agent` 类型是真实运行配置，而不是简单描述对象。

## 3. 构建与运行链路

11. 内置 Agent 种子化逻辑位于 `src/store/appStore.ts`。
12. 本地化刷新逻辑同样在 store 中处理。
13. `agentCommunication.ts` 承担核心通信链路。
14. `agentSelection.ts` 承担选择相关运行逻辑。
15. `agentDiagnostics.ts` 提供诊断相关辅助。

## 4. 配置现实

16. Agent 配置包含 prompt、model、skills、tools、permission mode 等。
17. `maxTurns` 属于真实运行约束，不是装饰字段。
18. memories 与 autoLearn 会影响长期行为，不应轻视。
19. 技能绑定是上下文装配层，不是工具实现层。
20. 构建器 Agent 与业务 Agent 的角色边界必须被文档保留。

## 5. 风险与故障模式

21. 宽权限 Agent 是常见风险放大点。
22. 系统提示词写得过宽会放大误调用概率。
23. 测试聊天与真实聊天不一致时要排查会话上下文差异。
24. 导入外部 Agent 后需重新审查模型、技能和权限配置。
25. 版本快照是高风险修改的回退手段。

## 6. 测试与修改检查

26. 附近测试锚点包括 `AgentAssistantDrawer.test.tsx`。
27. 附近测试锚点包括 `SystemPromptMarkdownEditor.test.tsx`。
28. 附近测试锚点包括 `agentCommunication.test.ts`。
29. 修改 Agents 时应优先验证编辑、快照、测试聊天和技能绑定。
30. Agents 技术治理的目标是角色清楚、配置可解释、权限收敛、版本可回退。