# Suora Timer Technical Deep Dive (30 Technical Points)

## 1. Route and layout

1. The real Timer route is `/timer`.
2. The layout entry file is `src/components/timer/TimerLayout.tsx`.
3. The left side owns search, selection, and enable/disable entry points.
4. The right side hosts `TimerForm` and `TimerDetail`.
5. `TimerAssistantDrawer` supports AI-assisted timer creation.

## 2. State and types

6. Local module state tracks the current timer list.
7. Local module state tracks selected, editing, and creating state.
8. Key types include `ScheduledTask`.
9. Timer-form and runtime-helper types support configuration and display.
10. `agentPipelines` is loaded so timers can target saved pipelines.

## 3. Runtime path

11. Electron communication is driven through `electronInvoke`, `electronOn`, and `electronOff`.
12. The `timer:fired` main-process event drives renderer refresh.
13. `src/services/timerRuntime.ts` anchors post-fire runtime behavior.
14. Timer is a real Electron scheduling surface rather than pure store state.
15. Run now is a crucial validation path for unattended automation.

## 4. Scheduling and action reality

16. Current schedule types are once, interval, and cron.
17. Current actions are notify, prompt, and pipeline.
18. Prompt actions depend on Agent and Models state.
19. Pipeline actions depend on saved workflows and execution paths.
20. Sleep and timezone behavior affect expectations and should stay explicit.

## 5. Risk and failure modes

21. Unattended execution amplifies configuration mistakes.
22. High-frequency timers amplify cost and failure frequency.
23. Fired-but-empty runs often need Agent, Pipeline, or Models triage.
24. Not-fired timers should first be checked for schedule correctness and enabled state.
25. Timer should not be documented as a general OS task runner.

## 6. Tests and change checks

26. Nearby tests include `TimerLayout.test.tsx`.
27. Nearby tests include `timerRuntime.test.ts`.
28. Timer changes should first validate create, enable/disable, Run now, and refresh paths.
29. Action-model changes should be checked against Pipeline and Agent dependencies.
30. The technical goal of Timer maintenance is clear scheduling, observable runtime state, controlled risk, and recoverable failure.