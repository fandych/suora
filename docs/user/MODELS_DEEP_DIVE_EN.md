# Suora Models Deep Dive (30 Concrete Iteration Points)

This guide expands the `Models` module into 30 concrete iteration points focused on provider setup, model enablement, comparison, stability, and key-handling boundaries.

## 1. Core distinctions

1. Treat providers and models as different layers.
2. Treat runtime support and editor exposure as different facts.
3. Separate connectivity failures from capability-fit failures.
4. Evaluate local models and cloud models differently.
5. Treat OpenAI-compatible as a protocol surface, not a vendor identity.

## 2. Setup flow

6. Create the provider before worrying about model selection.
7. Test the provider immediately after saving it.
8. Enable concrete models only after connectivity is confirmed.
9. Keep only actually used models enabled.
10. Name providers so their purpose is obvious later.

## 3. Model selection

11. Favor stable reasoning for complex tasks.
12. Favor cost and speed for high-volume drafting tasks.
13. Check modality support for attachment-heavy work.
14. Check context behavior for long-document work.
15. Use Compare with real task prompts, not abstract benchmarks.

## 4. Stability and cost

16. Do not force the strongest model into every task.
17. Account for rate limits and network volatility.
18. Keep backup providers for high-value workflows when needed.
19. Move low-value work to lower-cost models.
20. Use stronger models deliberately and explain why.

## 5. Safety boundaries

21. API keys are the most sensitive objects in this module.
22. A bad base URL can send requests to the wrong environment.
23. Secure-storage warnings are operationally meaningful.
24. Memory-only keys are acceptable for temporary use, not long-term dependence.
25. Avoid creating multiple conflicting sources of truth for model configuration.

## 6. Governance and diagnosis

26. When Chat fails, come back to Models before assuming the prompt is the issue.
27. When Agents behave strangely, re-check the model fit.
28. Clean up provider sprawl once the list becomes confusing.
29. Retire long-broken or unused models.
30. A good Models setup should be stable, understandable, switchable, and cost-aware.