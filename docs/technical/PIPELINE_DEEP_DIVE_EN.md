# Suora Pipeline Technical Deep Dive (30 Technical Points)

## 1. Route and layout

1. The real Pipeline route is `/pipeline`.
2. The layout entry file is `src/components/pipeline/PipelineLayout.tsx`.
3. The layout combines editor, execution state, and history.
4. `PipelineFlowDiagram` provides Mermaid-oriented preview output.
5. `PipelineFlowCanvas` provides the flow-canvas surface.

## 2. State and types

6. Key state domains include `agentPipeline`.
7. Key state domains include `agentPipelineName`.
8. Key state domains include `selectedAgentPipelineId`.
9. Key state domains include `agentPipelines`.
10. Key types include `AgentPipeline`, `AgentPipelineStep`, `AgentPipelineExecution`, and `AgentPipelineVariable`.

## 3. Services and execution path

11. `src/services/agentPipelineService.ts` is the core execution service.
12. `src/services/pipelineValidation.ts` owns structural validation.
13. `src/services/pipelineMermaid.ts` owns Mermaid source generation.
14. `src/services/pipelineOptimization.ts` owns optimization suggestion generation.
15. Variable values are tracked separately from editor structure for runtime flexibility.

## 4. Persistence and portability

16. `src/services/pipelineFiles.ts` owns disk-backed save and load behavior.
17. `src/services/pipelinePortability.ts` owns import/export protocol behavior.
18. Pipeline is not just store state; it is a real file-backed asset.
19. Execution history is part of the design loop, not an optional appendix.
20. Step-schema and variable-format changes carry compatibility risk.

## 5. Risk and failure modes

21. The main risk surface is multi-step automated execution.
22. Budgets and retries are also safety controls.
23. Incorrect `runIf` logic can skip the wrong steps.
24. Fallback labels represent degraded execution paths and should be preserved.
25. Many pipeline failures root in Agents, Models, or tool-permission configuration.

## 6. Tests and change checks

26. Nearby tests include `PipelineLayout.test.tsx`.
27. Nearby tests include `agentPipelineService.test.ts`.
28. Nearby tests include `pipelineRunIf.test.ts`.
29. Pipeline changes should first validate save, dry-run, real execution, and history presentation.
30. The technical goal of Pipeline maintenance is structural stability, readable execution, traceable failure, and controllable cost.