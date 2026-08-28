# Suora Chat Technical Deep Dive (30 Technical Points)

## 1. Route and loading

1. The real Chat route is `/chat`.
2. The layout entry file is `src/components/chat/ChatLayout.tsx`.
3. `ChatLayout` composes the session rail and the main chat area.
4. The session rail is lazy-loaded.
5. `scheduleAfterPaint` delays some sidebar hydration until after initial paint.

## 2. Component structure

6. `SessionList` owns the session rail surface.
7. `ChatMain` owns most behavioral complexity.
8. `ResizeHandle` controls session rail sizing.
9. `useResizablePanel` persists panel width as a module preference.
10. A rail skeleton prevents layout flash during lazy hydration.

## 3. State and types

11. Chat heavily consumes the `sessions` state domain.
12. Chat heavily consumes the `activeSession` state domain.
13. Chat heavily consumes the `sessionTabs` state domain.
14. Chat also depends on `selectedModel`, `agents`, and `skills`.
15. Key shared types include `Session`, message types, `Agent`, and `Model`.

## 4. Services and runtime path

16. `src/hooks/useAIChat.ts` is the primary AI interaction entry point.
17. `src/services/aiService.ts` is the model invocation abstraction.
18. Slash or control commands enter through command dispatch services.
19. Tool events are surfaced back to the chat UI from the service layer.
20. Chat is the execution face of the workbench rather than an isolated feature.

## 5. Safety and failure modes

21. Tool permissions are jointly shaped by agent policy and global safety settings.
22. Secure-storage failures directly affect key persistence for Chat.
23. Failed replies should be separated into provider failures versus context failures.
24. Tool failures should be separated into permission failures versus environment failures.
25. Session contamination is a common logic-level Chat failure source.

## 6. Tests and change checks

26. Nearby tests include `ChatMain.test.tsx`.
27. Nearby tests include `ChatMessages.test.tsx`.
28. Nearby tests include `SessionList.test.tsx`.
29. Chat changes should first validate message sending, session switching, and tool event presentation.
30. The technical goal of Chat maintenance is a clear execution path, explicit permission boundaries, and fast failure localization.