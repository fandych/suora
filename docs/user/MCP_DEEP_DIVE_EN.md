# Suora MCP Deep Dive (30 Concrete Iteration Points)

This guide expands the `MCP` module into 30 concrete iteration points focused on service onboarding, scope, transport choice, trust boundaries, and diagnosis flow.

## 1. Core understanding

1. MCP is an external-capability entry layer, not a miscellaneous settings afterthought.
2. Separate workspace scope from user scope early.
3. Separate `stdio` transports from network transports.
4. Separate “service did not connect” from “agent cannot see it”.
5. Do not confuse Skills with MCP services.

## 2. Transport fit

6. Use `stdio` for local process-backed services.
7. Use `http` for stable request-response services.
8. Use `sse` for event-stream driven services.
9. Use `ws` for longer-lived socket interactions.
10. Let the service shape pick the transport, not habit.

## 3. Configuration discipline

11. Keep URL, command, args, env, and headers minimal.
12. Inject only necessary environment variables.
13. Keep headers limited to required authentication.
14. Reserve user scope for services that truly need cross-workspace visibility.
15. Use workspace scope for project-specific capabilities.

## 4. Use and diagnosis

16. Test the connection before going back to Chat.
17. After connection succeeds, verify capability visibility through the agent path.
18. If the agent cannot see a service, check status first and permissions second.
19. If a URL looks valid but fails, inspect protocol and reachability.
20. If `stdio` fails, inspect command, working directory, and environment.

## 5. Risk and trust

21. High-permission MCP services should be reserved for narrow agents.
22. User-scoped services expand the blast radius of mistakes.
23. Production-system MCP services deserve extra review.
24. Untrusted third-party MCP services should not enter core workflows casually.
25. Sensitive auth headers must not leak into ordinary docs or skills.

## 6. Governance and maintenance

26. Disable or remove stale services.
27. Re-evaluate scope whenever a service’s ownership changes.
28. Consolidate overlapping services before the list becomes noisy.
29. Keep validation notes for critical services.
30. A good MCP setup should be connected reliably, scoped clearly, trusted deliberately, and used verifiably.