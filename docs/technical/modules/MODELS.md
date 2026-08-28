# Models Technical Index

1. Broad handbook (EN): [../MODULE_ARCHITECTURE_EN.md#4-models](../MODULE_ARCHITECTURE_EN.md#4-models)
2. Broad handbook (ZH): [../MODULE_ARCHITECTURE_ZH.md#4-models](../MODULE_ARCHITECTURE_ZH.md#4-models)
3. Deep dive (EN): [../MODELS_DEEP_DIVE_EN.md](../MODELS_DEEP_DIVE_EN.md)
4. Deep dive (ZH): [../MODELS_DEEP_DIVE_ZH.md](../MODELS_DEEP_DIVE_ZH.md)
5. `/models` 会跳转到 `/models/providers`。
6. 主路由形态是 `/models/:view`。
7. 合法视图包括 `providers`、`models`、`compare`。
8. 入口布局文件是 `src/components/models/ModelsLayout.tsx`。
9. `ProviderEditor` 承担 provider 配置。
10. `ModelParamEditor` 承担参数编辑。
11. `ModelComparisonPanel` 承担比较视图。
12. 主要状态域包括 `providerConfigs`、`models`、`selectedModel`。
13. provider 与 model entry 的拆分是核心建模。
14. 运行时抽象层是 `src/services/aiService.ts`。
15. provider 预设由 `src/store/slices/modelConfigSlice.ts` 提供。
16. 连接测试由 AI 服务层承担。
17. provider 配置会同步展开为模型可用面。
18. runtime support 与 UI support 不能混写成一张表。
19. 连接探测会在空闲时批量进行。
20. 删除 provider 后必须同步收口模型列表。
21. API Key 与 Base URL 是敏感配置对象。
22. Secure Storage 异常会影响密钥持久化。
23. Base URL 错误可能打到错误环境。
24. provider 保存成功不代表 model 已可用。
25. 附近测试包括 `aiService.test.ts`。
26. 相关 store 行为可在 `appStore.test.ts` 中校验。
27. 修改后优先验证 provider 新增、连接测试和 model enablement。
28. provider 枚举变化要同步文档、UI 与测试。
29. 当前最好的深读入口是上面的 deep dive 文档。
30. 技术治理目标是配置清楚、能力可用、错误可解释、密钥边界可控。