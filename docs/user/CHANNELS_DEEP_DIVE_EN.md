# Suora Channels Deep Dive (30 Concrete Iteration Points)

This guide expands the `Channels` module into 30 concrete iteration points focused on platform onboarding, transport mode, reply ownership, and operational visibility.

## 1. Platforms and transport

1. Distinguish platforms before you think about fields.
2. Distinguish webhook and stream before choosing a rollout path.
3. Treat Personal WeChat and enterprise WeChat as different integration paths.
4. Treat the Email channel as more workflow-oriented than a simple chat surface.
5. Treat Custom as the escape hatch for internal or unsupported gateways.

## 2. Core configuration

6. Bind each channel to one deliberate reply agent.
7. Name channels so platform and use case are obvious.
8. Fill credential fields with a minimum-needed mindset.
9. Leave auto reply off until manual verification is done.
10. Keep `allowedChats` as narrow as practical.

## 3. Runtime observation

11. Use Config for static setup review.
12. Use Messages to verify that inbound traffic is actually arriving.
13. Use Users to see who is triggering the integration.
14. Use Health to inspect runtime condition.
15. Use Debug to inspect failure evidence.

## 4. Platform-specific concerns

16. Personal WeChat requires attention to binding state and QR-based flow.
17. DingTalk requires attention to stream versus webhook selection.
18. Slack, Telegram, Discord, and Teams require attention to tokens and signing data.
19. Email requires attention to IMAP, SMTP, filters, and actions.
20. Custom requires attention to auth headers and payload templates.

## 5. Safety and rollout

21. Production reply agents should usually be conservative.
22. Start with narrow allowlists in real deployments.
23. Platform secrets, mailbox credentials, and bridge auth are high-sensitivity data.
24. Persistent Debug errors should trigger disable-or-investigate discipline.
25. “Receives but cannot reply” states require both platform-side and model-side checks.

## 6. Governance and maintenance

26. High-volume channels deserve recurring latency and health review.
27. Review reply-agent fit whenever business scope changes.
28. Remove or archive abandoned test channels.
29. Simplify Email rules once they begin to sprawl.
30. A good Channels setup should be stable, observable, bounded, and operationally explainable.