# Suora Documents 技术深挖（30 个技术落点）

## 1. 路由与布局

1. Documents 的真实路由是 `/documents`。
2. 入口布局文件是 `src/components/documents/DocumentsLayout.tsx`。
3. 该布局同时承载树侧栏、编辑区、图谱和助手抽屉。
4. 这是当前较重的工作台布局之一。
5. 它同时处理浏览、编辑、分析与导入导出链路。

## 2. 树与编辑器结构

6. 文档树围绕 `DocumentNode` 统一建模。
7. 文件夹与文档共享树关系模型。
8. `DocumentTiptapEditor` 是主要编辑器承载面。
9. `DocumentGraphView` 承担关系可视化。
10. `DocumentsAssistantDrawer` 为文档操作提供辅助交互面。

## 3. 状态与类型

11. 主要状态域包括 `documentGroups`。
12. 主要状态域包括 `documentNodes`。
13. 主要状态域包括当前选中组与选中文档。
14. 关键类型包括 `DocumentGroup`、`DocumentFolder`、`DocumentItem`、`DocumentNode`。
15. 统一节点模型降低了树操作和路径构建复杂度。

## 4. 服务与分析

16. `src/services/documents.ts` 承担基础文档行为。
17. `src/services/documentGraph.ts` 承担图关系分析。
18. `src/services/documentStatistics.ts` 承担统计和健康分析。
19. 搜索与索引质量依赖命名、保存链路和引用提取。
20. 图谱价值建立在真实引用关系而不是纯视觉表现上。

## 5. 持久化与风险边界

21. Documents 的核心状态持久化在全局 persisted store 中。
22. 导入导出仍然会真实依赖文件系统桥接。
23. Windows 路径归一化是这一模块的重要实现细节。
24. 敏感文档的风险在于导出和跨模块注入，而不是仅在编辑阶段。
25. 该模块是本地知识资产层，不应被写成纯 UI 功能。

## 6. 测试与修改检查

26. 附近测试锚点包括 `DocumentsLayout.test.tsx`。
27. 附近测试锚点包括 `DocumentGraphView.test.tsx`。
28. 附近测试锚点包括 `documents.test.ts`。
29. 修改 Documents 时应优先验证创建、保存、搜索、图谱和上下文注入。
30. Documents 技术治理的目标是结构清楚、持久化稳定、关系可解释、知识可复用。