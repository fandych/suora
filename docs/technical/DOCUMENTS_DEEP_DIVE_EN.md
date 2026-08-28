# Suora Documents Technical Deep Dive (30 Technical Points)

## 1. Route and layout

1. The real Documents route is `/documents`.
2. The layout entry file is `src/components/documents/DocumentsLayout.tsx`.
3. The layout hosts the tree, editor, graph view, and assistant drawer together.
4. This is one of the heavier workbench layouts.
5. It combines browsing, editing, analysis, and import/export behavior.

## 2. Tree and editor structure

6. The document tree is normalized around `DocumentNode`.
7. Folders and documents share the same tree relationship model.
8. `DocumentTiptapEditor` is the main editing surface.
9. `DocumentGraphView` owns relationship visualization.
10. `DocumentsAssistantDrawer` provides assisted document interaction.

## 3. State and types

11. Key state domains include `documentGroups`.
12. Key state domains include `documentNodes`.
13. Key state domains include selected group and selected document state.
14. Key types include `DocumentGroup`, `DocumentFolder`, `DocumentItem`, and `DocumentNode`.
15. The shared node model reduces tree-operation complexity.

## 4. Services and analysis

16. `src/services/documents.ts` owns core document behavior.
17. `src/services/documentGraph.ts` owns graph analysis behavior.
18. `src/services/documentStatistics.ts` owns statistics and health analysis.
19. Search and index quality depend on naming, save flow, and reference extraction.
20. Graph value depends on real relationships rather than visual decoration.

## 5. Persistence and risk boundaries

21. Core document state is persisted in the global persisted store.
22. Import and export still rely on real filesystem bridges.
23. Windows path normalization is a meaningful implementation detail here.
24. Sensitive-document risk is mostly about export and cross-module injection.
25. Documents should be treated as the local knowledge-asset layer, not just UI.

## 6. Tests and change checks

26. Nearby tests include `DocumentsLayout.test.tsx`.
27. Nearby tests include `DocumentGraphView.test.tsx`.
28. Nearby tests include `documents.test.ts`.
29. Documents changes should first validate create, save, search, graph, and context injection flows.
30. The technical goal of Documents maintenance is clear structure, stable persistence, explainable relationships, and reusable knowledge.