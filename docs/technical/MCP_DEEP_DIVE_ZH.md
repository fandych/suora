# Suora MCP 技术深挖（30 个技术落点）

## 1. 路由与布局

1. MCP 的真实路由是 `/mcp`。
2. 路由通过 `IntegrationsLayout` 挂载面板。
3. 真正主面板是 `MCPSettingsPanel`。
4. 这一模块虽然 UI 薄，但运行边界重。
5. 文档不应把 MCP 写成普通杂项设置。

## 2. 状态与类型

6. 主要 store 域是 `mcpServers`。
7. 核心类型包括 `MCPServerConfig`。
8. 核心类型包括 `MCPServerStatus`。
9. 核心类型包括 `MCPTransport` 与 `MCPServerScope`。
10. scope 是安全和共享边界的一部分。

## 3. 服务与验证

11. 核心服务锚点是 `src/services/mcpSystem.ts`。
12. 连接验证会校验 transport、URL/命令、headers、env 等。
13. `stdio` 与网络型 transport 必须分开理解。
14. renderer 不应直接越过 Electron 边界启动特权进程。
15. 文档应明确协议校验不是形式要求，而是安全边界。

## 4. 运行现实

16. `http`、`sse`、`ws` 的网络可达性问题模式不同。
17. `stdio` 的错误常常来自命令、cwd 或环境变量。
18. user scope 会扩大失误影响面。
19. workspace scope 更适合项目专用服务。
20. Agent 是否可见某 MCP 能力仍取决于后续执行链路。

## 5. 风险与故障模式

21. 高权限 MCP 服务会放大 Agent 风险。
22. 敏感认证头不应扩散进普通文档或技能。
23. 不可信第三方 MCP 服务不应直接进入核心工作流。
24. 状态通过不代表 Agent 已经正确使用该能力。
25. 故障定位应先区分“服务未连上”和“服务未被消费”。

## 6. 测试与修改检查

26. 附近测试锚点包括 `mcpSystem.test.ts`。
27. 修改 MCP 时应优先验证 transport 校验和状态展示。
28. 修改 scope 逻辑时要重新审视文档安全边界。
29. 修改 URL/命令校验时要同步网站与 repo 文档事实。
30. MCP 技术治理的目标是连接可靠、作用域清楚、权限收敛、能力可验证。