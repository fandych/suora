# Suora Pipeline Deep Dive (30 Concrete Iteration Points)

This guide expands the `Pipeline` module into 30 concrete iteration points focused on repeatable workflow design, execution, failure analysis, and sustainable maintenance.

## 1. Before building a pipeline

1. Confirm the work is truly repeatable, not just a one-off chat task.
2. Confirm the required agents already exist.
3. Confirm the required models are enabled.
4. Define the target artifact before defining steps.
5. Decide whether the flow is manual, chat-triggered, or timer-triggered.

## 2. Step design

6. Keep each step single-purpose.
7. Make each step input and output understandable.
8. Prefer linear clarity before complex branching.
9. Give risky steps clearer prompts and narrower behavior.
10. Add timeouts and retries only where they solve a real failure mode.

## 3. Variables and conditions

11. Use variables instead of copy-pasting intermediate output.
12. Name variables for business meaning rather than position.
13. Use `runIf` only when the branch is genuinely conditional.
14. Keep conditions readable before making them clever.
15. Use default values carefully so they do not hide missing input.

## 4. Execution and observation

16. Dry-run first, then real run.
17. Inspect step state before trusting overall success.
18. Use execution history as a debugging surface.
19. Validate Mermaid structure before polishing wording.
20. Investigate fallback labels instead of ignoring them.

## 5. Collaboration and risk control

21. Use Chat to trigger a pipeline, not to permanently replace one.
22. Use Timer only after the pipeline already succeeds manually.
23. Narrower agent permissions make pipeline failures easier to reason about.
24. Keep sensitive context as small as possible.
25. Put budgets on workflows when cost matters.

## 6. Maintenance and iteration

26. Export a backup before major structural edits.
27. Trace repeated failures back to Agents or Models when needed.
28. Split pipelines that grow too long or mix unrelated goals.
29. Archive or delete unused workflows instead of keeping dead automation.
30. A good pipeline should be clear to run, easy to debug, and affordable to keep.