# Suora Skills Technical Deep Dive (30 Technical Points)

## 1. Route and layout

1. The real Skills route is `/skills`.
2. Legacy `/skills/:view` redirects back to `/skills`.
3. The layout entry file is `src/components/skills/SkillsLayout.tsx`.
4. The left side owns source filtering and list selection.
5. The right side centers on `SKILL.md` editing and bundled resources.

## 2. State and types

6. Key store domains include `skills`.
7. Key store domains include `externalDirectories`.
8. Key store domains include `skillVersions`.
9. Key types include `Skill`, `SkillSource`, and registry-source models.
10. `skillRoot` and `filePath` coexist to support both folder-backed and file-backed skills.

## 3. Services and persistence

11. `src/services/skillRegistry.ts` owns `SKILL.md` parsing and serialization.
12. `src/services/skillArchive.ts` owns packaged import/export.
13. `src/services/skillMarketplace.ts` owns registry browsing and install flows.
14. Skill saves are real disk writes, not just store mutations.
15. New workspace skills default into `.suora/skills/` when a workspace exists.

## 4. Source and resource reality

16. Current source types include local, project, user, registry, workspace, and shared-directory variants.
17. Claude Code and other-agent directories have compatibility normalization logic.
18. Resource trees let a skill carry templates, scripts, and auxiliary assets.
19. `scripts/` resources should be treated as higher-risk content.
20. The skill system is a prompt/resource layer rather than the executable tool layer.

## 5. Risk and failure modes

21. Untrusted skill content can pollute agent runtime context.
22. Untrusted bundled scripts can widen execution risk.
23. Save failures commonly involve workspace path or filesystem permissions.
24. Load failures commonly involve parsing, paths, or source enablement.
25. Documentation must preserve the “skills are not tools” boundary.

## 6. Tests and change checks

26. Nearby tests include `SkillsLayout.test.tsx`.
27. Nearby tests include `SkillEditor.test.tsx`.
28. Nearby tests include `skillRegistry.test.ts`.
29. Skills changes should first validate save, reload, source filtering, and import/export flows.
30. The technical goal of Skills maintenance is traceable sources, stable format, reviewable resources, and clear Agent integration.