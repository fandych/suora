# Suora 模块技术手册（10 模块，10 轮，30 问）

阅读方法：每个模块固定回答 30 个技术问题，按 10 轮组织。你可以顺着“入口组件 -> store -> service -> 持久化 -> 测试”的路径快速定位实现。

## 1. Chat

### 第 1 轮：路由与入口
1. Chat 的真实路由是什么？答：`/chat`。
2. 布局入口文件是什么？答：`src/components/chat/ChatLayout.tsx`。
3. 主工作区由什么组成？答：会话侧栏骨架、`SessionList` 和 `ChatMain`。

### 第 2 轮：UI 组合
4. ChatLayout 的主要职责是什么？答：延迟装载会话侧栏、维护侧栏宽度并承载主聊天区。
5. 侧栏为什么是懒加载的？答：为了先稳定主工作区结构，再按绘制节奏补会话列表。
6. 右侧主区的真正行为入口是什么？答：`ChatMain.tsx`。

### 第 3 轮：状态与类型
7. Chat 主要依赖哪些 store 域？答：`sessions`、`activeSession`、`sessionTabs`、`selectedModel`、`agents`、`skills`。
8. 关键类型有哪些？答：`Session`、消息类型、`Agent`、`Model`。
9. 为什么 Chat 不是孤立模块？答：因为它读取模型、Agent、技能和通知等跨模块状态。

### 第 4 轮：服务与运行链路
10. Chat 的 AI 交互主入口是什么？答：`src/hooks/useAIChat.ts`。
11. 真正的模型调用服务在哪里？答：`src/services/aiService.ts`。
12. Slash 或控制命令怎么进来？答：经由 `slashCommandDispatcher` 与相关命令服务分发。

### 第 5 轮：持久化与导入导出
13. 会话状态存在哪里？答：存于全局 persisted Zustand store。
14. 重启后为什么还能看到会话？答：因为会话和消息属于持久化状态域。
15. Chat 自己负责导入导出吗？答：主要依赖全局数据导出能力，而不是单独维护一套文件系统格式。

### 第 6 轮：跨模块协作
16. Chat 和 Pipeline 的连接点是什么？答：聊天命令可以列出、运行、查询和取消已保存流水线。
17. Chat 和 Documents 的连接点是什么？答：文档内容可以作为会话上下文带入。
18. Chat 和 Agents 的连接点是什么？答：会话级 Agent 选择决定角色、工具策略和行为边界。

### 第 7 轮：安全与边界
19. Chat 的主要风险边界是什么？答：工具调用、附件处理和高权限 Agent 的执行面。
20. 权限控制落在哪？答：落在 Agent 工具策略与工具安全配置协同上。
21. Secure Storage 警告为什么和 Chat 有关？答：因为模型密钥异常会直接让聊天调用退化或失效。

### 第 8 轮：失败与降级
22. Chat 无法调用模型时先看哪里？答：`aiService.ts`、provider 配置和当前模型启用状态。
23. 工具调用异常时先看哪里？答：工具权限设置、工具服务和当前会话上下文。
24. 为什么要关心启动监听顺序？答：因为渠道、定时器和日志监听在 `src/App.tsx` 中要先注册，避免丢事件。

### 第 9 轮：测试与验证
25. Chat 附近有哪些测试锚点？答：`ChatMain.test.tsx`、`ChatMessages.test.tsx`、`SessionList.test.tsx`。
26. 组件测试主要验证什么？答：会话展示、消息渲染、交互流程和界面响应。
27. 改聊天逻辑时最小验证是什么？答：先跑相关组件测试，再看是否影响 AI hook 或命令分发。

### 第 10 轮：改动检查清单
28. 改 Chat 前先核对什么？答：当前路由、会话 store 域和主服务入口。
29. 改 Chat 时最容易误伤哪里？答：消息持久化、命令分发和模型/Agent 联动。
30. 改完后至少要复核什么？答：会话加载、消息发送、工具事件和当前模型/Agent 选择。

## 2. Documents

### 第 1 轮：路由与入口
1. Documents 的真实路由是什么？答：`/documents`。
2. 布局入口文件是什么？答：`src/components/documents/DocumentsLayout.tsx`。
3. 重要子组件有哪些？答：文档树、`DocumentTiptapEditor`、`DocumentGraphView`、`DocumentsAssistantDrawer`。

### 第 2 轮：UI 组合
4. DocumentsLayout 主要承担什么？答：树侧栏、编辑区、图谱与助手抽屉的协同。
5. 为什么这个布局比较重？答：因为它同时处理树操作、搜索、编辑、图分析和导入导出。
6. 图谱视图的 UI 价值是什么？答：从结构层而不是正文层观察知识资产。

### 第 3 轮：状态与类型
7. 核心状态域有哪些？答：`documentGroups`、`documentNodes`、选中组和选中文档。
8. 核心类型有哪些？答：`DocumentGroup`、`DocumentFolder`、`DocumentItem`、`DocumentNode`。
9. 为什么节点统一抽象重要？答：因为文件夹和文档共用树关系，方便排序、选择和路径计算。

### 第 4 轮：服务与运行链路
10. 文档基础服务在哪里？答：`src/services/documents.ts`。
11. 图分析逻辑在哪里？答：`src/services/documentGraph.ts`。
12. 统计和健康分析在哪里？答：`src/services/documentStatistics.ts` 与相关分析函数。

### 第 5 轮：持久化与导入导出
13. Documents 的状态存在哪里？答：主要存在全局 persisted store 中。
14. 为什么还会涉及文件系统？答：因为导入、导出和目录观察需要与工作区路径交互。
15. 路径归一化为什么重要？答：因为 Windows 和跨目录监听场景下路径格式不统一会导致观察和匹配失效。

### 第 6 轮：跨模块协作
16. Documents 和 Chat 的连接点是什么？答：选中文档可以作为聊天上下文。
17. Documents 和 Agents 的连接点是什么？答：`Document editor` 等 Agent 可围绕现有文档进行创建与修订。
18. Documents 和 Settings 的连接点是什么？答：知识相关设置和工作区路径会影响文档运行环境。

### 第 7 轮：安全与边界
19. Documents 的主要边界是什么？答：本地内容持久化、导入导出和被其他模块引用的知识范围。
20. 敏感文档最大的风险点是什么？答：被无差别带入 Chat 或导出到外部位置。
21. 为什么不能把它当纯 UI 功能？答：因为它真实持有本地知识资产。

### 第 8 轮：失败与降级
22. 搜索失真先查哪里？答：索引构建、标题命名和保存链路。
23. 图谱异常先查哪里？答：引用提取、图构建和文档节点关系。
24. 导入导出有问题先查哪里？答：文件系统、路径和导入导出服务。

### 第 9 轮：测试与验证
25. Documents 附近有哪些测试？答：`DocumentsLayout.test.tsx`、`DocumentGraphView.test.tsx`、`documents.test.ts`。
26. 这些测试覆盖什么？答：布局行为、图谱展示和文档服务逻辑。
27. 改文档服务时的最小验证是什么？答：先跑服务测试，再看布局侧是否仍能正确消费结果。

### 第 10 轮：改动检查清单
28. 改 Documents 前先核对什么？答：节点类型、树关系和导入导出链路。
29. 哪类修改最容易引发连锁反应？答：节点 ID、父子关系和引用提取规则。
30. 改完后至少要复核什么？答：创建、重命名、保存、搜索、图谱和上下文注入。

## 3. Pipeline

### 第 1 轮：路由与入口
1. Pipeline 的真实路由是什么？答：`/pipeline`。
2. 布局入口文件是什么？答：`src/components/pipeline/PipelineLayout.tsx`。
3. 重要视图有哪些？答：流程编辑、`flow/list/source` 图模式、执行历史和助手抽屉。

### 第 2 轮：UI 组合
4. PipelineLayout 主要承担什么？答：编辑器、执行状态、历史、图预览和助手能力的整合。
5. Mermaid 相关组件有哪些？答：`PipelineFlowDiagram` 与 `PipelineFlowCanvas`。
6. 为什么执行历史直接在模块里？答：因为它是设计与调试闭环的一部分，不是额外附属页。

### 第 3 轮：状态与类型
7. 关键 store 域有哪些？答：`agentPipeline`、`agentPipelineName`、`selectedAgentPipelineId`、`agentPipelines`。
8. 关键类型有哪些？答：`AgentPipeline`、`AgentPipelineStep`、`AgentPipelineExecution`、`AgentPipelineVariable`。
9. 为什么变量值要单独维护？答：因为编辑结构和实际运行时的输入值并不完全相同。

### 第 4 轮：服务与运行链路
10. 核心执行服务在哪里？答：`src/services/agentPipelineService.ts`。
11. 结构校验在哪里？答：`src/services/pipelineValidation.ts`。
12. Mermaid 和优化建议分别在哪里？答：`pipelineMermaid.ts` 与 `pipelineOptimization.ts`。

### 第 5 轮：持久化与导入导出
13. 流水线文件化能力在哪里？答：`src/services/pipelineFiles.ts`。
14. 可移植导入导出逻辑在哪里？答：`src/services/pipelinePortability.ts`。
15. 为什么 Pipeline 不只靠 store？答：因为保存流水线和执行历史需要明确的磁盘读写边界。

### 第 6 轮：跨模块协作
16. Pipeline 和 Agents 的连接点是什么？答：每个步骤绑定具体 Agent。
17. Pipeline 和 Chat 的连接点是什么？答：聊天命令可以触发已保存流水线。
18. Pipeline 和 Timer 的连接点是什么？答：定时器可以直接调度保存流水线。

### 第 7 轮：安全与边界
19. Pipeline 的主要边界是什么？答：多步任务把 Agent、模型和工具调用串成更大执行面。
20. 为什么预算和重试也是安全设计？答：因为它们控制资源消耗和失败放大效应。
21. 哪类步骤最该单一职责？答：涉及工具调用、外部服务或高成本推理的步骤。

### 第 8 轮：失败与降级
22. 执行失败先查哪里？答：步骤输入、变量替换、Agent 绑定和工具/模型可用性。
23. fallback 信息为什么重要？答：它揭示执行是否从 workflow 路径降级到了 legacy 路径。
24. `runIf` 误跳步先查哪里？答：条件表达式、变量值和步骤启用状态。

### 第 9 轮：测试与验证
25. Pipeline 附近有哪些测试？答：`PipelineLayout.test.tsx`、`agentPipelineService.test.ts`、`pipelineRunIf.test.ts`。
26. 服务测试重点验证什么？答：执行顺序、条件、历史和失败行为。
27. 改执行链路时最小验证是什么？答：先跑服务测试，再验证布局侧的历史与状态展示。

### 第 10 轮：改动检查清单
28. 改 Pipeline 前先核对什么？答：步骤模型、执行历史结构和磁盘格式。
29. 哪类改动最容易破坏兼容性？答：步骤字段、变量引用格式和导入导出协议。
30. 改完后至少要复核什么？答：保存、试跑、历史展示、Mermaid 预览和聊天触发。

## 4. Models

### 第 1 轮：路由与入口
1. Models 的真实路由是什么？答：`/models` 重定向到 `/models/providers`，主路由是 `/models/:view`。
2. 有哪些合法子视图？答：`providers`、`models`、`compare`。
3. 布局入口文件是什么？答：`src/components/models/ModelsLayout.tsx`。

### 第 2 轮：UI 组合
4. 主要编辑组件有哪些？答：`ProviderEditor`、`ModelParamEditor`、`ModelComparisonPanel`。
5. 视图切换在哪里控制？答：由 `ModelsLayout` 内的 `viewMode` 和导航逻辑控制。
6. 为什么布局里要维护连接状态？答：因为 provider 列表本身需要向用户反馈可用性。

### 第 3 轮：状态与类型
7. 核心 store 域有哪些？答：`providerConfigs`、`models`、`selectedModel`。
8. provider 预设来自哪里？答：`src/store/slices/modelConfigSlice.ts`。
9. 为什么要区分 providerConfig 和 model entry？答：因为一个 provider 下可以挂多个模型和参数状态。

### 第 4 轮：服务与运行链路
10. 核心运行服务在哪里？答：`src/services/aiService.ts`。
11. 连通性测试用什么？答：同样走 `aiService` 中的测试逻辑。
12. 模型同步怎么完成？答：通过 store slice 中的同步逻辑把 provider 配置展开为模型列表。

### 第 5 轮：持久化与导入导出
13. 模型配置存在哪里？答：存于全局 persisted store，并可写入工作区设置。
14. 为什么工作区加载会影响 Models？答：因为布局会在工作区存在时加载和保存设置。
15. 删除 provider 时为什么要同步模型？答：因为 provider 消失后其派生模型也必须一起收口。

### 第 6 轮：跨模块协作
16. Models 服务哪些模块？答：Chat、Agents、Pipeline、Timer、Channels。
17. 为什么 Agent 文档不能单独写 provider 列表？答：因为真实 provider 支持由这里和 `aiService` 共同定义。
18. Compare 的结果会影响哪里？答：影响 Agent 绑定、默认模型和流程设计。

### 第 7 轮：安全与边界
19. Models 的最大敏感边界是什么？答：API Key、Base URL 和可调用模型列表。
20. Secure Storage 在这里扮演什么角色？答：决定密钥是否能被安全持久化。
21. 为什么运行时支持和 UI 暴露必须分开写？答：因为 `aiService` 支持面比当前 provider 编辑器更宽。

### 第 8 轮：失败与降级
22. provider 明明保存了但不可用先查哪里？答：连接测试、Base URL、模型 ID 和是否已启用模型。
23. 为什么有时 provider 状态会先是 checking？答：布局会在空闲时为可用配置做连接探测。
24. 连接失败后显示 disconnected 应该去哪里继续查？答：先看 `aiService` 错误分类，再回看具体 provider 配置。

### 第 9 轮：测试与验证
25. Models 附近有哪些测试？答：`aiService.test.ts` 和 `appStore.test.ts` 是主要锚点。
26. 这些测试主要覆盖什么？答：provider 逻辑、配置同步和 store 行为。
27. 改 provider 逻辑时最小验证是什么？答：先跑 AI 服务和 store 相关测试，再手动核对子视图切换。

### 第 10 轮：改动检查清单
28. 改 Models 前先核对什么？答：provider 类型、预设和 UI 子视图约束。
29. 哪类改动最容易误导文档？答：运行时 provider 支持和 UI 下拉列表之间的差异。
30. 改完后至少要复核什么？答：provider 新增、保存、测试连接、模型启用和 compare 入口。

## 5. Agents

### 第 1 轮：路由与入口
1. Agents 的真实路由是什么？答：`/agents`。
2. 布局入口文件是什么？答：`src/components/agents/AgentsLayout.tsx`。
3. 关键子组件有哪些？答：`AgentEditor`、`AgentTestChat`、`AgentAssistantDrawer`、`AgentOrchestrationPanel`。

### 第 2 轮：UI 组合
4. 布局左侧主要做什么？答：搜索、筛选并切换 Agent。
5. 右侧编辑区主要做什么？答：编辑提示词、技能、模型和工具策略，并提供测试面板。
6. 为什么测试聊天留在同模块？答：因为 Agent 的设计和验证必须闭环。

### 第 3 轮：状态与类型
7. 关键 store 域有哪些？答：`agents`、`agentVersions`、`agentPerformance`、`globalMemories`、`agentSelectionPreferences`。
8. 关键类型有哪些？答：`Agent`、`AgentMemoryEntry`、版本和性能统计类型。
9. 为什么 `maxTurns` 和 permission mode 重要？答：它们属于真实运行约束，而不是展示字段。

### 第 4 轮：服务与运行链路
10. Agent 相关服务锚点有哪些？答：`agentCommunication.ts`、`agentSelection.ts`、`agentDiagnostics.ts`。
11. 内置 Agent 的本地化和刷新逻辑在哪里？答：在 `src/store/appStore.ts`。
12. 为什么构建器 Agent 要特别看 store？答：因为它们的系统提示和更新策略由 store 直接种子化。

### 第 5 轮：持久化与导入导出
13. Agent 状态存在哪里？答：存在全局 persisted store。
14. 版本快照有什么价值？答：支持在大改提示词或权限时回退。
15. 导入导出为什么不是可选边角料？答：因为自定义 Agent 是长期资产，不只是页面临时配置。

### 第 6 轮：跨模块协作
16. Agents 和 Skills 的连接点是什么？答：Agent 通过技能列表引入领域能力。
17. Agents 和 Pipeline 的连接点是什么？答：流水线步骤绑定 Agent。
18. Agents 和 Channels 的连接点是什么？答：渠道配置将某个 Agent 设为 reply owner。

### 第 7 轮：安全与边界
19. Agent 的主要风险边界是什么？答：系统提示、工具白名单/黑名单和权限模式的组合。
20. 为什么内置 Agent 不能被文档写成简单角色标签？答：因为它们还携带真实运行策略与限制。
21. 技能为什么不能视为工具实现？答：因为技能是 prompt/resource 层，不会绕过真正的工具权限系统。

### 第 8 轮：失败与降级
22. Agent 效果不对先查哪里？答：系统提示、模型绑定、技能绑定和工具策略。
23. 构建器 Agent 行为不对先查哪里？答：`appStore.ts` 中的 built-in 定义和本地化刷新逻辑。
24. 测试聊天和真实聊天结果不一致时先查什么？答：上下文差异、模型差异和会话态差异。

### 第 9 轮：测试与验证
25. Agents 附近有哪些测试？答：`AgentAssistantDrawer.test.tsx`、`SystemPromptMarkdownEditor.test.tsx`、`agentCommunication.test.ts`。
26. 测试重点覆盖什么？答：编辑体验、提示词处理和通信链路。
27. 改 Agent 结构时最小验证是什么？答：先跑相关组件和服务测试，再做一次模块内测试聊天。

### 第 10 轮：改动检查清单
28. 改 Agents 前先核对什么？答：内置 Agent 清单、共享类型和 store patch 逻辑。
29. 哪类改动最容易破坏兼容性？答：Agent 类型字段、版本结构和 built-in 刷新条件。
30. 改完后至少要复核什么？答：列表、编辑、测试聊天、版本快照和技能绑定。

## 6. Skills

### 第 1 轮：路由与入口
1. Skills 的真实路由是什么？答：`/skills`。
2. `/skills/:view` 当前如何处理？答：会重定向回 `/skills`。
3. 布局入口文件是什么？答：`src/components/skills/SkillsLayout.tsx`。

### 第 2 轮：UI 组合
4. 主要编辑组件是什么？答：`SkillEditor` 与相关面板组件。
5. 布局左侧主要做什么？答：列出已安装技能、来源过滤和本地目录来源开关。
6. 为什么来源显示这么重要？答：因为同名技能可能来自不同源，行为与持久化方式不同。

### 第 3 轮：状态与类型
7. 关键 store 域有哪些？答：`skills`、`externalDirectories`、`skillVersions`。
8. 关键类型有哪些？答：`Skill`、`SkillSource`、frontmatter 和 registry source 相关类型。
9. 为什么 `skillRoot` 和 `filePath` 都要保留？答：因为目录型技能和单文件技能的持久化边界不同。

### 第 4 轮：服务与运行链路
10. `SKILL.md` 解析和序列化逻辑在哪里？答：`src/services/skillRegistry.ts`。
11. 打包导入导出逻辑在哪里？答：`src/services/skillArchive.ts`。
12. 注册表浏览和安装逻辑在哪里？答：`src/services/skillMarketplace.ts`。

### 第 5 轮：持久化与导入导出
13. 技能保存到哪里？答：本地/项目/用户/目录型技能会写回对应磁盘位置。
14. 新技能默认落在哪里？答：工作区存在时会落到工作区 `.suora/skills/` 目录下。
15. 为什么保存时要先 ensure directory？答：因为技能是文件系统资产，不只是 store 对象。

### 第 6 轮：跨模块协作
16. Skills 和 Agents 的连接点是什么？答：Agent 通过技能列表把技能内容注入系统上下文。
17. Skills 和 Settings 的连接点是什么？答：外部目录设置决定哪些共享技能源会被加载。
18. 为什么技能文档必须提到目录规范化？答：因为 Claude Code 和其他 agent 目录有兼容归一化逻辑。

### 第 7 轮：安全与边界
19. Skills 的主要风险边界是什么？答：不可信技能文本、资源树和脚本型资源。
20. 为什么技能不是工具系统？答：因为它不会自动获得更高权限，只影响上下文与资源装配。
21. 哪些资源最值得警惕？答：`scripts/` 下可执行资源和来源不明的打包文件。

### 第 8 轮：失败与降级
22. 技能加载失败先查哪里？答：`SKILL.md` 解析、文件路径和外部目录启用状态。
23. 保存失败先查哪里？答：工作区路径、目标目录和磁盘写入权限。
24. 来源过滤异常先查哪里？答：技能 source 字段和目录归一化逻辑。

### 第 9 轮：测试与验证
25. Skills 附近有哪些测试？答：`SkillsLayout.test.tsx`、`SkillEditor.test.tsx`、`skillRegistry.test.ts`。
26. 测试重点覆盖什么？答：布局行为、编辑行为和 `SKILL.md` 解析/序列化。
27. 改技能格式时最小验证是什么？答：先跑 registry 测试，再验证布局保存与重新载入。

### 第 10 轮：改动检查清单
28. 改 Skills 前先核对什么？答：source 模型、磁盘格式和目录兼容逻辑。
29. 哪类改动最容易破坏共享能力？答：frontmatter 格式、序列化规则和来源路径解析。
30. 改完后至少要复核什么？答：新建、保存、重新载入、导入导出和 Agent 绑定效果。

## 7. Timer

### 第 1 轮：路由与入口
1. Timer 的真实路由是什么？答：`/timer`。
2. 布局入口文件是什么？答：`src/components/timer/TimerLayout.tsx`。
3. 关键子组件有哪些？答：`TimerForm`、`TimerDetail`、`TimerAssistantDrawer`。

### 第 2 轮：UI 组合
4. 左侧列表区承担什么？答：搜索、选择、启停和新建任务入口。
5. 右侧详情区承担什么？答：展示表单、任务细节与执行观察信息。
6. 为什么 AI Create 被放在模块头部？答：因为 Timer 支持直接用自然语言生成定时配置。

### 第 3 轮：状态与类型
7. Timer 本地状态主要是什么？答：当前列表、选中项、编辑态、创建态和搜索态。
8. 关键类型有哪些？答：`ScheduledTask`、定时器表单数据和执行状态类型。
9. 为什么还要加载 `agentPipelines`？答：因为定时器可以直接执行已保存流水线。

### 第 4 轮：服务与运行链路
10. 与主进程通信主要靠什么？答：`electronInvoke`、`electronOn`、`electronOff` 和 `timerHelpers`。
11. 定时器触发后的处理在哪里？答：`src/services/timerRuntime.ts`。
12. 为什么布局里要监听 `timer:fired`？答：为了在主进程触发后刷新前端状态。

### 第 5 轮：持久化与导入导出
13. Timer 数据由谁持久化？答：主要由 Electron 侧计时器能力管理，不是前端单独持久化。
14. 为什么还要在模块里读取列表？答：因为 UI 要随时反映真实任务状态和下一次运行时间。
15. Pipeline 依赖如何接入？答：通过读取磁盘中的已保存流水线列表。

### 第 6 轮：跨模块协作
16. Timer 和 Pipeline 的连接点是什么？答：任务动作可以是运行已保存流水线。
17. Timer 和 Agents 的连接点是什么？答：任务动作可以是触发 Agent Prompt。
18. Timer 和 Settings 的连接点是什么？答：全局环境、安全策略和日志会影响自动执行。

### 第 7 轮：安全与边界
19. Timer 的主要风险边界是什么？答：无人值守执行带来的成本、重复触发和高权限自动化。
20. 为什么动作类型被收敛到三类？答：这是为了避免它演变成任意 OS 任务执行器。
21. 哪类任务最该先 run now？答：调用模型、流水线或外部平台的任务。

### 第 8 轮：失败与降级
22. 任务不刷新先查哪里？答：主进程事件、列表接口和刷新定时器。
23. 触发后没效果先查哪里？答：绑定 Agent/Pipeline、provider 可用性和运行时日志。
24. 为什么机器休眠会影响预期？答：因为调度和补跑策略受运行时状态影响。

### 第 9 轮：测试与验证
25. Timer 附近有哪些测试？答：`TimerLayout.test.tsx` 与 `timerRuntime.test.ts`。
26. 测试重点覆盖什么？答：布局行为、任务管理和运行时触发逻辑。
27. 改定时器动作链路时最小验证是什么？答：先跑运行时测试，再在布局里做一次创建和 run now 路径验证。

### 第 10 轮：改动检查清单
28. 改 Timer 前先核对什么？答：动作类型、主进程事件名和表单字段。
29. 哪类改动最容易误伤哪里？答：调度字段、事件同步和 Pipeline 依赖载入。
30. 改完后至少要复核什么？答：创建、更新、启停、run now 和列表刷新。

## 8. Channels

### 第 1 轮：路由与入口
1. Channels 的真实路由是什么？答：`/channels`。
2. 布局入口文件是什么？答：`src/components/channels/ChannelLayout.tsx`。
3. 关键子组件有哪些？答：`ChannelEditor`、`ChannelPanels`、`ChannelIcons`。

### 第 2 轮：UI 组合
4. 详情视图有哪些标签？答：`config`、`messages`、`users`、`health`、`debug`。
5. 为什么 Config 和 Health 分开？答：一个看静态配置，一个看实时运行状态。
6. Webhook URL 为什么在详情页强调？答：因为它是平台回调接入的关键操作面。

### 第 3 轮：状态与类型
7. 关键 store 域有哪些？答：`channels`、`channelMessages`、`channelHealth`、`channelUsers`、`channelTokens`。
8. 关键类型有哪些？答：`ChannelConfig`、`ChannelPlatform`、`ChannelStatus`、消息与用户类型。
9. 当前平台矩阵包括什么？答：企业微信、个人微信、公众号、小程序、飞书、钉钉、Slack、Telegram、Discord、Teams、Email、自定义渠道。

### 第 4 轮：服务与运行链路
10. 渠道前端运行服务在哪里？答：`src/services/channelMessageHandler.ts`。
11. Electron 侧通道服务在哪里？答：`electron/channelService.ts`。
12. Webhook 服务控制怎么进来？答：通过 `startChannelServer`、`stopChannelServer`、状态查询和 URL 生成能力。

### 第 5 轮：持久化与导入导出
13. 渠道配置存在哪里？答：存在全局 persisted store。
14. 为什么消息和健康状态也要入 store？答：因为 UI 需要跨标签统一观察同一渠道的运行数据。
15. Email 字段为什么算真实配置而不是附属文本？答：因为它包含 IMAP/SMTP、过滤规则和动作链等完整运行参数。

### 第 6 轮：跨模块协作
16. Channels 和 Agents 的连接点是什么？答：每个渠道绑定一个 reply Agent。
17. Channels 和 Models 的连接点是什么？答：回复 Agent 最终仍依赖模型可用性。
18. Channels 和 Settings/Logs 的连接点是什么？答：全局安全、日志和外部运行环境会影响渠道服务可观察性。

### 第 7 轮：安全与边界
19. Channels 的主要风险边界是什么？答：开放入站入口、自动回复和平台凭据。
20. 为什么 stream 模式常更安全？答：它通常不要求暴露公共回调地址。
21. Email 通道额外的风险点是什么？答：邮箱口令、轮询规则和多动作链的误处理风险。

### 第 8 轮：失败与降级
22. 收不到回调先查哪里？答：渠道启用状态、服务状态、平台侧 URL/secret 和 Debug 面板。
23. 个人微信绑定异常先查哪里？答：绑定状态、二维码 URL 和桥接相关字段。
24. Email 通道异常先查哪里？答：IMAP/SMTP 字段、TLS、轮询间隔、过滤规则和动作链。

### 第 9 轮：测试与验证
25. Channels 附近有哪些测试？答：`ChannelEditor.test.tsx`、`ChannelPanels.test.tsx`、`channelMessageHandler.test.ts`。
26. 测试重点覆盖什么？答：编辑行为、观察面板和运行时消息处理。
27. 改平台字段时最小验证是什么？答：先跑编辑器和处理器测试，再手动核对对应标签展示。

### 第 10 轮：改动检查清单
28. 改 Channels 前先核对什么？答：平台类型、连接模式、reply Agent 绑定和主进程桥接。
29. 哪类改动最容易误伤哪里？答：平台枚举、凭据字段和消息/健康状态结构。
30. 改完后至少要复核什么？答：新建渠道、切换标签、服务状态、Webhook URL 和消息观察面。

## 9. MCP

### 第 1 轮：路由与入口
1. MCP 的真实路由是什么？答：`/mcp`。
2. 路由挂载的布局是什么？答：`src/components/integrations/IntegrationsLayout.tsx`。
3. 真正的主面板是什么？答：`MCPSettingsPanel`。

### 第 2 轮：UI 组合
4. IntegrationsLayout 为什么这么薄？答：因为当前 `/mcp` 主要就是把 MCP 面板挂出来。
5. MCP 面板主要承担什么？答：服务器列表、配置编辑、连接状态与能力观察。
6. 为什么这不叫单纯“设置页”？答：因为它直接影响 Agent 可调用的运行能力面。

### 第 3 轮：状态与类型
7. 关键 store 域是什么？答：`mcpServers`。
8. 关键类型有哪些？答：`MCPServerConfig`、`MCPServerStatus`、`MCPTransport`、`MCPServerScope`。
9. 为什么 scope 被单独建模？答：因为工作区级和用户级的影响面不同。

### 第 4 轮：服务与运行链路
10. 核心服务在哪里？答：`src/services/mcpSystem.ts`。
11. 连接验证主要做什么？答：校验 transport、URL/命令、headers、env 和状态。
12. 为什么要区分 `stdio` 和网络型 transport？答：因为它们的权限边界和运行方式完全不同。

### 第 5 轮：持久化与导入导出
13. MCP 配置存在哪里？答：保存在全局 persisted store 中。
14. 为什么这类配置需要持久化？答：因为它是跨会话、跨模块可复用的能力入口。
15. 当前有单独的导入导出格式吗？答：主要依赖全局配置持久化，而不是独立专题文件格式。

### 第 6 轮：跨模块协作
16. MCP 和 Agents 的连接点是什么？答：Agent 可在运行时识别并调用可用 MCP 能力。
17. MCP 和 Chat 的连接点是什么？答：聊天任务在合适 Agent 下会实际消费 MCP 工具。
18. MCP 和 Settings 的连接点是什么？答：全局环境与安全约束会影响服务是否可运行。

### 第 7 轮：安全与边界
19. MCP 的主要风险边界是什么？答：高权限外部能力通过 Agent 间接进入工作台。
20. URL 协议为什么要校验？答：因为 HTTP/WS 类 transport 只允许明确的安全协议范围。
21. 为什么 renderer 不应直接 spawn `stdio` 进程？答：因为特权操作必须走 Electron 边界。

### 第 8 轮：失败与降级
22. 连接失败先查哪里？答：transport、URL、命令、env、headers 和服务本体状态。
23. 保存了但 Agent 还是看不到服务怎么办？答：先查服务器状态，再查 Agent 运行上下文。
24. 哪类错误最可能是配置层造成的？答：协议不合法、作用域不对或认证字段不全。

### 第 9 轮：测试与验证
25. MCP 附近有哪些测试？答：`mcpSystem.test.ts`。
26. 测试重点覆盖什么？答：配置校验和连接相关逻辑。
27. 改 MCP 配置模型时最小验证是什么？答：先跑服务测试，再手动核对 `/mcp` 面板状态显示。

### 第 10 轮：改动检查清单
28. 改 MCP 前先核对什么？答：transport 枚举、scope 模型和状态结构。
29. 哪类改动最容易误导使用者？答：把网络型服务和 `stdio` 服务写成同一种安全模型。
30. 改完后至少要复核什么？答：新建、保存、测试连接和状态面板。

## 10. Settings

### 第 1 轮：路由与入口
1. Settings 的真实路由是什么？答：`/settings/:section`，默认跳到 `/settings/general`。
2. 布局入口文件是什么？答：`src/components/settings/SettingsLayout.tsx`。
3. 当前真实分区有哪些？答：`general`、`security`、`voice`、`shortcuts`、`data`、`knowledge`、`events`、`external-dirs`、`plugins`、`logs`、`system`。

### 第 2 轮：UI 组合
4. SettingsLayout 主要承担什么？答：侧栏分区导航、头部统计卡和懒加载分区面板。
5. 为什么每个分区都懒加载？答：避免一次性装载所有设置子面板。
6. 为什么头部要展示 section/category/scope？答：让用户知道当前正在改哪类配置和作用域。

### 第 3 轮：状态与类型
7. 关键 store 域有哪些？答：主题、语言、工具安全、快捷键、代理、环境变量、邮箱配置、onboarding 和外部目录等。
8. 关键类型有哪些？答：`ToolSecuritySettings`、`WorkspaceSettings`、`ExternalDirectoryConfig`、provider 相关类型等。
9. 为什么 Settings 本质上是全局状态控制面？答：因为它影响所有模块的默认行为和风险边界。

### 第 4 轮：服务与运行链路
10. Settings 相关核心服务有哪些？答：`appStore.ts`、`modelConfigSlice.ts`、`secureState.ts`、`workspaceSettings.ts`。
11. 为什么 provider 安全也要看 Settings？答：因为工具安全与工作区设置会在这里汇总和同步。
12. 外部目录加载和 Settings 的关系是什么？答：它通过设置写入和加载共享技能/Agent 目录。

### 第 5 轮：持久化与导入导出
13. Settings 数据如何持久化？答：主要通过全局 persisted store，并按工作区需要加载/保存配置。
14. 为什么 Data 分区重要？答：它集中处理导入、导出、备份和清理。
15. 为什么 Settings 修改会影响跨模块状态？答：因为很多配置本身就是其他模块的运行前提。

### 第 6 轮：跨模块协作
16. Settings 和 Models 的连接点是什么？答：密钥持久化、安全提示和工作区 provider 配置。
17. Settings 和 Skills/Agents 的连接点是什么？答：外部目录、共享资源和工作区保存行为。
18. Settings 和 Channels/MCP 的连接点是什么？答：日志、安全和系统状态决定这些扩展入口是否可控可诊断。

### 第 7 轮：安全与边界
19. Settings 的核心安全边界是什么？答：Secure Storage、工具确认、目录允许列表和危险模式拦截。
20. 为什么 Secure Storage 提示必须保留到 UI？答：因为用户必须知道密钥是安全持久化还是只在内存中存在。
21. 为什么插件和外部目录要慎重？答：它们会扩大工作台的可执行和可加载边界。

### 第 8 轮：失败与降级
22. 配置保存后不生效先查哪里？答：store 持久化、工作区读写和相关分区逻辑。
23. 密钥重启后丢失先查哪里？答：`secureState.ts`、`src/App.tsx` 的警告监听和系统 keyring 状态。
24. 分区数量文档不一致时该信谁？答：信 `SettingsLayout.tsx` 的 `SETTING_SECTIONS`。

### 第 9 轮：测试与验证
25. Settings 附近有哪些测试？答：`workspaceSettings.test.ts`、`secureState.test.ts`、`appStore.test.ts`。
26. 测试重点覆盖什么？答：设置持久化、安全状态和 store 行为。
27. 改设置分区时最小验证是什么？答：先跑相关服务和 store 测试，再确认路由和侧栏一致。

### 第 10 轮：改动检查清单
28. 改 Settings 前先核对什么？答：真实分区列表、作用域和持久化边界。
29. 哪类改动最容易造成文档漂移？答：新增/删减分区、修改安全策略名或改变默认跳转。
30. 改完后至少要复核什么？答：侧栏导航、分区懒加载、数据保存和 Secure Storage 提示路径。