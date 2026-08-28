# Skills Technical Index

1. Broad handbook (EN): [../MODULE_ARCHITECTURE_EN.md#6-skills](../MODULE_ARCHITECTURE_EN.md#6-skills)
2. Broad handbook (ZH): [../MODULE_ARCHITECTURE_ZH.md#6-skills](../MODULE_ARCHITECTURE_ZH.md#6-skills)
3. Deep dive (EN): [../SKILLS_DEEP_DIVE_EN.md](../SKILLS_DEEP_DIVE_EN.md)
4. Deep dive (ZH): [../SKILLS_DEEP_DIVE_ZH.md](../SKILLS_DEEP_DIVE_ZH.md)
5. 真实路由是 `/skills`。
6. 旧式 `/skills/:view` 会回跳到 `/skills`。
7. 入口布局文件是 `src/components/skills/SkillsLayout.tsx`。
8. 左侧负责来源过滤与列表切换。
9. 右侧围绕 `SKILL.md` 编辑与资源树展开。
10. 主要状态域包括 `skills`。
11. 主要状态域包括 `externalDirectories`。
12. 主要状态域包括 `skillVersions`。
13. 关键类型包括 `Skill`、`SkillSource` 与来源模型。
14. `skillRoot` 与 `filePath` 同时存在以支持多种持久化形态。
15. `src/services/skillRegistry.ts` 负责解析与序列化。
16. `src/services/skillArchive.ts` 负责导入导出包。
17. `src/services/skillMarketplace.ts` 负责注册表浏览与安装。
18. 技能保存是真实磁盘写入，不只是 store 更新。
19. 工作区存在时新技能默认进入 `.suora/skills/`。
20. Claude Code 与其他 agent 目录有归一化兼容逻辑。
21. 资源树让 Skill 持有模板、脚本和补充资产。
22. `scripts/` 资源应视为高风险资产。
23. Skill 架构是 prompt/resource 层而不是 tool 层。
24. 不可信内容会污染 Agent 上下文。
25. 附近测试包括 `SkillsLayout.test.tsx`。
26. 附近测试包括 `SkillEditor.test.tsx`。
27. 附近测试包括 `skillRegistry.test.ts`。
28. 修改后优先验证保存、重载、来源过滤和导入导出。
29. 当前最好的深读入口是上面的 deep dive 文档。
30. 技术治理目标是来源可追、格式稳定、资源可审、协作清楚。