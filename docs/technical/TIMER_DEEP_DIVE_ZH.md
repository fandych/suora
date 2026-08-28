# Suora Timer 技术深挖（30 个技术落点）

## 1. 路由与布局

1. Timer 的真实路由是 `/timer`。
2. 入口布局文件是 `src/components/timer/TimerLayout.tsx`。
3. 左侧列表承担搜索、选择和启停入口。
4. 右侧承载 `TimerForm` 与 `TimerDetail`。
5. `TimerAssistantDrawer` 负责 AI 创建交互面。

## 2. 状态与类型

6. 模块本地状态维护当前定时任务列表。
7. 模块本地状态维护选中项、编辑态与创建态。
8. 关键类型包括 `ScheduledTask`。
9. 定时器表单数据与运行态由辅助类型承载。
10. `agentPipelines` 会被加载供定时器选择 Pipeline 动作。

## 3. 运行链路

11. 主要通信通过 `electronInvoke`、`electronOn`、`electronOff` 完成。
12. 主进程事件 `timer:fired` 会驱动前端刷新。
13. `src/services/timerRuntime.ts` 承担触发后的运行处理。
14. Timer 不是纯 store 功能，而是真实 Electron 侧调度能力。
15. Run now 路径是人工验证自动化的关键手段。

## 4. 调度与动作现实

16. 当前调度类型包括 once、interval、cron。
17. 当前动作类型包括 notify、prompt、pipeline。
18. Prompt 动作会依赖 Agent 与 Models 状态。
19. Pipeline 动作会依赖已保存流水线与执行链路。
20. 机器休眠与时区会影响调度预期，应在文档中明确。

## 5. 风险与故障模式

21. 无人值守执行会放大配置错误。
22. 高频任务会放大成本与失败频率。
23. 任务已触发但无结果时往往要回查 Agent、Pipeline 或 Models。
24. 任务未触发时要先查调度规则和启用状态。
25. Timer 不应用作文意上的任意 OS 任务执行器。

## 6. 测试与修改检查

26. 附近测试锚点包括 `TimerLayout.test.tsx`。
27. 附近测试锚点包括 `timerRuntime.test.ts`。
28. 修改 Timer 时应优先验证创建、启停、Run now 和刷新链路。
29. 修改动作模型时应同步检查 Pipeline/Agent 依赖路径。
30. Timer 技术治理的目标是调度清楚、运行可查、风险可控、异常可恢复。