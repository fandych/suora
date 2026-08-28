# Settings Technical Index

1. Broad handbook (EN): [../MODULE_ARCHITECTURE_EN.md#10-settings](../MODULE_ARCHITECTURE_EN.md#10-settings)
2. Broad handbook (ZH): [../MODULE_ARCHITECTURE_ZH.md#10-settings](../MODULE_ARCHITECTURE_ZH.md#10-settings)
3. Deep dive (EN): [../SETTINGS_DEEP_DIVE_EN.md](../SETTINGS_DEEP_DIVE_EN.md)
4. Deep dive (ZH): [../SETTINGS_DEEP_DIVE_ZH.md](../SETTINGS_DEEP_DIVE_ZH.md)
5. 真实路由是 `/settings/:section`。
6. `/settings` 会跳转到 `/settings/general`。
7. 入口布局文件是 `src/components/settings/SettingsLayout.tsx`。
8. 侧栏真相源是 `SETTING_SECTIONS`。
9. 各分区通过懒加载装载。
10. Settings 主要消费全局 persisted store。
11. 主题、语言、快捷键、代理、环境变量都在这里汇总。
12. `ToolSecuritySettings` 是高风险核心类型之一。
13. `WorkspaceSettings` 与外部目录模型也受这里驱动。
14. 核心状态锚点是 `src/store/appStore.ts`。
15. provider 安全与同步边界可在 `modelConfigSlice.ts` 看到。
16. 密钥存储异常逻辑在 `src/services/secureState.ts`。
17. 工作区读写链路锚点是 `src/services/workspaceSettings.ts`。
18. 当前真实分区是 11 个，而不是旧文档中的 7 个。
19. Knowledge 与 Events 是正式分区。
20. External Directories 与 Plugins 也是正式分区。
21. Logs 与 System 是诊断层，不是附属页。
22. Secure Storage 警告会通过 `src/App.tsx` 转发到 UI。
23. 配置不生效时要区分本地态、工作区态和缓存态。
24. 工具确认、allowlist、shell 阻断是主要安全闸口。
25. 附近测试包括 `workspaceSettings.test.ts`。
26. 附近测试包括 `secureState.test.ts`。
27. 相关 store 配置行为可在 `appStore.test.ts` 中校验。
28. 修改后优先验证分区导航、保存链路和安全提示链路。
29. 当前最好的深读入口是上面的 deep dive 文档。
30. 技术治理目标是全局行为可控、持久化稳定、安全边界显式、诊断路径清楚。