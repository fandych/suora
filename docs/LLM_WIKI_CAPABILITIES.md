# LLM Wiki capability reference

> Source project: <https://github.com/nashsu/llm_wiki>  
> Purpose: capture document-intelligence capabilities that can inform future Suora Documents work without describing them as already shipped Suora features.

## English summary

LLM Wiki presents a local desktop knowledge-base pattern where an LLM incrementally reads user sources, generates a structured wiki, keeps source attribution, and uses the wiki as persistent context instead of rebuilding answers from scratch for every query.

Capabilities worth tracking for Suora Documents:

- **Self-building knowledge base**: raw sources are converted into generated wiki pages, an index, operation logs, YAML frontmatter, and `[[wikilink]]` cross-references.
- **Traceable ingest pipeline**: a two-step LLM ingest flow first analyzes sources, then generates wiki pages with source links, summaries, entities, concepts, review items, and incremental cache reuse.
- **Multi-format sources**: folder import and structured extraction for PDFs, Office files, spreadsheets, images, media, and web clips.
- **Source synchronization**: persistent ingest queues, retry/cancel controls, source-folder watching, and cascade cleanup when sources are deleted.
- **Knowledge graph intelligence**: graph relevance based on direct links, shared sources, common neighbors, and type affinity, plus community detection for knowledge clusters.
- **Graph insights**: automatic surfacing of surprising connections, sparse areas, isolated pages, bridge nodes, and research-worthy gaps.
- **Hybrid retrieval**: tokenized search, optional vector semantic search, graph expansion, and context-budget assembly before model calls.
- **Deep research loop**: LLM-generated search topics, multi-query web search, synthesis into wiki pages, and auto-ingest back into the knowledge network.
- **Human review workflow**: asynchronous review queues where the model proposes constrained actions and the user decides what to accept.
- **Agent/API integration**: a local token-protected HTTP API and agent skill surface for hybrid search, file reads, graph traversal, and source rescans.

## 中文摘要

LLM Wiki 展示了一种本地桌面知识库模式：让 LLM 持续读取用户资料，增量生成结构化 wiki，保留来源引用，并把持久化 wiki 作为后续问答上下文，而不是每次都临时从零检索回答。

对 Suora Documents 值得跟踪的能力包括：

- **自构建知识库**：把原始资料转换为 wiki 页面、索引、操作日志、YAML frontmatter 和 `[[wikilink]]` 交叉引用。
- **可追溯导入流水线**：先由 LLM 分析来源，再生成带来源链接、摘要、实体、概念、待复核项和增量缓存的 wiki 内容。
- **多格式来源**：支持文件夹导入，以及 PDF、Office、表格、图片、媒体和网页剪藏等结构化提取。
- **来源同步**：持久化导入队列、重试/取消、来源目录监听，以及删除来源后的级联清理。
- **知识图谱智能**：基于直接链接、共享来源、共同邻居和类型亲和度计算关联，并用社区发现识别知识簇。
- **图谱洞察**：自动暴露意外关联、稀疏区域、孤立页面、桥接节点和适合继续研究的知识缺口。
- **混合检索**：在模型调用前组合关键词检索、可选向量语义检索、图谱扩展和上下文预算控制。
- **深度研究闭环**：由 LLM 生成检索主题，多查询网页搜索，把结果综合进 wiki 页面，并再次导入知识网络。
- **人工复核工作流**：异步复核队列中由模型提出受限操作，最终由用户决定是否接受。
- **Agent/API 集成**：本地 token 保护 HTTP API 与 agent skill，可用于混合搜索、读取文件、遍历图谱和重新扫描来源。

## Coverage confirmation

The main `nashsu/llm_wiki` capability themes are included in this reference. The table below confirms coverage and separates reference coverage from current Suora implementation status.

| LLM Wiki capability theme | Included in this reference | Current Suora status |
| --- | --- | --- |
| Two-step / traceable ingest | Yes | Planning reference only |
| Multimodal and multi-format source ingestion | Yes | Partially related to existing document/attachment workflows; full LLM Wiki-style ingest is not claimed |
| Knowledge graph relevance and community detection | Yes | Suora has document graph/backlink features; advanced relevance/community scoring remains planning reference |
| Graph insights and knowledge-gap discovery | Yes | Planning reference only |
| Vector semantic search and hybrid retrieval | Yes | Planning reference only for Documents |
| Persistent ingest queue, retry, cancel, and source watching | Yes | Planning reference only |
| Deep Research loop and web result auto-ingest | Yes | Related research tooling exists elsewhere, but LLM Wiki-style document auto-ingest is not claimed |
| Async human review queue | Yes | Planning reference only |
| Browser/web clipper source capture | Yes, under multi-format sources and deep research | Planning reference only |
| Local API and agent skill integration | Yes | Planning reference only |
| Obsidian-style wiki files, frontmatter, index/log, and wikilinks | Yes | Planning reference only |

## 覆盖确认

`nashsu/llm_wiki` 的主要能力主题已经包含在本文档中。下表用于确认覆盖范围，并把“已纳入参考”和“Suora 当前实现状态”分开说明。

| LLM Wiki 能力主题 | 本文档是否包含 | Suora 当前状态 |
| --- | --- | --- |
| 两阶段 / 可追溯导入 | 是 | 规划参考，不声明已实现 |
| 多模态与多格式来源导入 | 是 | 与现有文档/附件工作流部分相关；不声明完整 LLM Wiki 式导入已实现 |
| 知识图谱关联度与社区发现 | 是 | Suora 已有文档图谱/回链能力；高级关联评分和社区发现仍作为规划参考 |
| 图谱洞察与知识缺口发现 | 是 | 规划参考，不声明已实现 |
| 向量语义搜索与混合检索 | 是 | Documents 的规划参考，不声明已实现 |
| 持久化导入队列、重试、取消和来源监听 | 是 | 规划参考，不声明已实现 |
| Deep Research 闭环与网页结果自动导入 | 是 | 仓库中已有相关研究工具概念，但不声明 LLM Wiki 式文档自动导入已实现 |
| 异步人工复核队列 | 是 | 规划参考，不声明已实现 |
| 浏览器 / 网页剪藏来源捕获 | 是，归入多格式来源和深度研究 | 规划参考，不声明已实现 |
| 本地 API 与 agent skill 集成 | 是 | 规划参考，不声明已实现 |
| Obsidian 风格 wiki 文件、frontmatter、index/log 和 wikilinks | 是 | 规划参考，不声明已实现 |

## Documentation guidance

- Treat this document as a capability reference and product-planning input, not proof that Suora has already implemented every item.
- When an item is implemented in Suora, update the implementation-backed docs (`README.md`, `FEATURES.md`, user guides, technical docs, and requirements) from the owning code paths.
- Keep current-state documentation separate from future LLM Wiki-inspired goals to avoid overstating shipped behavior.
