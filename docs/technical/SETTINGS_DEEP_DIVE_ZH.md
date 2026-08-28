# Suora Settings 技术深挖（30 个技术落点）

## 1. 路由与布局

1. Settings 的真实路由是 `/settings/:section`。
2. `/settings` 会跳转到 `/settings/general`。
3. 入口布局文件是 `src/components/settings/SettingsLayout.tsx`。
4. 侧栏由 `SETTING_SECTIONS` 作为真相源。
5. 各分区通过懒加载装载，避免一次性加载全部面板。

## 2. 状态与类型

6. Settings 主要消费全局 persisted store。
7. 主题、语言、快捷键、代理、环境变量都属于这一控制面。
8. `ToolSecuritySettings` 是高风险核心类型之一。
9. `WorkspaceSettings` 与外部目录模型同样受这里驱动。
10. Settings 不是杂项页，而是全局行为控制面。

## 3. 服务与同步

11. `src/store/appStore.ts` 是核心状态锚点。
12. `modelConfigSlice.ts` 会在这里体现 provider 安全与同步边界。
13. `secureState.ts` 负责密钥存储异常相关逻辑。
14. `workspaceSettings.ts` 负责工作区读写侧关键链路。
15. 外部目录与共享资源加载都与设置写入有关。

## 4. 当前现实

16. 当前真实分区是 11 个，而不是旧文档中的 7 个。
17. Knowledge 与 Events 已是正式分区，不应遗漏。
18. External Directories 与 Plugins 也是一级正式分区。
19. Logs 与 System 是诊断层，不是附属彩蛋页。
20. Secure Storage 警告通过 `src/App.tsx` 被显式转发到 UI。

## 5. 风险与故障模式

21. 配置不生效时首先要区分本地态、工作区态和缓存态。
22. 密钥重启丢失首先要排查 Secure Storage 状态。
23. 工具确认、allowlist、shell 阻断是高风险行为的主要安全闸口。
24. 闲置外部目录和插件会扩大无谓风险面。
25. 大改设置前应具备导出与回退意识。

## 6. 测试与修改检查

26. 附近测试锚点包括 `workspaceSettings.test.ts`。
27. 附近测试锚点包括 `secureState.test.ts`。
28. 附近测试锚点包括 `appStore.test.ts` 中相关配置行为。
29. 修改 Settings 时应优先验证分区导航、保存链路和安全提示链路。
30. Settings 技术治理的目标是全局行为可控、持久化稳定、安全边界显式、诊断路径清楚。