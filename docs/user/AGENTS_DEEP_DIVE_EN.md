# Suora Agents Deep Dive (30 Concrete Iteration Points)

This guide expands the `Agents` module into 30 concrete iteration points focused on role design, prompt boundaries, permissions, memory, and reuse.

## 1. Role framing

1. Treat an agent as an execution profile, not a prompt snippet.
2. Define the role before tuning the model.
3. Define the boundary before adding extra capabilities.
4. Separate general-purpose agents from specialist agents.
5. Keep builder agents distinct from business-task agents.

## 2. Prompt design

6. Put objective before rules in the system prompt.
7. Avoid mixing conflicting roles in one agent.
8. State output format rules explicitly.
9. State risk limits explicitly.
10. State uncertainty-handling rules explicitly.

## 3. Configuration shape

11. Bind models according to task type.
12. Bind skills according to domain stability.
13. Use max turns to limit thread sprawl.
14. Use temperature and token limits to fit the deliverable.
15. Match response style to the real audience or handoff target.

## 4. Permissions and memory

16. Give allowed tools only when they are genuinely needed.
17. Use disallowed tools to narrow risky surfaces.
18. Do not leave permission mode overly broad by default.
19. Enable memory only when it creates real long-term value.
20. Do not treat autoLearn as a substitute for manual governance.

## 5. Testing and evolution

21. Snapshot before major prompt changes.
22. Test new agents in-module before pushing them into production flows.
23. Duplicating a close existing agent is often safer than starting from zero.
24. Split one agent into two when style or permission needs conflict.
25. Archive or remove agents that no longer serve current work.

## 6. Collaboration and governance

26. When Chat exposes a role problem, fix it in Agents rather than endlessly patching the conversation.
27. Critical pipeline steps need especially clear agent boundaries.
28. Channel-bound reply agents should usually be more conservative than chat-only agents.
29. High-value repeated behavioral rules may belong in Skills.
30. A good Agents setup should give clear roles, stable output, controlled permissions, and reversible evolution.