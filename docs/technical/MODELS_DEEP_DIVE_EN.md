# Suora Models Technical Deep Dive (30 Technical Points)

## 1. Route and view structure

1. `/models` redirects to `/models/providers`.
2. The main route shape is `/models/:view`.
3. Valid views are `providers`, `models`, and `compare`.
4. The layout entry file is `src/components/models/ModelsLayout.tsx`.
5. `ModelsLayout` owns both navigation and connectivity visibility.

## 2. Components and state

6. `ProviderEditor` owns provider configuration.
7. `ModelParamEditor` owns model-parameter editing.
8. `ModelComparisonPanel` owns model comparison.
9. Key store domains include `providerConfigs`, `models`, and `selectedModel`.
10. The provider/model-entry split is central to this module's model.

## 3. Services and synchronization

11. `src/services/aiService.ts` is the core runtime abstraction.
12. Connectivity testing is performed by the AI service layer.
13. `src/store/slices/modelConfigSlice.ts` provides provider presets.
14. Provider configs are expanded into the model availability surface.
15. Workspace settings load timing affects when provider data is hydrated.

## 4. Runtime reality

16. Runtime provider support is broader than current UI exposure.
17. Documentation must not flatten runtime support and UI support into one list.
18. Connectivity probes are scheduled during idle time.
19. Deleting a provider must also collapse its derived model entries.
20. Compare exists to support workload fit, not cosmetic feature parity.

## 5. Safety and failure modes

21. API keys and base URLs are the most sensitive configuration fields.
22. Secure-storage failures directly affect key persistence.
23. Bad base URLs can send requests to the wrong environment.
24. A saved provider is not the same thing as a usable enabled model.
25. Chat and Agent failures often need to be traced back to model configuration.

## 6. Tests and change checks

26. Nearby tests include `aiService.test.ts`.
27. Nearby tests include related store behavior in `appStore.test.ts`.
28. Models changes should first validate provider add, connection test, and model enablement.
29. Changes to provider enums or presets must trigger doc and UI review.
30. The technical goal of Models maintenance is clear configuration, usable capability, explainable errors, and safe key handling.