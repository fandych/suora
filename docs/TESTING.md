# Testing Guide

This document describes the current testing setup for Suora as implemented in this repository.

## Scope

The repository currently uses two main testing layers:

- Vitest for unit, service, store, and component tests
- Playwright for browser-based end-to-end smoke coverage

This is important: the current Playwright configuration targets a Vite server on `http://localhost:5173`. It is useful for renderer and browser-level smoke paths, but it is not yet a dedicated Electron-window automation harness.

## Tooling

| Area | Current tool |
| --- | --- |
| Unit and integration tests | Vitest 4.1.x |
| React component testing | Testing Library |
| DOM environment | jsdom |
| Coverage provider | `@vitest/coverage-v8` |
| End-to-end smoke tests | Playwright 1.58.x |

## Available Commands

The current commands come from `package.json`.

```bash
# Vitest watch mode
npm test

# Run unit/component tests once
npm run test:run

# Vitest UI
npm run test:ui

# Coverage report
npm run test:coverage

# Playwright smoke tests
npm run test:e2e

# Playwright UI mode
npm run test:e2e:ui
```

## Current Test Discovery

Vitest is configured in `vitest.config.ts` to include:

- `src/**/*.{test,spec}.{ts,tsx}`
- `electron/**/*.{test,spec}.{ts,tsx}`

Playwright is configured in `playwright.config.ts` to load tests from:

- `e2e/`

## Coverage Configuration

Coverage uses the V8 provider and currently emits:

- text
- json
- html
- lcov

The current minimum thresholds in `vitest.config.ts` are:

| Metric | Threshold |
| --- | --- |
| Lines | 19 |
| Functions | 13 |
| Branches | 13 |
| Statements | 17 |

These are the actual enforced thresholds today. Older documentation that described a 60% global gate is no longer accurate for this repository state.

## What Is Covered Today

The current test tree shows coverage across multiple layers rather than only a handful of service files.

### Service-level tests

Examples currently present:

- `aiService`
- `agentPipelineService`
- `agentSelection`
- `agentDiagnostics`
- `channelMessageHandler`
- `chatContext`
- `customSkillRuntime`
- `documents`
- `mcpSystem`
- `pipelineChatCommands`
- `pipelineFiles`
- `pipelineMermaid`
- `pipelineOutputTransforms`
- `pipelinePortability`
- `pipelineRunIf`
- `pipelineValidation`
- `pluginSystem`
- `safePersistStorage`
- `sanitization`
- `secureState`
- `sessionFiles`
- `skillArchive`
- `skillMarketplace`
- `skillRegistry`
- `skillSecurity`
- `timerRuntime`
- `vectorMemory`
- `workspaceSettings`

### Component and UI tests

Examples currently present:

- onboarding wizard
- chat markdown and chat main
- channel panels
- documents layout and document graph view
- skill editor and skills layout
- navigation bar
- system prompt markdown editor
- theme hook and UI preference slice

### Store and Electron tests

Examples currently present:

- app store
- Electron preload
- Electron file-system helpers
- Electron database helpers

### End-to-end smoke coverage

The current `e2e/basic.spec.ts` file exercises a renderer-focused smoke path through the Vite server. It is useful for regression protection on visible UI startup behavior, but it should not be documented as full desktop-process automation.

## How To Run Focused Tests

### Run a single Vitest file

```bash
npx vitest run src/services/aiService.test.ts
```

### Run tests that match a name

```bash
npx vitest run -t "pipeline"
```

### Run the Playwright smoke spec

```bash
npx playwright test e2e/basic.spec.ts
```

## Test Writing Guidance

### Unit and service tests

- Keep tests close to the source file where practical.
- Prefer focused behavioral tests over large snapshot-style suites.
- Cover success, validation failure, cancellation, and persistence edge cases when they exist.
- Use sanitized fixtures when a feature touches secrets, paths, or external responses.

### React component tests

- Test user-visible behavior rather than implementation details.
- Prefer Testing Library queries that resemble real user interaction.
- Mock `window.electron` only to the level needed by the component under test.

### Playwright tests

- Treat current Playwright coverage as browser smoke coverage for the renderer.
- Avoid describing it as packaged Electron app verification unless the config changes to launch Electron directly.

## Common Issues

### Tests fail because browser APIs are missing

Check whether the case belongs in Vitest with jsdom or in Playwright. Some renderer behavior needs a browser-like environment, while Electron-specific behavior may need dedicated mocks.

### Tests pass locally but coverage numbers differ

Make sure you are running `npm run test:coverage` rather than `npm run test:run`. The enforced thresholds come from coverage mode.

### Playwright cannot start the app

The Playwright config expects the Vite E2E server defined in `vite.e2e.config.ts` and binds to port `5173`. Port conflicts or a stale server can cause failures.

## Known Gaps In The Current Test Strategy

- No dedicated Electron-window E2E harness is configured yet.
- The current E2E layer does not fully validate main-process IPC flows inside a packaged desktop runtime.
- Documentation should avoid hard-coding total test counts unless they are freshly measured.

## Maintenance Notes

When updating this file, verify against:

- `package.json`
- `vitest.config.ts`
- `playwright.config.ts`
- the current `src/**/*.test.*`, `electron/**/*.test.*`, and `e2e/**/*.spec.*` files

If the repository later adds true Electron automation or changes coverage thresholds, update this document immediately.