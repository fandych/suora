# Agent / Pipeline / Chat 执行能力提升 100 点清单

日期：2026-04-27

## 审计范围

本清单基于当前 Suora 项目的 agent、pipeline、chat 关键实现梳理，重点关注“执行能力”而不是单纯 UI 美化。主要参考落点：

- `src/hooks/useAIChat.ts`：聊天发送、流式输出、工具事件、pipeline chat 命令入口、取消与重试。
- `src/services/aiService.ts`：AI SDK v6 provider 初始化、streamText/fullStream 事件桥接、错误分类、usage 统计。
- `src/services/agentPipelineService.ts`：pipeline 步骤执行、上下文交接、模板引用、重试、持久化。
- `src/services/pipelineChatCommands.ts`：自然语言与 slash pipeline 命令解析。
- `src/services/tools.ts`：内置工具、权限、沙箱、技能 prompt 注入、memory/vector 工具。
- `src/services/agentCommunication.ts`：agent-to-agent delegation。
- `src/components/chat/ChatMain.tsx`、`src/components/pipeline/PipelineLayout.tsx`、`src/components/agents/AgentsLayout.tsx`：用户执行面、进度反馈、agent/pipeline 管理。
- `docs/AGENT_PIPELINE_CHAT_OPTIMIZATION_100.md`：已有修复与待办基线。

## 优先级定义

- P0：直接影响执行成功率、安全、取消、上下文爆炸、不可恢复错误。
- P1：显著提升复杂任务完成率、可观测性、可调试性、用户控制感。
- P2：提升长期可维护性、规模化、评估和生态能力。

## 100 个优化点

### 一、Chat Runtime 与上下文治理

1. P0：为模型历史增加近似 token budget 裁剪，而不只按消息全量传递，避免长会话直接拖垮 provider。
2. P0：把 tool result 从普通聊天上下文中分层，只把摘要和必要结构喂给模型，完整结果外置保存。
3. P0：为用户附件建立 manifest + 内容摘要机制，重复文件不反复注入全文。
4. P0：补齐 `retryLastError` 对附件的保留，避免带文件/图片的失败重试丢上下文。
5. P1：增加会话自动压缩策略，把早期多轮对话压缩成可追溯摘要。
6. P1：为每轮请求保存 runtime snapshot，包括 agent、model、tool allowlist、system prompt hash，方便复现失败。
7. P1：给取消的 assistant message 增加明确 metadata，例如 cancelledAt、cancelReason、partialContentLength。
8. P1：建立 chat input 预检：空输入、超大附件、模型不支持图片/音频、无 workspace 权限时提前提示。
9. P1：对 user message title 生成增加语言与长度策略，避免只截前 30 字导致多会话难辨认。
10. P2：支持从任意 assistant message 分叉新会话，保留到该点的上下文而不是只 regenerate。

### 二、Agent 路由、配置与能力选择

11. P0：实现 agent auto-selection scoring，利用 `whenToUse`、技能、当前任务关键词、历史成功率选择最适合 agent。
12. P0：当当前 agent 缺少必要工具权限时，给出可执行修复建议，而不是让模型调用失败后才暴露问题。
13. P0：为 agent prompt 增加长度与冲突 lint，提示 system prompt、skills、memories 总上下文风险。
14. P1：为 agent 增加“能力画像”面板：可用工具、禁用工具、技能摘要、权限模式、模型偏好。
15. P1：为 agent 配置增加 dry-run validate，检查 modelId 是否存在、skills 是否启用、tool 名称是否有效。
16. P1：引入 agent 选择器的最近使用/成功率排序，减少复杂任务选错 agent。
17. P1：agent version diff UI 不只保存快照，还展示 system prompt、tools、skills、model 的差异。
18. P1：agent 测试面板支持多条标准测试用例批量跑，输出成功率与失败样例。
19. P2：为 agent 增加 lightweight eval dataset，每个 agent 可绑定典型任务和期望行为。
20. P2：支持 agent 推荐 handoff，例如当前任务更适合另一个 agent 时给出切换建议。

### 三、Skill / Tool 调用质量与安全

21. P0：所有 tool output 增加统一的结构化 envelope：status、summary、dataRef、warnings、durationMs。
22. P0：长 tool output 外置到 workspace/session 文件，并在聊天中保存引用，避免 Zustand/session 膨胀。
23. P0：为每个工具增加 timeout 与 abort 透传，确保 stop 按钮能真正终止长任务。
24. P0：权限确认对话显示真实风险摘要、目标路径、命令参数，而不只是 action 文本。
25. P1：给工具增加 retry policy 元数据，只对网络/临时错误重试，不对写文件/发邮件类副作用重试。
26. P1：利用 `ToolMeta.isConcurrencySafe` 建立工具调度器，允许安全读操作并发，写操作串行。
27. P1：为工具调用结果增加可复制、可展开、可下载的 UI，不把所有内容塞入气泡。
28. P1：工具 schema 校验失败时把 zod/AI SDK 错误转成用户可理解的参数提示。
29. P1：工具调用日志增加 runId/sessionId/messageId/toolCallId 串联，方便追踪一次完整执行。
30. P2：建立 tool marketplace/test harness，安装新技能或插件工具时自动跑基础安全和 schema 测试。

### 四、Pipeline 编排能力

31. P0：为 pipeline 增加 dry-run 编译步骤，提前发现空任务、缺 agent、缺 model、非法引用、循环引用。
32. P0：`findPipelineByReference` 对部分名称匹配增加歧义处理，多个命中时要求选择，避免误跑。
33. P0：给每个 step 增加 timeout 配置，防止某一步无限等待。
34. P0：给每个 step 增加 maxOutputChars/maxInputChars 配置，用户可按任务调上下文交接大小。
35. P1：支持 typed step output，例如 text/json/file/table，后续步骤可按类型消费而不是只拼字符串。
36. P1：支持 pipeline variables schema，运行前收集必填参数并校验类型。
37. P1：支持 conditional step，根据上一步 status/output/json 字段决定是否执行。
38. P1：支持 parallel fan-out/fan-in，独立步骤并发执行，汇总后交给下一步。
39. P1：支持从失败 step 继续 rerun，只重跑失败点及其下游步骤。
40. P2：支持 pipeline 模板库，把常见多 agent 工作流做成可复用模板。

### 五、Pipeline Chat 命令与自然语言控制

41. P0：chat 中运行 pipeline 前显示预览确认：pipeline 名称、步骤数、预计高风险工具、输入摘要。
42. P0：支持 `/pipeline cancel`，不仅依赖当前 stop 按钮，便于远程/频道消息触发取消。
43. P1：支持 `/pipeline status` 查看当前运行、最近运行、失败原因。
44. P1：支持 `/pipeline history <name>` 直接在聊天中查看最近执行记录。
45. P1：支持 named args，例如 `/pipeline run deploy env=staging dryRun=true`。
46. P1：增加 fuzzy typo tolerance，对轻微拼写错误给出候选而不是 Pipeline not found。
47. P1：增加 localized command help，中英文展示可用命令和样例。
48. P1：降低 false positive：对讨论 pipeline 架构但不执行的语句增加二次分类。
49. P2：支持 pipeline chat 运行后的 follow-up 问答，把 execution record 作为可检索上下文。
50. P2：支持从聊天里把一段多步自然语言转换为 pipeline 草稿。

### 六、Streaming 状态机与模型调用稳定性

51. P0：把 `useAIChat` 内部 streaming 状态抽成显式状态机：idle、starting、streaming、tool-running、cancelling、done、error。
52. P0：修复 stream error 后仍可能继续累积 usage/complete 的边界，保证最终状态唯一。
53. P0：provider abort 后验证 fullStream 是否真的结束，必要时标记 provider 不支持硬取消。
54. P1：对 text-delta flush 建立 backpressure 策略，根据消息长度动态放宽刷新频率。
55. P1：给 stream 增加 heartbeat event，UI 可区分“模型思考中”和“连接卡死”。
56. P1：empty response recovery 不只抛错，也给出一键 retry、切换模型、检查 provider 配置入口。
57. P1：聚合 multi-step usage 时同时记录每一步 usage，定位哪一步工具循环消耗过高。
58. P1：流式中断后保留 partial answer，并允许“从这里继续”。
59. P2：建立 stream replay 日志，开发模式下可回放一次 fullStream 事件序列复现 UI bug。
60. P2：支持 provider capability registry，按模型能力决定是否启用工具、视觉、JSON、长上下文。

### 七、错误处理、恢复与韧性

61. P0：把 stored message error 从纯字符串升级为结构化对象：category、retryable、hint、rawSanitized、source。
62. P0：pipeline 执行失败时返回 actionable recovery，例如“重试该步”“跳过并继续”“打开 agent 配置”。
63. P0：所有 pipeline/chat/tool 错误统一走 sanitization，避免遗漏 provider 初始化错误和 delegation 错误。
64. P1：对 provider 5xx/429 建立指数退避和 retry-after 支持。
65. P1：对同一 provider 连续失败建立 circuit breaker，短时间内提示切换模型或稍后重试。
66. P1：离线/网络错误时支持保存待执行消息，网络恢复后由用户确认重发。
67. P1：agent delegation 错误也纳入 agent performance，避免只统计主 chat agent。
68. P1：增加 support bundle 导出：session、execution、sanitized logs、runtime snapshot。
69. P2：错误分类多语言化，中文用户看到中文恢复建议。
70. P2：建立失败知识库，把常见 provider/baseURL/API key 错误映射成修复向导。

### 八、可观测性、指标与评估

71. P0：引入统一 execution runId，贯穿 chat message、tool call、pipeline step、agent delegation、log。
72. P1：增加 pipeline run timeline，可视化每一步开始、tool 调用、重试、完成和失败。
73. P1：agent performance 增加成功率、平均首 token 时间、平均工具调用次数、平均 token 成本。
74. P1：pipeline history 增加 run diff，对比两次执行的输入、输出、耗时和失败点。
75. P1：chat runtime 面板展示当前 model、agent、token usage、tool count、stream duration。
76. P1：记录 command parser 命中原因，用户说一句话为什么被判定为 pipeline 命令可追踪。
77. P1：增加 token/cost dashboard，按 model、agent、pipeline 维度统计。
78. P2：建立任务完成率指标：用户重试、删除、负反馈、手动修正都纳入质量信号。
79. P2：开发模式引入 trace viewer，把 fullStream、store update、render flush 放在同一时间轴。
80. P2：隐私开关：允许用户关闭本地运行日志或选择仅保存聚合指标。

### 九、持久化、迁移与工作区可靠性

81. P0：大 session 拆分存储，messages、tool outputs、attachments 分文件，避免单个 store 文件过大。
82. P0：pipeline/agent/session 文件增加 schemaVersion 和 migration 测试。
83. P0：写入磁盘使用队列和原子写，避免并发 saveSession/savePipeline 导致文件损坏。
84. P1：workspacePath 变更时执行资源重载和旧状态隔离，避免跨项目 agent/pipeline 混用。
85. P1：agent import 增加严格校验和安全提示，禁止导入危险 permissionMode 或未知工具名时静默通过。
86. P1：pipeline delete 前检查 timer、chat history、external references，提示影响范围。
87. P1：session retention policy 不只按天，也支持按大小、按 starred、按最近使用保留。
88. P1：应用 crash 后恢复未完成的 streaming/pipeline 状态，标记 interrupted 而不是一直 spinning。
89. P2：agent/pipeline 文件支持导入导出包，包含依赖 skills 和版本信息。
90. P2：为 secrets 和 API key 引入更明确的安全存储边界，避免散落在可导出的 runtime snapshot 中。

### 十、测试、基准与质量门禁

91. P0：为 `useAIChat` pipeline cancellation 补 hook 级单测，覆盖 stop 后 assistant message 状态。
92. P0：为 chat attachment retry 补回归测试，确保失败后重试不丢文件/图片。
93. P0：为 pipeline partial-name ambiguity 补测试，多个匹配时不自动执行。
94. P1：增加 Playwright e2e：从 chat 输入 `/pipeline list`、运行 pipeline、取消、打开历史。
95. P1：增加 AI SDK stream mock，模拟 text/tool/error/usage 交错事件，覆盖状态机边界。
96. P1：增加 command parser fuzz tests，中英文随机句式避免误触发执行。
97. P1：增加 long tool output performance benchmark，测量 store 写入、渲染和内存增长。
98. P1：增加 prompt snapshot tests，agent system prompt 变更时能看到 diff。
99. P2：增加 pipeline eval suite，用固定 mock agents 检查 handoff、retry、continueOnError、typed output。
100. P2：CI 增加 targeted test matrix：chat runtime、pipeline service、command parser、tools security、persistence migrations。

## 建议的第一阶段执行顺序

第一阶段建议优先做 12 个最能提升“执行成功率”的点：

1. P0-1：模型历史 token budget 裁剪。
2. P0-2：tool result 摘要入上下文，全文外置。
3. P0-4：retryLastError 保留附件。
4. P0-11：agent auto-selection scoring。
5. P0-21：统一 tool result envelope。
6. P0-23：工具 timeout + abort 透传。
7. P0-31：pipeline dry-run 编译校验。
8. P0-32：pipeline 名称歧义处理。
9. P0-33：step timeout。
10. P0-41：chat 运行 pipeline 前预览确认。
11. P0-51：chat streaming 显式状态机。
12. P0-71：统一 execution runId。

## 推荐落地拆分

- Sprint 1：上下文治理 + retry 附件 + long tool output 外置。
- Sprint 2：pipeline dry-run、歧义处理、step timeout、chat preview confirmation。
- Sprint 3：streaming 状态机、runId tracing、结构化错误对象。
- Sprint 4：agent auto-selection、agent config lint、agent eval harness。
- Sprint 5：parallel/conditional/typed output 等高级 pipeline 能力。
