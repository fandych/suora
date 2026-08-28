# Pipeline Technical Index

1. Broad handbook (EN): [../MODULE_ARCHITECTURE_EN.md#3-pipeline](../MODULE_ARCHITECTURE_EN.md#3-pipeline)
2. Broad handbook (ZH): [../MODULE_ARCHITECTURE_ZH.md#3-pipeline](../MODULE_ARCHITECTURE_ZH.md#3-pipeline)
3. Deep dive (EN): [../PIPELINE_DEEP_DIVE_EN.md](../PIPELINE_DEEP_DIVE_EN.md)
4. Deep dive (ZH): [../PIPELINE_DEEP_DIVE_ZH.md](../PIPELINE_DEEP_DIVE_ZH.md)
5. 真实路由是 `/pipeline`。
6. 入口布局文件是 `src/components/pipeline/PipelineLayout.tsx`。
7. Mermaid 承载面包括 `PipelineFlowDiagram`。
8. 流程画布承载面包括 `PipelineFlowCanvas`。
9. 主要状态域包括 `agentPipeline`。
10. 主要状态域包括 `agentPipelineName`、`selectedAgentPipelineId`、`agentPipelines`。
11. 关键类型包括 `AgentPipeline`。
12. 关键类型包括 `AgentPipelineStep`。
13. 关键类型包括 `AgentPipelineExecution` 和 `AgentPipelineVariable`。
14. 核心执行服务是 `src/services/agentPipelineService.ts`。
15. 结构校验服务是 `src/services/pipelineValidation.ts`。
16. Mermaid 源生成服务是 `src/services/pipelineMermaid.ts`。
17. 优化建议服务是 `src/services/pipelineOptimization.ts`。
18. 磁盘读写由 `src/services/pipelineFiles.ts` 承担。
19. 导入导出协议由 `src/services/pipelinePortability.ts` 承担。
20. Pipeline 不只是 store 对象，而是文件化资产。
21. 主要风险来自多步自动执行面。
22. 预算和重试也是安全控制。
23. `runIf` 误设会造成步骤误跳过。
24. fallback 标签代表执行路径降级。
25. 附近测试包括 `PipelineLayout.test.tsx`。
26. 附近测试包括 `agentPipelineService.test.ts`。
27. 附近测试包括 `pipelineRunIf.test.ts`。
28. 修改后优先验证保存、dry run、真实运行和历史展示。
29. 当前最好的深读入口是上面的 deep dive 文档。
30. 技术治理目标是结构稳定、运行可读、失败可回溯、成本可控制。