# Documents Technical Index

1. Broad handbook (EN): [../MODULE_ARCHITECTURE_EN.md#2-documents](../MODULE_ARCHITECTURE_EN.md#2-documents)
2. Broad handbook (ZH): [../MODULE_ARCHITECTURE_ZH.md#2-documents](../MODULE_ARCHITECTURE_ZH.md#2-documents)
3. Deep dive (EN): [../DOCUMENTS_DEEP_DIVE_EN.md](../DOCUMENTS_DEEP_DIVE_EN.md)
4. Deep dive (ZH): [../DOCUMENTS_DEEP_DIVE_ZH.md](../DOCUMENTS_DEEP_DIVE_ZH.md)
5. 真实路由是 `/documents`。
6. 入口布局文件是 `src/components/documents/DocumentsLayout.tsx`。
7. 文档树围绕 `DocumentNode` 统一建模。
8. 文件夹与文档共享树关系模型。
9. 主编辑器承载面是 `DocumentTiptapEditor`。
10. 图关系可视化承载面是 `DocumentGraphView`。
11. 辅助交互面是 `DocumentsAssistantDrawer`。
12. 主要状态域包括 `documentGroups`。
13. 主要状态域包括 `documentNodes`。
14. 同时依赖选中组与选中文档状态。
15. 核心服务锚点是 `src/services/documents.ts`。
16. 图分析锚点是 `src/services/documentGraph.ts`。
17. 统计和健康分析锚点是 `src/services/documentStatistics.ts`。
18. Search 质量依赖命名、保存链路和引用提取。
19. Graph 价值依赖真实关系而不是装饰效果。
20. 核心状态持久化在全局 persisted store。
21. 导入导出真实依赖文件系统桥接。
22. Windows 路径归一化是重要实现细节。
23. 敏感文档风险主要在导出和跨模块注入。
24. 附近测试包括 `DocumentsLayout.test.tsx`。
25. 附近测试包括 `DocumentGraphView.test.tsx`。
26. 附近测试包括 `documents.test.ts`。
27. 修改前优先确认节点模型、路径模型和引用模型。
28. 修改后优先验证创建、保存、搜索、图谱和上下文注入。
29. 当前最好的深读入口是上面的 deep dive 文档。
30. 技术治理目标是结构清楚、持久化稳定、关系可解释、知识可复用。