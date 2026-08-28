# Suora MCP Technical Deep Dive (30 Technical Points)

## 1. Route and layout

1. The real MCP route is `/mcp`.
2. The route mounts through `IntegrationsLayout`.
3. The real working panel is `MCPSettingsPanel`.
4. The UI is thin but the runtime boundary is heavy.
5. Documentation should not flatten MCP into a miscellaneous settings page.

## 2. State and types

6. The key store domain is `mcpServers`.
7. Core types include `MCPServerConfig`.
8. Core types include `MCPServerStatus`.
9. Core types include `MCPTransport` and `MCPServerScope`.
10. Scope is part of the module's safety and sharing model.

## 3. Services and validation

11. The core service anchor is `src/services/mcpSystem.ts`.
12. Connection validation checks transport, command or URL, headers, env, and status behavior.
13. `stdio` and network transports must be documented separately.
14. Renderer code should not bypass the Electron boundary to launch privileged process behavior.
15. Protocol validation is a real safety constraint rather than a cosmetic form rule.

## 4. Runtime reality

16. `http`, `sse`, and `ws` fail in different network patterns.
17. `stdio` failures usually come from command, cwd, or env problems.
18. User-scoped services widen the blast radius of mistakes.
19. Workspace-scoped services better fit project-specific tooling.
20. Agent visibility of MCP capability still depends on downstream execution context.

## 5. Risk and failure modes

21. High-permission MCP services amplify Agent risk.
22. Sensitive auth headers should not leak into ordinary docs or skills.
23. Untrusted third-party MCP services should not enter critical workflows casually.
24. A healthy status does not guarantee that agents consume the capability correctly.
25. Failure diagnosis should distinguish “service did not connect” from “service was not consumed”.

## 6. Tests and change checks

26. Nearby tests include `mcpSystem.test.ts`.
27. MCP changes should first validate transport rules and status presentation.
28. Scope-model changes require renewed safety review.
29. URL or command validation changes require synchronized documentation review.
30. The technical goal of MCP maintenance is reliable connectivity, clear scope, constrained permissions, and verifiable capability.