# Suora Settings Technical Deep Dive (30 Technical Points)

## 1. Route and layout

1. The real Settings route is `/settings/:section`.
2. `/settings` redirects to `/settings/general`.
3. The layout entry file is `src/components/settings/SettingsLayout.tsx`.
4. The sidebar section list is sourced from `SETTING_SECTIONS`.
5. Panels are lazy-loaded to avoid loading every settings surface at once.

## 2. State and types

6. Settings is backed by the global persisted store.
7. Theme, locale, shortcuts, proxy, and environment variables all converge here.
8. `ToolSecuritySettings` is one of the highest-risk shared configuration types.
9. `WorkspaceSettings` and external-directory models are also governed here.
10. Settings should be documented as the global control plane rather than a catch-all page.

## 3. Services and synchronization

11. `src/store/appStore.ts` is the core state anchor.
12. `modelConfigSlice.ts` reflects provider-security and synchronization boundaries here.
13. `secureState.ts` owns key-persistence failure behavior.
14. `workspaceSettings.ts` owns important workspace read/write behavior.
15. External-directory and shared-resource loading depend on settings persistence.

## 4. Current product reality

16. The real settings surface has 11 sections rather than the older 7-section shape.
17. Knowledge and Events are first-class sections and must not be omitted.
18. External Directories and Plugins are also first-class sections.
19. Logs and System are operational diagnosis surfaces rather than novelty pages.
20. Secure-storage warnings are explicitly surfaced into the renderer through `src/App.tsx`.

## 5. Risk and failure modes

21. When settings appear not to apply, local state, workspace state, and cached state must be separated.
22. When keys disappear after restart, secure-storage state should be checked first.
23. Tool confirmation, allowlists, and dangerous-shell blocking are the primary high-risk safety gates.
24. Stale external directories and plugins widen unnecessary risk surface.
25. Major settings edits should be coupled with export and rollback awareness.

## 6. Tests and change checks

26. Nearby tests include `workspaceSettings.test.ts`.
27. Nearby tests include `secureState.test.ts`.
28. Nearby tests include related settings behavior in `appStore.test.ts`.
29. Settings changes should first validate section navigation, save behavior, and secure-warning flow.
30. The technical goal of Settings maintenance is controlled global behavior, stable persistence, explicit safety boundaries, and clear diagnostics.