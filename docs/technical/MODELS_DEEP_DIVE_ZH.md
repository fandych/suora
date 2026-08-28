# Suora Models 技术深挖（30 个技术落点）

## 1. 路由与视图

1. `/models` 会跳转到 `/models/providers`。
2. 主路由形态是 `/models/:view`。
3. 当前合法视图包括 `providers`、`models`、`compare`。
4. 入口布局文件是 `src/components/models/ModelsLayout.tsx`。
5. `ModelsLayout` 同时承担导航和状态探测职责。

## 2. 组件与状态

6. `ProviderEditor` 负责 provider 配置。
7. `ModelParamEditor` 负责模型参数面板。
8. `ModelComparisonPanel` 负责比较视图。
9. 主要 store 域包括 `providerConfigs`、`models`、`selectedModel`。
10. provider 与 model entry 的拆分是这一模块的核心建模。

## 3. 服务与同步

11. `src/services/aiService.ts` 是核心运行时抽象层。
12. `testConnection` 由 AI 服务层承担。
13. `src/store/slices/modelConfigSlice.ts` 提供 provider 预设。
14. provider 配置会被同步展开为模型可用面。
15. 工作区设置加载会影响 provider 配置的读取时机。

## 4. 运行时现实

16. 运行时 provider 支持面大于当前 UI 可选面。
17. 文档不能把 runtime support 与 UI support 混写。
18. 连接状态探测会在空闲时批量执行。
19. 删除 provider 后必须同步移除派生模型。
20. Compare 的意义在于任务适配，而不是漂亮展示。

## 5. 安全与故障模式

21. API Key 与 Base URL 是核心敏感数据。
22. Secure Storage 异常会直接影响密钥持久化。
23. Base URL 错误可能造成请求发往错误环境。
24. provider 保存成功不代表模型已经真正可用。
25. Chat/Agent 故障常需回查 Models 配置层。

## 6. 测试与修改检查

26. 附近测试锚点包括 `aiService.test.ts`。
27. 附近测试锚点包括 `appStore.test.ts` 中的相关 store 行为。
28. 修改 Models 时应优先验证 provider 新增、连接测试和 model enablement。
29. 修改 provider 枚举或预设时要同步检查文档与 UI。
30. Models 技术治理的目标是配置清楚、能力可用、错误可解释、密钥边界可控。