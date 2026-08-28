# Timer Technical Index

1. Broad handbook (EN): [../MODULE_ARCHITECTURE_EN.md#7-timer](../MODULE_ARCHITECTURE_EN.md#7-timer)
2. Broad handbook (ZH): [../MODULE_ARCHITECTURE_ZH.md#7-timer](../MODULE_ARCHITECTURE_ZH.md#7-timer)
3. Deep dive (EN): [../TIMER_DEEP_DIVE_EN.md](../TIMER_DEEP_DIVE_EN.md)
4. Deep dive (ZH): [../TIMER_DEEP_DIVE_ZH.md](../TIMER_DEEP_DIVE_ZH.md)
5. 真实路由是 `/timer`。
6. 入口布局文件是 `src/components/timer/TimerLayout.tsx`。
7. 左侧承担搜索、选择与启停入口。
8. 右侧承载 `TimerForm` 与 `TimerDetail`。
9. `TimerAssistantDrawer` 提供 AI 创建路径。
10. 本地状态维护列表、选中项、编辑态与创建态。
11. 关键类型包括 `ScheduledTask`。
12. Timer 会加载 `agentPipelines` 供 Pipeline 动作使用。
13. 与 Electron 的通信通过 `electronInvoke` 和事件监听完成。
14. `timer:fired` 事件驱动前端刷新。
15. `src/services/timerRuntime.ts` 是触发后的运行锚点。
16. Timer 是真实 Electron 调度能力，不是纯 store 功能。
17. 当前调度类型包括 once、interval、cron。
18. 当前动作类型包括 notify、prompt、pipeline。
19. Prompt 动作依赖 Agent 和 Models。
20. Pipeline 动作依赖保存流水线与执行链路。
21. 机器休眠与时区会影响调度预期。
22. 无人值守执行会放大配置错误。
23. 高频任务会放大成本与失败频率。
24. 未触发任务先查调度规则和启用状态。
25. 附近测试包括 `TimerLayout.test.tsx`。
26. 附近测试包括 `timerRuntime.test.ts`。
27. 修改后优先验证创建、启停、Run now 与刷新链路。
28. 动作模型变化要同步检查 Pipeline/Agent 依赖。
29. 当前最好的深读入口是上面的 deep dive 文档。
30. 技术治理目标是调度清楚、运行可查、风险可控、异常可恢复。