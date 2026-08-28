# Suora Skills 技术深挖（30 个技术落点）

## 1. 路由与布局

1. Skills 的真实路由是 `/skills`。
2. 旧式 `/skills/:view` 会重定向回 `/skills`。
3. 入口布局文件是 `src/components/skills/SkillsLayout.tsx`。
4. 布局左侧承担来源过滤与列表切换。
5. 右侧编辑区围绕 `SKILL.md` 和资源树展开。

## 2. 状态与类型

6. 主要 store 域包括 `skills`。
7. 主要 store 域包括 `externalDirectories`。
8. 主要 store 域包括 `skillVersions`。
9. 关键类型包括 `Skill`、`SkillSource` 与注册表来源模型。
10. `skillRoot` 与 `filePath` 同时存在是为了支持目录型与文件型技能。

## 3. 服务与持久化

11. `src/services/skillRegistry.ts` 是 `SKILL.md` 解析与序列化核心。
12. `src/services/skillArchive.ts` 负责打包导入导出。
13. `src/services/skillMarketplace.ts` 负责注册表浏览与安装流。
14. 技能保存是真实磁盘写入，而不是仅更新 store。
15. 工作区存在时新技能默认写入 `.suora/skills/`。

## 4. 来源与资源现实

16. 当前来源模型包括 local、project、user、registry、workspace 等。
17. Claude Code 与其他 agent 目录有路径归一化兼容逻辑。
18. 资源树让 Skill 可以携带模板、脚本与补充资产。
19. `scripts/` 资源被视为更高风险对象。
20. 技能系统是 prompt/resource 层，不是工具执行层。

## 5. 风险与故障模式

21. 不可信 Skill 内容会污染 Agent 上下文。
22. 不可信脚本资源会扩大风险面。
23. 保存失败常与工作区路径或磁盘权限有关。
24. 加载失败常与解析、路径或来源启用状态有关。
25. 文档必须保留“Skill 不是 Tool”的架构边界。

## 6. 测试与修改检查

26. 附近测试锚点包括 `SkillsLayout.test.tsx`。
27. 附近测试锚点包括 `SkillEditor.test.tsx`。
28. 附近测试锚点包括 `skillRegistry.test.ts`。
29. 修改 Skills 时应优先验证保存、重载、来源过滤和导入导出。
30. Skills 技术治理的目标是来源可追、格式稳定、资源可审、与 Agent 协作清楚。