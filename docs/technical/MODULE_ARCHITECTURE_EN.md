# Suora Module Architecture Guide (10 Modules, 10 Rounds, 30 Questions)

How to read this guide: each module answers 30 technical questions in 10 rounds. The intended reading path is entry component, then store, then services, then persistence, then tests.

## 1. Chat

### Round 1: Route and entry
1. What is the real route for Chat? Answer: `/chat`.
2. What is the layout entry file? Answer: `src/components/chat/ChatLayout.tsx`.
3. What are the primary visual parts? Answer: a session rail skeleton, `SessionList`, and `ChatMain`.

### Round 2: UI composition
4. What is `ChatLayout` responsible for? Answer: delayed session-rail loading, sidebar sizing, and hosting the main chat workspace.
5. Why is the session rail lazily mounted? Answer: to stabilize the workspace shell first and hydrate the list after paint.
6. Where does most behavioral complexity live? Answer: `ChatMain.tsx`.

### Round 3: State and types
7. Which store domains matter most? Answer: `sessions`, `activeSession`, `sessionTabs`, `selectedModel`, `agents`, and `skills`.
8. Which types matter most? Answer: `Session`, message types, `Agent`, and `Model`.
9. Why is Chat not an isolated feature slice? Answer: because it consumes model, agent, skill, and notification state from the global workbench.

### Round 4: Services and runtime path
10. What is the main AI interaction entry point? Answer: `src/hooks/useAIChat.ts`.
11. Where does actual model invocation happen? Answer: `src/services/aiService.ts`.
12. How do slash or control commands enter the flow? Answer: through the slash-command dispatcher and related command services.

### Round 5: Persistence and import/export
13. Where is chat state persisted? Answer: in the global persisted Zustand store.
14. Why do sessions survive restarts? Answer: because sessions and messages are persisted application state.
15. Does Chat own a dedicated import/export format? Answer: not primarily; it relies on broader data import/export flows.

### Round 6: Cross-module collaboration
16. How does Chat connect to Pipeline? Answer: chat commands can list, run, inspect, and cancel saved pipelines.
17. How does Chat connect to Documents? Answer: selected document content can be attached as conversation context.
18. How does Chat connect to Agents? Answer: per-session agent choice determines role, tool policy, and behavioral boundaries.

### Round 7: Safety and boundaries
19. What is the main risk surface for Chat? Answer: tool execution, attachment handling, and high-permission agents.
20. Where is permission control enforced? Answer: across agent tool policy and global tool-security settings.
21. Why do secure-storage warnings matter here? Answer: because broken key persistence directly degrades model invocation.

### Round 8: Failure and fallback
22. Where should you look first when Chat cannot call a model? Answer: `aiService.ts`, provider configuration, and model enablement state.
23. Where should you look first when a tool call misbehaves? Answer: tool policy, tool service behavior, and current session context.
24. Why does app startup order matter to Chat? Answer: `src/App.tsx` registers channel, timer, and logging listeners early so event traffic is not lost.

### Round 9: Testing and validation
25. Which nearby tests anchor Chat behavior? Answer: `ChatMain.test.tsx`, `ChatMessages.test.tsx`, and `SessionList.test.tsx`.
26. What do the component tests mostly validate? Answer: session presentation, message rendering, and core interaction flow.
27. What is the smallest useful validation after chat changes? Answer: run the nearby component tests and verify no regressions in the AI hook or command flow.

### Round 10: Change checklist
28. What should you verify before editing Chat? Answer: the real route, the owning store domains, and the primary runtime services.
29. What is easiest to break accidentally? Answer: message persistence, command dispatching, and model or agent synchronization.
30. What should you verify after editing? Answer: session loading, message sending, tool events, and current model and agent selection.

## 2. Documents

### Round 1: Route and entry
1. What is the real route for Documents? Answer: `/documents`.
2. What is the layout entry file? Answer: `src/components/documents/DocumentsLayout.tsx`.
3. Which subcomponents matter most? Answer: the tree sidebar, `DocumentTiptapEditor`, `DocumentGraphView`, and `DocumentsAssistantDrawer`.

### Round 2: UI composition
4. What is `DocumentsLayout` responsible for? Answer: coordinating tree navigation, editing, graphing, and document-assistant behavior.
5. Why is this layout heavier than many others? Answer: because it combines tree operations, search, editing, analysis, and import/export concerns.
6. What is the UI value of the graph view? Answer: it lets users inspect structure rather than only raw note text.

### Round 3: State and types
7. Which store domains matter most? Answer: document groups, document nodes, selected group state, and selected document state.
8. Which types matter most? Answer: `DocumentGroup`, `DocumentFolder`, `DocumentItem`, and `DocumentNode`.
9. Why is the shared node abstraction important? Answer: because folders and documents share the tree relationship model.

### Round 4: Services and runtime path
10. Where is the base document service? Answer: `src/services/documents.ts`.
11. Where does graph logic live? Answer: `src/services/documentGraph.ts`.
12. Where do statistics and health analysis live? Answer: `src/services/documentStatistics.ts` and related analysis helpers.

### Round 5: Persistence and import/export
13. Where is document state persisted? Answer: primarily in the global persisted store.
14. Why is filesystem behavior still relevant? Answer: because import, export, and directory watching interact with workspace paths.
15. Why is path normalization a recurring concern? Answer: because Windows paths and cross-directory watches otherwise drift out of sync.

### Round 6: Cross-module collaboration
16. How does Documents connect to Chat? Answer: selected notes can be injected as chat context.
17. How does Documents connect to Agents? Answer: agents such as Document editor can create or revise saved notes.
18. How does Documents connect to Settings? Answer: workspace path and knowledge-related settings shape the runtime environment.

### Round 7: Safety and boundaries
19. What is the main boundary for Documents? Answer: local knowledge persistence, import/export edges, and reuse of knowledge by other modules.
20. What is the biggest risk with sensitive notes? Answer: exporting them loosely or injecting them wholesale into other workflows.
21. Why should this not be documented as a purely visual feature? Answer: because it owns real local knowledge assets.

### Round 8: Failure and fallback
22. Where should you look first when search results are poor? Answer: indexing, note naming, and save flow.
23. Where should you look first when graph output looks wrong? Answer: reference extraction, graph construction, and node relationships.
24. Where should you look first when import/export fails? Answer: filesystem bridging, path handling, and import/export services.

### Round 9: Testing and validation
25. Which nearby tests anchor Documents? Answer: `DocumentsLayout.test.tsx`, `DocumentGraphView.test.tsx`, and `documents.test.ts`.
26. What do they cover? Answer: layout behavior, graph rendering, and service-level document logic.
27. What is the smallest useful validation after a document-service change? Answer: run the service tests first, then confirm the layout still consumes the output correctly.

### Round 10: Change checklist
28. What should you verify before editing Documents? Answer: node types, parent-child relationships, and import/export flow.
29. What kind of change creates the widest blast radius? Answer: node IDs, tree relationships, and reference extraction rules.
30. What should you verify after editing? Answer: create, rename, save, search, graph, and chat-context injection flows.

## 3. Pipeline

### Round 1: Route and entry
1. What is the real route for Pipeline? Answer: `/pipeline`.
2. What is the layout entry file? Answer: `src/components/pipeline/PipelineLayout.tsx`.
3. What are the key visual areas? Answer: the editor, flow or source views, execution history, and assistant drawer.

### Round 2: UI composition
4. What is `PipelineLayout` responsible for? Answer: editing, execution state, history, diagram rendering, and assistant-guided authoring.
5. Which components render the flow view? Answer: `PipelineFlowDiagram` and `PipelineFlowCanvas`.
6. Why is execution history integrated into the main module? Answer: because authoring and debugging are one workflow.

### Round 3: State and types
7. Which store domains matter most? Answer: `agentPipeline`, `agentPipelineName`, `selectedAgentPipelineId`, and `agentPipelines`.
8. Which types matter most? Answer: `AgentPipeline`, `AgentPipelineStep`, `AgentPipelineExecution`, and `AgentPipelineVariable`.
9. Why are variable values tracked separately? Answer: because editor structure and runtime values diverge during execution.

### Round 4: Services and runtime path
10. Where is the execution service? Answer: `src/services/agentPipelineService.ts`.
11. Where is validation handled? Answer: `src/services/pipelineValidation.ts`.
12. Where do diagram generation and optimization live? Answer: `pipelineMermaid.ts` and `pipelineOptimization.ts`.

### Round 5: Persistence and import/export
13. Where is file-backed pipeline behavior implemented? Answer: `src/services/pipelineFiles.ts`.
14. Where is portable import/export logic implemented? Answer: `src/services/pipelinePortability.ts`.
15. Why is Pipeline not just store state? Answer: because saved workflows and execution history have explicit disk-backed lifecycle concerns.

### Round 6: Cross-module collaboration
16. How does Pipeline connect to Agents? Answer: each step binds to a concrete agent.
17. How does Pipeline connect to Chat? Answer: chat commands can invoke saved pipelines.
18. How does Pipeline connect to Timer? Answer: timers can execute saved pipelines directly.

### Round 7: Safety and boundaries
19. What is the main Pipeline boundary? Answer: it chains models, agents, and tools into a larger automated execution surface.
20. Why are budgets and retries also safety controls? Answer: because they constrain resource usage and failure amplification.
21. Which steps should stay single-purpose? Answer: steps involving tools, external systems, or expensive reasoning.

### Round 8: Failure and fallback
22. Where should you look first when execution fails? Answer: step inputs, variable substitution, agent binding, and tool or model readiness.
23. Why do fallback labels matter? Answer: because they show when execution downgraded from the workflow path to the legacy path.
24. Where should you look when `runIf` causes wrong skips? Answer: the condition expression, variable values, and enabled-state of the step.

### Round 9: Testing and validation
25. Which nearby tests anchor Pipeline? Answer: `PipelineLayout.test.tsx`, `agentPipelineService.test.ts`, and `pipelineRunIf.test.ts`.
26. What do they mainly validate? Answer: execution order, conditions, history, and failure behavior.
27. What is the smallest useful validation after pipeline-runtime changes? Answer: run service tests first, then verify history and status presentation in the layout.

### Round 10: Change checklist
28. What should you verify before editing Pipeline? Answer: step schema, execution-history shape, and disk format.
29. What creates the most compatibility risk? Answer: step fields, variable-reference format, and import/export protocol changes.
30. What should you verify after editing? Answer: save, dry-run, real execution, history presentation, Mermaid preview, and chat trigger paths.

## 4. Models

### Round 1: Route and entry
1. What is the real route for Models? Answer: `/models` redirects to `/models/providers`, and the main route is `/models/:view`.
2. Which views are valid? Answer: `providers`, `models`, and `compare`.
3. What is the layout entry file? Answer: `src/components/models/ModelsLayout.tsx`.

### Round 2: UI composition
4. Which editor components matter most? Answer: `ProviderEditor`, `ModelParamEditor`, and `ModelComparisonPanel`.
5. Where is view switching controlled? Answer: inside `ModelsLayout` through route params and local view-mode logic.
6. Why does the layout track connection state? Answer: because availability needs to be visible directly in the provider workspace.

### Round 3: State and types
7. Which store domains matter most? Answer: `providerConfigs`, `models`, and `selectedModel`.
8. Where do provider presets come from? Answer: `src/store/slices/modelConfigSlice.ts`.
9. Why separate provider configs from model entries? Answer: because one provider can own many models with independent enablement and parameters.

### Round 4: Services and runtime path
10. Where is runtime model behavior implemented? Answer: `src/services/aiService.ts`.
11. How is connection testing performed? Answer: through the same AI service layer.
12. How does provider-to-model syncing happen? Answer: store-slice logic expands provider configs into the enabled model surface.

### Round 5: Persistence and import/export
13. Where are model settings persisted? Answer: in the global persisted store and optionally workspace-backed settings.
14. Why does workspace loading affect this module? Answer: because the layout loads and saves workspace settings when a workspace path exists.
15. Why must models be resynced after provider deletion? Answer: because provider-derived model entries must be removed too.

### Round 6: Cross-module collaboration
16. Which modules depend on Models? Answer: Chat, Agents, Pipeline, Timer, and Channels.
17. Why should agent docs not hardcode a flattened provider list? Answer: because true provider support is split across runtime support and UI exposure.
18. What does Compare influence downstream? Answer: agent bindings, default model strategy, and workflow cost design.

### Round 7: Safety and boundaries
19. What is the most sensitive boundary in Models? Answer: API keys, base URLs, and the set of callable models.
20. What role does secure storage play? Answer: it determines whether credentials are persisted safely.
21. Why must runtime support and UI exposure be documented separately? Answer: because `aiService` supports more provider types than the current editor UI exposes.

### Round 8: Failure and fallback
22. Where should you look first when a provider is saved but unusable? Answer: connection testing, base URL, model ID, and whether any model is enabled.
23. Why do some providers briefly appear as checking? Answer: because the layout schedules idle-time connectivity probes.
24. Where should you continue debugging after a provider shows disconnected? Answer: the AI service error path and the specific provider configuration.

### Round 9: Testing and validation
25. Which nearby tests anchor Models? Answer: `aiService.test.ts` and `appStore.test.ts`.
26. What do they mainly validate? Answer: provider behavior, configuration sync, and store integration.
27. What is the smallest useful validation after provider logic changes? Answer: run service and store tests, then manually verify subview switching and enablement behavior.

### Round 10: Change checklist
28. What should you verify before editing Models? Answer: provider types, presets, and route-driven view constraints.
29. What is easiest to misdocument? Answer: the gap between runtime provider support and the provider-type picker in the UI.
30. What should you verify after editing? Answer: provider add, save, test, model enablement, and compare entry paths.

## 5. Agents

### Round 1: Route and entry
1. What is the real route for Agents? Answer: `/agents`.
2. What is the layout entry file? Answer: `src/components/agents/AgentsLayout.tsx`.
3. Which subcomponents matter most? Answer: `AgentEditor`, `AgentTestChat`, `AgentAssistantDrawer`, and `AgentOrchestrationPanel`.

### Round 2: UI composition
4. What does the left side of the layout do? Answer: search, filter, and switch between agents.
5. What does the right side do? Answer: edit prompts, models, skills, tool policy, and provide test and orchestration views.
6. Why does test chat live inside the same module? Answer: because agent authoring and verification are part of the same loop.

### Round 3: State and types
7. Which store domains matter most? Answer: `agents`, `agentVersions`, `agentPerformance`, `globalMemories`, and `agentSelectionPreferences`.
8. Which types matter most? Answer: `Agent`, `AgentMemoryEntry`, and the version and performance models.
9. Why do `maxTurns` and permission mode matter? Answer: because they are real runtime controls, not decorative metadata.

### Round 4: Services and runtime path
10. Which services anchor agent runtime behavior? Answer: `agentCommunication.ts`, `agentSelection.ts`, and `agentDiagnostics.ts`.
11. Where are built-in agent localization and refresh rules implemented? Answer: `src/store/appStore.ts`.
12. Why should builder agents be checked in the store first? Answer: because their prompts and normalization logic are seeded there.

### Round 5: Persistence and import/export
13. Where is agent state persisted? Answer: in the global persisted store.
14. Why do version snapshots matter? Answer: because they support rollback during major prompt or permission changes.
15. Why is import/export a first-class concern? Answer: because custom agents are durable assets, not just transient UI forms.

### Round 6: Cross-module collaboration
16. How do Agents connect to Skills? Answer: agents pull skill packages into their runtime context.
17. How do Agents connect to Pipeline? Answer: pipeline steps bind to agent IDs.
18. How do Agents connect to Channels? Answer: channel configs assign one reply agent per inbound surface.

### Round 7: Safety and boundaries
19. What is the main risk surface in Agents? Answer: the combination of system prompt, tool allow or deny lists, and permission mode.
20. Why should built-in agents not be documented as simple role labels? Answer: because they also carry real runtime behavior and constraints.
21. Why must skills not be described as tool implementations? Answer: because they live at the prompt and resource layer, not the runtime tool-permission layer.

### Round 8: Failure and fallback
22. Where should you look first when an agent behaves incorrectly? Answer: prompt text, model binding, skill binding, and tool policy.
23. Where should you look when a builder agent behaves unexpectedly? Answer: the built-in definitions and localization-refresh logic in `appStore.ts`.
24. Why can test-chat output differ from full chat output? Answer: because session context, selected model, and surrounding state may differ.

### Round 9: Testing and validation
25. Which nearby tests anchor Agents? Answer: `AgentAssistantDrawer.test.tsx`, `SystemPromptMarkdownEditor.test.tsx`, and `agentCommunication.test.ts`.
26. What do they mainly validate? Answer: editing behavior, prompt handling, and communication logic.
27. What is the smallest useful validation after agent-schema changes? Answer: run component and service tests, then do one in-module test-chat pass.

### Round 10: Change checklist
28. What should you verify before editing Agents? Answer: the built-in agent list, shared types, and patch normalization logic.
29. What creates the biggest compatibility risk? Answer: changes to the `Agent` shape, snapshot format, or built-in refresh conditions.
30. What should you verify after editing? Answer: listing, editing, test chat, snapshots, and skill bindings.

## 6. Skills

### Round 1: Route and entry
1. What is the real route for Skills? Answer: `/skills`.
2. What happens to `/skills/:view`? Answer: it redirects back to `/skills`.
3. What is the layout entry file? Answer: `src/components/skills/SkillsLayout.tsx`.

### Round 2: UI composition
4. What is the primary editor surface? Answer: `SkillEditor` and its related panels.
5. What does the left side of the layout do? Answer: list installed skills, filter by source, and toggle local directory sources.
6. Why is source display so important? Answer: because identically named skills may come from different origins with different persistence semantics.

### Round 3: State and types
7. Which store domains matter most? Answer: `skills`, `externalDirectories`, and `skillVersions`.
8. Which types matter most? Answer: `Skill`, `SkillSource`, frontmatter types, and registry-source types.
9. Why keep both `skillRoot` and `filePath`? Answer: because file-based and folder-based skills persist differently.

### Round 4: Services and runtime path
10. Where is `SKILL.md` parsing and serialization implemented? Answer: `src/services/skillRegistry.ts`.
11. Where is package import/export implemented? Answer: `src/services/skillArchive.ts`.
12. Where is registry browsing and install logic implemented? Answer: `src/services/skillMarketplace.ts`.

### Round 5: Persistence and import/export
13. Where are skills saved? Answer: local, project, user, and folder-backed skills write back to real disk locations.
14. Where do new skills go by default? Answer: into the workspace `.suora/skills/` directory when a workspace path exists.
15. Why does save logic need to ensure directories first? Answer: because skills are filesystem assets, not just in-memory store objects.

### Round 6: Cross-module collaboration
16. How do Skills connect to Agents? Answer: agent runtime context pulls enabled skills into the prompt layer.
17. How do Skills connect to Settings? Answer: external-directory settings determine which shared skill sources are loaded.
18. Why should docs mention directory normalization? Answer: because Claude Code and other shared-agent directories are normalized for compatibility.

### Round 7: Safety and boundaries
19. What is the main risk surface in Skills? Answer: untrusted text, bundled resources, and executable scripts.
20. Why are skills not the tool system? Answer: because they do not grant runtime permission on their own.
21. Which resources deserve extra caution? Answer: files under `scripts/` and any bundle from an untrusted source.

### Round 8: Failure and fallback
22. Where should you look first when skill loading fails? Answer: `SKILL.md` parsing, file paths, and external-directory enablement.
23. Where should you look first when saving fails? Answer: workspace path, target directory, and disk-write permissions.
24. Where should you look when source filtering feels wrong? Answer: the `source` field and source-path normalization logic.

### Round 9: Testing and validation
25. Which nearby tests anchor Skills? Answer: `SkillsLayout.test.tsx`, `SkillEditor.test.tsx`, and `skillRegistry.test.ts`.
26. What do they mainly validate? Answer: layout behavior, editing behavior, and `SKILL.md` parsing or serialization.
27. What is the smallest useful validation after skill-format changes? Answer: run registry tests first, then verify save and reload through the layout.

### Round 10: Change checklist
28. What should you verify before editing Skills? Answer: the source model, disk format, and compatibility mapping logic.
29. What creates the biggest compatibility risk? Answer: frontmatter format, serialization rules, and source-path interpretation.
30. What should you verify after editing? Answer: create, save, reload, import/export, and agent-binding behavior.

## 7. Timer

### Round 1: Route and entry
1. What is the real route for Timer? Answer: `/timer`.
2. What is the layout entry file? Answer: `src/components/timer/TimerLayout.tsx`.
3. Which subcomponents matter most? Answer: `TimerForm`, `TimerDetail`, and `TimerAssistantDrawer`.

### Round 2: UI composition
4. What does the left side of the layout handle? Answer: search, selection, enablement, and new-task entry points.
5. What does the right side handle? Answer: form editing, task detail, and execution insight.
6. Why is AI Create exposed at the top? Answer: because timer configuration supports natural-language authoring.

### Round 3: State and types
7. What local state matters most? Answer: the timer list, selected timer, edit state, create state, and search state.
8. Which types matter most? Answer: `ScheduledTask`, timer-form types, and execution state types.
9. Why does Timer load `agentPipelines`? Answer: because pipeline execution is one of the supported actions.

### Round 4: Services and runtime path
10. How does Timer talk to Electron? Answer: through `electronInvoke`, `electronOn`, `electronOff`, and the timer helper layer.
11. Where is post-fire runtime behavior implemented? Answer: `src/services/timerRuntime.ts`.
12. Why does the layout listen for `timer:fired`? Answer: to refresh renderer state after main-process execution.

### Round 5: Persistence and import/export
13. Who owns timer persistence? Answer: mainly the Electron-side timer system rather than a purely renderer-owned store slice.
14. Why must the layout still load the list? Answer: because the UI needs real task state and next-run information.
15. How are pipeline dependencies integrated? Answer: by loading saved pipeline files from disk.

### Round 6: Cross-module collaboration
16. How does Timer connect to Pipeline? Answer: a timer action can execute a saved pipeline.
17. How does Timer connect to Agents? Answer: a timer action can run an agent prompt.
18. How does Timer connect to Settings? Answer: global environment, security, and logs influence unattended execution.

### Round 7: Safety and boundaries
19. What is the main risk surface in Timer? Answer: unattended repetition, cost amplification, and high-permission automation.
20. Why are action types intentionally constrained? Answer: to avoid turning Timer into an arbitrary OS task runner.
21. Which timers should always be tested with Run now? Answer: any task that hits models, pipelines, or external platforms.

### Round 8: Failure and fallback
22. Where should you look first when the list does not refresh? Answer: main-process events, list APIs, and refresh scheduling.
23. Where should you look first when a timer fires but does nothing useful? Answer: the bound agent or pipeline, model readiness, and logs.
24. Why do sleep or resume states matter so much? Answer: because scheduling and catch-up semantics depend on runtime continuity.

### Round 9: Testing and validation
25. Which nearby tests anchor Timer? Answer: `TimerLayout.test.tsx` and `timerRuntime.test.ts`.
26. What do they mainly validate? Answer: layout behavior, task management, and fire-time logic.
27. What is the smallest useful validation after timer-action changes? Answer: run runtime tests first, then validate creation and Run now paths in the layout.

### Round 10: Change checklist
28. What should you verify before editing Timer? Answer: action types, main-process event names, and form fields.
29. What is easiest to break accidentally? Answer: scheduling fields, event synchronization, and pipeline dependency loading.
30. What should you verify after editing? Answer: create, update, enable or disable, Run now, and list refresh behavior.

## 8. Channels

### Round 1: Route and entry
1. What is the real route for Channels? Answer: `/channels`.
2. What is the layout entry file? Answer: `src/components/channels/ChannelLayout.tsx`.
3. Which subcomponents matter most? Answer: `ChannelEditor`, `ChannelPanels`, and `ChannelIcons`.

### Round 2: UI composition
4. Which detail tabs exist? Answer: `config`, `messages`, `users`, `health`, and `debug`.
5. Why separate Config and Health? Answer: one is static configuration, the other is live runtime evidence.
6. Why is the webhook URL emphasized? Answer: because it is the critical operator surface for callback-based platforms.

### Round 3: State and types
7. Which store domains matter most? Answer: `channels`, `channelMessages`, `channelHealth`, `channelUsers`, and `channelTokens`.
8. Which types matter most? Answer: `ChannelConfig`, `ChannelPlatform`, `ChannelStatus`, and the message or user models.
9. Which platforms currently exist? Answer: WeChat Work, Personal WeChat, WeChat Official Account, WeChat Mini Program, Feishu, DingTalk, Slack, Telegram, Discord, Teams, Email, and Custom.

### Round 4: Services and runtime path
10. Where is renderer-side channel runtime behavior implemented? Answer: `src/services/channelMessageHandler.ts`.
11. Where is Electron-side channel behavior implemented? Answer: `electron/channelService.ts`.
12. How do webhook-service controls enter the UI? Answer: through channel-service start, stop, status, and URL helpers.

### Round 5: Persistence and import/export
13. Where is channel config persisted? Answer: in the global persisted store.
14. Why are messages and health stored too? Answer: because multiple tabs need to observe the same live channel state.
15. Why is Email configuration more than a small add-on? Answer: because it introduces IMAP, SMTP, filtering, and multi-action runtime behavior.

### Round 6: Cross-module collaboration
16. How do Channels connect to Agents? Answer: each channel binds one reply agent.
17. How do Channels connect to Models? Answer: the reply agent still depends on model readiness.
18. How do Channels connect to Settings and Logs? Answer: global security and diagnostics shape how safely and visibly the channel runtime operates.

### Round 7: Safety and boundaries
19. What is the main risk surface in Channels? Answer: open inbound traffic, auto-reply, and platform secrets.
20. Why can stream mode be safer? Answer: because it often avoids exposing a public callback endpoint.
21. What extra risk does Email add? Answer: mailbox credentials, polling rules, and action-chain misfires.

### Round 8: Failure and fallback
22. Where should you look first when callbacks never arrive? Answer: enabled state, server state, platform URL or secret, and the Debug panel.
23. Where should you look first when Personal WeChat binding misbehaves? Answer: binding status, QR-code URL, and bridge-related fields.
24. Where should you look first when Email processing is broken? Answer: IMAP or SMTP settings, TLS, polling interval, filters, and action rules.

### Round 9: Testing and validation
25. Which nearby tests anchor Channels? Answer: `ChannelEditor.test.tsx`, `ChannelPanels.test.tsx`, and `channelMessageHandler.test.ts`.
26. What do they mainly validate? Answer: editing behavior, runtime observation panels, and message-handling logic.
27. What is the smallest useful validation after channel-schema changes? Answer: run editor and handler tests first, then verify the affected tabs manually.

### Round 10: Change checklist
28. What should you verify before editing Channels? Answer: platform enums, connection modes, reply-agent binding, and the Electron bridge.
29. What creates the biggest blast radius? Answer: platform-type changes, credential-field changes, and message or health schema changes.
30. What should you verify after editing? Answer: create flow, tab switching, server state, webhook URL display, and runtime observation panels.

## 9. MCP

### Round 1: Route and entry
1. What is the real route for MCP? Answer: `/mcp`.
2. Which layout does that route mount? Answer: `src/components/integrations/IntegrationsLayout.tsx`.
3. What is the real working surface? Answer: `MCPSettingsPanel`.

### Round 2: UI composition
4. Why is `IntegrationsLayout` so thin? Answer: because the current `/mcp` route is almost entirely a wrapper around the MCP panel.
5. What is the MCP panel responsible for? Answer: server listing, config editing, connection status, and capability inspection.
6. Why is this not just another miscellaneous settings page? Answer: because it directly affects what agents can execute.

### Round 3: State and types
7. Which store domain matters most? Answer: `mcpServers`.
8. Which types matter most? Answer: `MCPServerConfig`, `MCPServerStatus`, `MCPTransport`, and `MCPServerScope`.
9. Why is scope modeled explicitly? Answer: because workspace and user scope have very different blast radii.

### Round 4: Services and runtime path
10. Where is the core service? Answer: `src/services/mcpSystem.ts`.
11. What does connection validation do? Answer: it validates transport, command or URL, headers, env vars, and status.
12. Why distinguish `stdio` from network transports? Answer: because their privilege boundaries and runtime assumptions differ materially.

### Round 5: Persistence and import/export
13. Where is MCP config persisted? Answer: in the global persisted store.
14. Why does it need persistence at all? Answer: because MCP servers are reusable cross-session capability surfaces.
15. Is there a separate import/export format today? Answer: not as a primary public surface; it mainly relies on persisted configuration state.

### Round 6: Cross-module collaboration
16. How does MCP connect to Agents? Answer: agents can discover and call connected MCP capabilities.
17. How does MCP connect to Chat? Answer: chat tasks can consume MCP tools when the chosen agent is allowed to use them.
18. How does MCP connect to Settings? Answer: global environment and security assumptions shape whether services can run correctly.

### Round 7: Safety and boundaries
19. What is the main MCP risk surface? Answer: high-permission external capabilities entering the workbench through agents.
20. Why validate URL protocols? Answer: because network transports only allow explicit protocol classes.
21. Why should renderer code not spawn `stdio` services directly? Answer: because privileged process work must stay behind the Electron boundary.

### Round 8: Failure and fallback
22. Where should you look first when a server will not connect? Answer: transport, URL, command, env vars, headers, and the service itself.
23. What if the config saves but agents still cannot see the service? Answer: verify status first, then inspect the agent runtime path.
24. Which errors are most likely pure configuration errors? Answer: invalid protocol, wrong scope assumptions, or missing auth fields.

### Round 9: Testing and validation
25. Which nearby tests anchor MCP? Answer: `mcpSystem.test.ts`.
26. What does it mainly validate? Answer: configuration validation and connection-related logic.
27. What is the smallest useful validation after MCP config changes? Answer: run the service test and then confirm the `/mcp` panel still reports status correctly.

### Round 10: Change checklist
28. What should you verify before editing MCP? Answer: transport enums, scope model, and status structure.
29. What is easiest to misdocument? Answer: treating network services and `stdio` services as if they share the same security model.
30. What should you verify after editing? Answer: create flow, save path, connection test, and status display.

## 10. Settings

### Round 1: Route and entry
1. What is the real route for Settings? Answer: `/settings/:section` with `/settings` redirecting to `/settings/general`.
2. What is the layout entry file? Answer: `src/components/settings/SettingsLayout.tsx`.
3. Which sections exist today? Answer: `general`, `security`, `voice`, `shortcuts`, `data`, `knowledge`, `events`, `external-dirs`, `plugins`, `logs`, and `system`.

### Round 2: UI composition
4. What is `SettingsLayout` responsible for? Answer: section navigation, a summary header, and lazy-loaded settings panels.
5. Why are sections lazy-loaded? Answer: to avoid loading every settings panel at once.
6. Why show section, category, and scope in the header? Answer: so users know what kind of setting they are editing and whether it is local or workspace-scoped.

### Round 3: State and types
7. Which store domains matter most? Answer: theme, locale, tool security, shortcuts, proxy, environment variables, email config, onboarding, and external directories.
8. Which types matter most? Answer: `ToolSecuritySettings`, `WorkspaceSettings`, `ExternalDirectoryConfig`, and related provider-setting models.
9. Why is Settings effectively a global control plane? Answer: because it shapes default behavior and risk boundaries across all modules.

### Round 4: Services and runtime path
10. Which files anchor settings logic? Answer: `appStore.ts`, `modelConfigSlice.ts`, `secureState.ts`, and `workspaceSettings.ts`.
11. Why is provider safety still a Settings concern? Answer: because workspace settings and tool security are coordinated here.
12. How do external directories tie into Settings? Answer: settings are the source of truth for loading shared skill and agent directories.

### Round 5: Persistence and import/export
13. How are settings persisted? Answer: mainly through the global persisted store plus workspace-backed save and load paths.
14. Why is the Data section important? Answer: because it owns import, export, backup, and cleanup workflows.
15. Why can settings changes ripple into other modules? Answer: because many modules treat these values as runtime prerequisites.

### Round 6: Cross-module collaboration
16. How does Settings connect to Models? Answer: credential persistence, security warnings, and workspace provider configuration are all controlled here.
17. How does Settings connect to Skills and Agents? Answer: through external directories, shared resources, and workspace save behavior.
18. How does Settings connect to Channels and MCP? Answer: through global diagnostics, safety constraints, and runtime environment assumptions.

### Round 7: Safety and boundaries
19. What are the core safety boundaries in Settings? Answer: secure storage, tool confirmation, allowed directories, and dangerous-shell blocking.
20. Why must secure-storage warnings remain user-visible? Answer: because users need to know whether keys are safely persisted or memory-only.
21. Why should plugins and external directories be treated cautiously? Answer: because they expand what the workbench can load and execute.

### Round 8: Failure and fallback
22. Where should you look first when a settings change does not stick? Answer: store persistence, workspace read or write logic, and the owning section.
23. Where should you look when keys vanish after restart? Answer: `secureState.ts`, the warning listener in `src/App.tsx`, and the host keyring state.
24. Which file should win when section counts disagree with docs? Answer: the `SETTING_SECTIONS` list in `SettingsLayout.tsx`.

### Round 9: Testing and validation
25. Which nearby tests anchor Settings? Answer: `workspaceSettings.test.ts`, `secureState.test.ts`, and `appStore.test.ts`.
26. What do they mainly validate? Answer: persistence, secure-state behavior, and store-level logic.
27. What is the smallest useful validation after settings-structure changes? Answer: run the service and store tests, then confirm route and sidebar alignment.

### Round 10: Change checklist
28. What should you verify before editing Settings? Answer: the real section list, scope model, and persistence edges.
29. What creates the most documentation drift here? Answer: adding or removing sections, renaming security controls, or changing default redirects.
30. What should you verify after editing? Answer: sidebar navigation, section lazy-loading, save behavior, and secure-storage warning flows.