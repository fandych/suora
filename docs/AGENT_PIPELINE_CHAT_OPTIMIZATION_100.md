# Agent / Pipeline / Chat 100 Optimization Points

Date: 2026-04-27

This audit covers Suora's agent selection, chat runtime, tool streaming, pipeline execution, and pipeline-in-chat command flow. The current pass completed the highest-impact runtime fixes: shared secret/path sanitization, cancellable chat-triggered pipelines, dry-run pipeline validation, bounded handoff/context pruning, structured tool output envelopes, runtime snapshots, agent diagnostics, agent auto-selection, improved command parsing, and regression tests.

## Completed In This Pass

- Shared sanitization now protects both chat tool errors and pipeline execution errors.
- Chat-triggered pipeline runs now receive an `AbortSignal`, so the stop button can cancel them.
- Pipeline execution now rejects blank enabled steps before calling the model.
- Pipeline handoff/reference text is bounded to reduce runaway context and renderer pressure.
- Pipeline step errors are sanitized before persistence and before reuse as downstream context.
- Pipeline step execution reads current agents/models from the store per step instead of relying only on the startup snapshot.
- Pipeline slash commands now support workflow aliases and explicit `/pipeline run <name>` style commands.
- Pipeline slash commands now support help, status, cancel, history, previews, and named run arguments.
- Agent profiles now surface prompt/model/skill/tool diagnostics and chat can auto-select a matching agent.
- Chat model history is token-budgeted, retry preserves attachments, and large tool results can be externalized to runtime artifacts.
- Run IDs and runtime snapshots are attached to chat messages and pipeline executions for traceability.
- Tests cover cancellation, validation, redaction, command parsing aliases, diagnostics, scoring, and chat context pruning.

## 100 Optimization Points

### Chat Runtime

1. Add shared sanitization for tool and stream errors. Done.
2. Redact OpenAI, xAI, Google, bearer, API key, authorization, and token-shaped secrets. Done.
3. Redact Windows, UNC, and POSIX absolute paths before persistence. Done.
4. Keep persisted tool errors length-bounded. Done.
5. Use one stream flush interval constant consistently. Done.
6. Pass cancellation into chat-triggered pipeline execution. Done.
7. Keep stop-button behavior consistent between normal chat and pipeline chat. Done.
8. Ensure cancelled streaming assistant messages are marked non-streaming. Existing behavior retained.
9. Keep oversized tool outputs bounded in session state. Existing behavior retained.
10. Continue skipping error assistant messages when building model history. Existing behavior retained.
11. Clamp text attachments before sending to the model. Existing behavior retained.
12. Skip oversize image attachments before sending to the model. Existing behavior retained.
13. Preserve attachment metadata in user messages. Existing behavior retained.
14. Record token usage after streams finish. Existing behavior retained.
15. Record zero-token successful calls for usage history. Existing behavior retained.
16. Record agent performance after each chat turn. Existing behavior retained.
17. Keep inactivity timeout cleanup in `finally`. Existing behavior retained.
18. Improve retry-last-error to preserve attachments. Done.
19. Add model-history pruning by approximate token budget. Done.
20. Externalize very large tool outputs to disk. Done.
21. Add per-message cancellation metadata. Done.
22. Add stream health events for UI diagnostics in a future pass.
23. Add structured error categories to stored messages. Done.
24. Add explicit empty-response recovery UI in a future pass.
25. Add regression tests for `useAIChat` pipeline cancellation in a future pass.

### Pipeline Execution

26. Validate blank enabled steps before model calls. Done.
27. Bound explicit `{{steps[n].output}}` references. Done.
28. Bound implicit previous-step handoff context. Done.
29. Bound final constructed step input. Done.
30. Sanitize pipeline stream errors before recording. Done.
31. Sanitize caught provider/tool errors before persistence. Done.
32. Read agents and models from live store for each step. Done.
33. Preserve execution history persistence for saved pipelines. Existing behavior retained.
34. Preserve last-run metadata persistence for saved pipelines. Existing behavior retained.
35. Cache per-agent prompt/tool execution context during one run. Existing behavior retained.
36. Reuse initialized providers during one run. Existing behavior retained.
37. Respect disabled steps while maintaining downstream handoff context. Existing behavior retained.
38. Support retry count clamping. Existing behavior retained.
39. Stop remaining steps when `continueOnError` is false. Existing behavior retained.
40. Mark pre-run cancelled steps as errors. Existing behavior retained.
41. Pass abort signals into active LLM streams. Existing behavior retained.
42. Include attempt count in execution steps. Existing behavior retained.
43. Include duration in execution steps. Existing behavior retained.
44. Preserve step display names in history. Existing behavior retained.
45. Resolve pipeline by id, exact name, then partial name. Existing behavior retained.
46. Add ambiguous partial-name handling. Done.
47. Add dry-run validation for all saved pipelines. Done.
48. Add step-level timeout configuration. Done.
49. Add max-output-per-step configuration. Done.
50. Add conditional branch steps in a future pass.
51. Add parallel fan-out/fan-in steps in a future pass.
52. Add typed step outputs in a future pass.
53. Add pipeline variable schema validation in a future pass.
54. Add resumable failed-step reruns in a future pass.
55. Add pipeline execution diffing between runs in a future pass.

### Pipeline Chat Commands

56. Support `/workflow` aliases. Done.
57. Support `/pipeline run <name>` and `/workflow execute <name>`. Done.
58. Support natural-language list phrasing with pipeline/workflow catalog wording. Done.
59. Support Chinese list phrasing where the noun appears before the action. Done.
60. Clean leading run/pipeline verbs from slash references. Done.
61. Use exact mention fallback only when an action exists. Existing behavior retained.
62. Avoid hijacking general pipeline architecture questions. Existing behavior retained.
63. Sort mentioned pipelines by longest name first. Existing behavior retained.
64. Add fuzzy typo tolerance in a future pass.
65. Add ambiguity prompt when multiple pipelines match in a future pass.
66. Add localized command help in a future pass.
67. Add command preview before destructive/expensive runs. Done.
68. Add named argument parsing for pipeline inputs. Done.
69. Add `/pipeline history <name>`. Done.
70. Add `/pipeline cancel` command. Done.

### Agent Flow

71. Keep legacy agents with missing `enabled` usable. Existing behavior retained.
72. Normalize `maxTurns` to a safe lower bound. Existing behavior retained.
73. Use agent model preference when switching agents. Existing behavior retained.
74. Clear pinned session model when agent has no preferred model. Existing behavior retained.
75. Build system prompts from agent prompt, response style, memories, skills, tools, and permission mode. Existing behavior retained.
76. Keep built-in default assistant localized. Existing behavior retained.
77. Keep agent memory tool-based instead of keyword-based. Existing behavior retained.
78. Add agent prompt length warnings. Done.
79. Add skill conflict diagnostics. Done.
80. Add per-agent tool safety summary. Done.
81. Add agent version comparison UI in a future pass.
82. Add agent import validation in a future pass.
83. Add disabled-skill warning for assigned skills. Done.
84. Add agent auto-selection scoring. Done.
85. Add agent handoff recommendations in a future pass.

### UI, Observability, And Tests

86. Keep pipeline live progress visible from chat-triggered runs. Existing behavior retained.
87. Notify on pipeline completion/failure from chat. Existing behavior retained.
88. Keep pipeline builder cancellation on unmount. Existing behavior retained.
89. Keep pipeline history deep links supported. Existing behavior retained.
90. Keep Mermaid preview/source split. Existing behavior retained.
91. Add command parser tests for slash aliases. Done.
92. Add command parser tests for false positives. Done.
93. Add pipeline blank-step test. Done.
94. Add pipeline pre-run cancellation test. Done.
95. Add pipeline redaction test. Done.
96. Add direct sanitization utility tests. Done.
97. Add renderer hook tests for stream cancellation in a future pass.
98. Add Playwright test for running a pipeline from chat in a future pass.
99. Add performance benchmark for long tool streams in a future pass.
100. Add saved-pipeline migration test for legacy step fields in a future pass.

## Added Regression Coverage

- `pipelineChatCommands`: help, cancel, status, history, named args, aliases, natural-language runs, and false-positive protection.
- `agentPipelineService`: validation failure before model calls, ambiguous partial references, max-output truncation, cancellation, retries, redaction, and progress callbacks.
- `pipelineValidation`, `agentDiagnostics`, `agentSelection`, and `chatContext`: focused unit coverage for the new shared services.
