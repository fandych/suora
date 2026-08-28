# Suora Pipeline 技术深挖（30 个技术落点）

## 1. 路由与布局

1. Pipeline 的真实路由是 `/pipeline`。
2. 入口布局文件是 `src/components/pipeline/PipelineLayout.tsx`。
3. 布局内同时包含编辑器、执行状态和历史面。
4. `PipelineFlowDiagram` 提供 Mermaid 级别预览。
5. `PipelineFlowCanvas` 提供流程画布承载面。

## 2. 状态与类型

6. 主要状态域包括 `agentPipeline`。
7. 主要状态域包括 `agentPipelineName`。
8. 主要状态域包括 `selectedAgentPipelineId`。
9. 主要状态域包括 `agentPipelines`。
10. 关键类型包括 `AgentPipeline`、`AgentPipelineStep`、`AgentPipelineExecution`、`AgentPipelineVariable`。

## 3. 服务与执行链路

11. `src/services/agentPipelineService.ts` 是执行主服务。
12. `src/services/pipelineValidation.ts` 负责结构校验。
13. `src/services/pipelineMermaid.ts` 负责 Mermaid 源生成。
14. `src/services/pipelineOptimization.ts` 负责优化建议构建。
15. 变量值与编辑结构分离是为了兼容运行时输入变化。

## 4. 持久化与可移植性

16. `src/services/pipelineFiles.ts` 负责磁盘读写。
17. `src/services/pipelinePortability.ts` 负责导入导出协议。
18. Pipeline 不只是 store 对象，而是真实文件资产。
19. 执行历史是设计闭环的一部分，而不是附属日志。
20. 步骤字段和变量协议的改动有兼容性风险。

## 5. 风险与故障模式

21. Pipeline 的主要风险来自多步自动执行面。
22. 预算与重试也是安全控制的一部分。
23. `runIf` 误设会造成步骤误跳过。
24. fallback 标签代表执行路径降级，应被记录与解释。
25. 复杂流程问题常常根源在 Agent、Models 或工具权限层。

## 6. 测试与修改检查

26. 附近测试锚点包括 `PipelineLayout.test.tsx`。
27. 附近测试锚点包括 `agentPipelineService.test.ts`。
28. 附近测试锚点包括 `pipelineRunIf.test.ts`。
29. 修改 Pipeline 时应优先验证保存、dry run、真实执行与历史展示。
30. Pipeline 技术治理的目标是结构稳定、运行可读、失败可回溯、成本可控制。