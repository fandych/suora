# Suora Agents Technical Deep Dive (30 Technical Points)

## 1. Route and layout

1. The real Agents route is `/agents`.
2. The layout entry file is `src/components/agents/AgentsLayout.tsx`.
3. The left rail owns search and selection.
4. The right workspace owns configuration, testing, and orchestration.
5. `AgentTestChat` is part of the module's validation loop.

## 2. State and types

6. Key store domains include `agents`.
7. Key store domains include `agentVersions`.
8. Key store domains include `agentPerformance`.
9. Key store domains include `globalMemories` and `agentSelectionPreferences`.
10. The `Agent` type is a real runtime configuration object, not a cosmetic profile.

## 3. Build and runtime path

11. Built-in agent seeding logic lives in `src/store/appStore.ts`.
12. Localization-refresh behavior for built-ins also lives in store logic.
13. `agentCommunication.ts` anchors runtime communication behavior.
14. `agentSelection.ts` anchors selection-related runtime behavior.
15. `agentDiagnostics.ts` anchors diagnostic behavior.

## 4. Configuration reality

16. Agent configuration includes prompt, model, skills, tools, and permission mode.
17. `maxTurns` is a true runtime boundary rather than decorative metadata.
18. Memories and autoLearn affect long-term behavior and should be documented as such.
19. Skill binding is a prompt/resource composition layer, not a tool-implementation layer.
20. Builder agents and business agents must remain distinct in documentation.

## 5. Risk and failure modes

21. Broad-permission agents are a common risk amplifier.
22. Overwide system prompts increase mis-execution risk.
23. Test-chat and full-chat differences often come from session-context differences.
24. Imported agents should be re-audited for models, skills, and permissions.
25. Version snapshots are the rollback mechanism for high-risk edits.

## 6. Tests and change checks

26. Nearby tests include `AgentAssistantDrawer.test.tsx`.
27. Nearby tests include `SystemPromptMarkdownEditor.test.tsx`.
28. Nearby tests include `agentCommunication.test.ts`.
29. Agent changes should first validate editing, snapshots, test chat, and skill bindings.
30. The technical goal of Agents maintenance is clear roles, explainable configuration, narrow permissions, and reversible evolution.