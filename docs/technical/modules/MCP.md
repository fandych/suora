# MCP Technical Index

1. Broad handbook (EN): [../MODULE_ARCHITECTURE_EN.md#9-mcp](../MODULE_ARCHITECTURE_EN.md#9-mcp)
2. Broad handbook (ZH): [../MODULE_ARCHITECTURE_ZH.md#9-mcp](../MODULE_ARCHITECTURE_ZH.md#9-mcp)
3. Deep dive (EN): [../MCP_DEEP_DIVE_EN.md](../MCP_DEEP_DIVE_EN.md)
4. Deep dive (ZH): [../MCP_DEEP_DIVE_ZH.md](../MCP_DEEP_DIVE_ZH.md)
5. 真实路由是 `/mcp`。
6. 路由通过 `IntegrationsLayout` 挂载面板。
7. 真正主面板是 `MCPSettingsPanel`。
8. UI 很薄，但运行边界很重。
9. 主要状态域是 `mcpServers`。
10. 关键类型包括 `MCPServerConfig`。
11. 关键类型包括 `MCPServerStatus`。
12. 关键类型包括 `MCPTransport` 与 `MCPServerScope`。
13. 核心服务锚点是 `src/services/mcpSystem.ts`。
14. 连接验证会校验 transport、URL/命令、headers、env 等。
15. `stdio` 与网络型 transport 必须分开理解。
16. renderer 不应越过 Electron 边界直接启动特权进程。
17. 协议校验属于真实安全边界。
18. `http`、`sse`、`ws` 的故障模式不同。
19. `stdio` 的故障模式常与命令和环境变量相关。
20. user scope 会扩大失误影响面。
21. workspace scope 更适合项目专属服务。
22. Agent 是否可见能力仍取决于后续执行链路。
23. 高权限 MCP 服务会放大 Agent 风险。
24. 服务连上不代表 Agent 已正确消费该能力。
25. 附近测试包括 `mcpSystem.test.ts`。
26. 修改后优先验证 transport 校验与状态展示。
27. scope 逻辑变化要同步审查安全边界。
28. URL/命令校验变化要同步文档事实。
29. 当前最好的深读入口是上面的 deep dive 文档。
30. 技术治理目标是连接可靠、作用域清楚、权限收敛、能力可验证。