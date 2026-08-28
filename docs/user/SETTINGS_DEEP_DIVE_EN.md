# Suora Settings Deep Dive (30 Concrete Iteration Points)

This guide expands the `Settings` module into 30 concrete iteration points focused on global control-plane behavior, safety boundaries, data governance, and diagnostics.

## 1. Global control plane

1. Settings affects the whole workbench, not one isolated page.
2. General owns theme, locale, and baseline preferences.
3. Security owns the highest-risk boundaries.
4. Data owns export, import, cleanup, and backup behavior.
5. Logs and System own operational visibility.

## 2. Safety controls

6. Secure-storage warnings should be understood, not ignored.
7. Tool confirmation policy should reflect actual risk level.
8. Allowed-directory scopes should be as small as possible.
9. Dangerous-shell blocking should stay conservative by default.
10. High-permission settings should not remain wide open just because it was convenient once.

## 3. Data and extension governance

11. Export before major changes.
12. Separate external directories for Agents and Skills conceptually.
13. Review whether shared directories are still useful over time.
14. Manage plugins according to trust level.
15. Keep proxy and environment settings understandable rather than sprawling.

## 4. Knowledge and automation behavior

16. Knowledge settings serve long-lived knowledge workflows.
17. Events settings serve non-chat automation triggers.
18. Voice and Shortcuts are efficiency layers rather than business logic.
19. The more automation you add, the more often Settings should be revisited.
20. After adding new external capabilities, review Security first.

## 5. Diagnostics and recovery

21. When module behavior feels strange, ask whether Logs or System can show evidence.
22. If configuration changes do not stick, check scope and save path first.
23. If keys disappear after restart, check Secure Storage first.
24. If shared directories do not load, check path and enablement state first.
25. Recovery should target the owning section instead of blindly changing global state.

## 6. Governance and maintenance

26. Remove unused shared directories.
27. Disable or uninstall stale plugins.
28. Establish a backup cadence for high-value workspaces.
29. Re-check settings after adding new automation or external integrations.
30. A good Settings setup should make the workbench understandable, safe, recoverable, and maintainable.