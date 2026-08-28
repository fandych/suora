# Suora Timer Deep Dive (30 Concrete Iteration Points)

This guide expands the `Timer` module into 30 concrete iteration points focused on scheduling strategy, action choice, unattended-run risk, and maintenance discipline.

## 1. Schedule types

1. Use Once for one-off reminders or one-time automation.
2. Use Interval for lightweight repeating work.
3. Use Cron for stable time-based schedules.
4. New users should start with Once or low-frequency Interval.
5. High-frequency timers should justify their business value first.

## 2. Action choice

6. Notifications fit pure reminders.
7. Agent prompts fit single-step AI tasks.
8. Pipeline actions fit multi-step automation.
9. Do not force complex workflows into prompt actions.
10. Pipeline-based timers should be validated manually before scheduling.

## 3. Runtime behavior

11. Run now is the first pre-launch validation step.
12. If next-run timestamps look wrong, disable first and investigate second.
13. Do not deploy cron rules casually when timezone handling is unclear.
14. Missed-run policy should match business tolerance.
15. Retries should be reserved for real transient failure conditions.

## 4. Risk control

16. Unattended tasks should usually use narrower-permission agents.
17. High-cost models should not sit on high-frequency schedules casually.
18. Tasks touching outside systems should be reviewed for side effects.
19. As timer logic grows more complex, move it into Pipeline.
20. Disable suspicious tasks quickly instead of letting them keep firing.

## 5. Collaboration and diagnosis

21. Timer and Pipeline meet at scheduled multi-step execution.
22. Timer and Agents meet at lightweight scheduled prompts.
23. If a timer misbehaves, verify the bound target still exists and still works.
24. If a timer fires with no useful output, inspect logs and model readiness.
25. Clean up timers that no longer have a real job.

## 6. Governance and maintenance

26. Name timers for intent rather than generic scheduling labels.
27. High-value tasks should carry a known validation method.
28. When timer behavior grows messy, refactor instead of stacking patches.
29. Back up important timer configurations before major rewrites.
30. A good Timer setup should be clear to schedule, safe to run, and easy to recover.