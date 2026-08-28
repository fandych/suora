# Agents Technical Index

1. Broad handbook (EN): [../MODULE_ARCHITECTURE_EN.md#5-agents](../MODULE_ARCHITECTURE_EN.md#5-agents)
2. Broad handbook (ZH): [../MODULE_ARCHITECTURE_ZH.md#5-agents](../MODULE_ARCHITECTURE_ZH.md#5-agents)
3. Deep dive (EN): [../AGENTS_DEEP_DIVE_EN.md](../AGENTS_DEEP_DIVE_EN.md)
4. Deep dive (ZH): [../AGENTS_DEEP_DIVE_ZH.md](../AGENTS_DEEP_DIVE_ZH.md)
5. 真实路由是 `/agents`。
6. 入口布局文件是 `src/components/agents/AgentsLayout.tsx`。
7. 左侧列表承担搜索与切换。
8. 右侧编辑区承担配置、测试和编排。
9. `AgentTestChat` 是模块内验证闭环。
10. 主要状态域包括 `agents`。
11. 主要状态域包括 `agentVersions`。
12. 主要状态域包括 `agentPerformance`。
13. 主要状态域包括 `globalMemories` 与 `agentSelectionPreferences`。
14. `Agent` 类型是真实运行配置对象。
15. 内置 Agent 种子化逻辑位于 `src/store/appStore.ts`。
16. 本地化刷新逻辑同样在 store 层完成。
17. 核心通信服务是 `src/services/agentCommunication.ts`。
18. 选择逻辑锚点是 `src/services/agentSelection.ts`。
19. 诊断锚点是 `src/services/agentDiagnostics.ts`。
20. Agent 配置包含 prompt、model、skills、tools、permission mode 等。
21. `maxTurns`、memories、autoLearn 都是运行边界的一部分。
22. 技能绑定是上下文装配层，不是工具实现层。
23. 宽权限 Agent 是常见风险放大点。
24. 版本快照是高风险修改的回退手段。
25. 附近测试包括 `AgentAssistantDrawer.test.tsx`。
26. 附近测试包括 `SystemPromptMarkdownEditor.test.tsx`。
27. 附近测试包括 `agentCommunication.test.ts`。
28. 修改后优先验证编辑、测试聊天、快照和技能绑定。
29. 当前最好的深读入口是上面的 deep dive 文档。
30. 技术治理目标是角色清楚、配置可解释、权限收敛、版本可回退。