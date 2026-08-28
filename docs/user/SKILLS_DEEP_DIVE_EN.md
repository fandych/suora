# Suora Skills Deep Dive (30 Concrete Iteration Points)

This guide expands the `Skills` module into 30 concrete iteration points focused on `SKILL.md`, source management, bundled resources, sharing, and review discipline.

## 1. Core understanding

1. A skill is a prompt and resource package, not a tool implementation.
2. `SKILL.md` is the center of the skill, not a side note.
3. Skills solve reusable domain-behavior problems.
4. Agents solve role and execution-boundary problems.
5. Skills must not be used to sidestep runtime permission controls.

## 2. Content shape

6. The skill name should make the purpose obvious.
7. Supported scenarios should be explicit.
8. Input expectations should be explicit.
9. Output expectations should be explicit.
10. Limits and prohibitions should be explicit.

## 3. Resources and sources

11. Resource trees are for templates, references, and bundled supporting assets.
12. `scripts/` content deserves extra caution.
13. Local, project, user, and registry sources should be treated differently.
14. External directories are useful for shared team skill libraries.
15. File import and folder import suit different skill shapes.

## 4. Binding and reuse

16. One skill can be bound to several related agents.
17. If an agent becomes unstable, review whether the skill is too broad.
18. If the role changes but domain rules do not, update the agent before rewriting the skill.
19. Split overlapping skills before the overlap becomes ambiguity.
20. Archive or remove unused skills.

## 5. Safety and review

21. Review the trust level of registry skills before installation.
22. Review bundled scripts manually.
23. Do not store secrets directly inside skill content.
24. Do not normalize high-risk actions as “default flow” without review.
25. The more powerful a skill becomes, the clearer its boundaries must be.

## 6. Governance and maintenance

26. Export backups for high-value skills.
27. Promote long-lived shared skills into managed external directories.
28. Align terminology if multilingual teams share the same skill assets.
29. Review both prose and resource trees over time.
30. A good Skills setup should give clear boundaries, traceable sources, controlled resources, and stable reuse.