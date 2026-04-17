# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Suora (朔枢)** is an Electron-based AI desktop application with multi-model support, intelligent agents, skill system, memory management, and plugin architecture. It's designed to be an OpenClaw-like platform for desktop computing.

### Technology Stack
- **Frontend**: React 19 + Vite 6
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand 5
- **Desktop**: Electron 41
- **AI Integration**: Vercel AI SDK 6 (supports Anthropic, OpenAI, Google Vertex)
- **Language**: TypeScript 5.8
- **Build**: electron-vite 5 + Electron Builder 26

## Project Structure

```
src/
├── store/                    # Zustand state management
│   └── appStore.ts          # Global app state (models, messages, skills, agents, memory, settings)
├── services/                 # Core business logic & integrations
│   └── aiService.ts         # AI SDK integration with multi-provider support
├── hooks/                    # Custom React hooks
├── components/               # React components (organized by feature)
├── utils/                    # Utility functions
├── types/                    # TypeScript interfaces & types
└── App.tsx                  # Main app component

electron/
├── main.ts                  # Electron main process
└── preload.ts               # Electron preload script (context isolation)

index.html                   # Electron window entry point
```

## Common Development Tasks

### Setup & Installation
```bash
npm install
```

### Development

```bash
npm run dev          # Runs electron-vite dev (starts Electron + Vite dev server)
```

### Build
```bash
npm run build        # Build with electron-vite (main + preload + renderer)
npm run preview      # Preview production build in Electron
npm run package      # Build + package with electron-builder
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
```

## Architecture Decisions

### 1. **State Management with Zustand**
- Single `appStore` manages all global state
- Features: models, messages, skills, agents, memory (short + long term), API keys, plugins
- Each feature has clear actions (add/remove/update/set)
- Memory is auto-limited (short-term keeps last 100 items)

### 2. **Multi-Provider AI Integration**
- `aiService.ts` abstracts provider initialization (Anthropic, OpenAI, Google)
- Models identified as `provider:modelName` (e.g., `anthropic:claude-3-opus`)
- Supports both `generateText()` for single responses and `streamText()` for streaming
- API keys stored securely in store with per-provider management

### 3. **Core Entities**
- **Models**: Different LLMs from multiple providers with their configurations
- **Messages**: Conversation history with timestamps
- **Skills**: Reusable tools/functions that agents can execute
- **Agents**: Intelligent entities combining system prompts + skill sets
- **Memory**: Short-term (conversation context, last 100 items) + long-term (persistent knowledge)
- **Plugins**: External integrations (WeChat, Feishu, custom APIs)

### 4. **Electron Architecture**
- Main process in `electron/main.ts` with secure preload bridge (`electron/preload.ts`)
- Context isolation enabled for security
- Uses `electron-vite` to build main, preload, and renderer processes
- Dev mode uses `ELECTRON_RENDERER_URL` env var set by electron-vite
- Production mode loads from built `out/renderer/` directory
- Build output: `out/main/`, `out/preload/`, `out/renderer/`
- DevTools enabled in development

## Important Files & Their Roles

| File | Purpose |
|------|---------|
| `src/store/appStore.ts` | Global state for entire application - all models, messages, agents, skills, memory |
| `src/services/aiService.ts` | Initialization and communication with AI providers; handles streaming |
| `electron/main.ts` | Electron main process; window creation and lifecycle |
| `electron.vite.config.ts` | electron-vite config for main, preload, and renderer processes |
| `tailwind.config.ts` | Tailwind CSS configuration |
| `tsconfig.json` | TypeScript configuration |

## Key Patterns

### Adding a New Model
```typescript
// In a component or effect:
import { useAppStore } from '@/store/appStore'

const addNewModel = () => {
  useAppStore.setState((state) => ({
    models: [...state.models, {
      id: 'provider:model-name',
      name: 'Model Display Name',
      provider: 'provider',
    }]
  }))
}
```

### Using AI Service
```typescript
import { streamResponse } from '@/services/aiService'

// Stream response:
for await (const chunk of streamResponse(modelId, messages, systemPrompt)) {
  console.log(chunk)
}
```

### Accessing Zustand Store
```typescript
import { useAppStore } from '@/store/appStore'

function MyComponent() {
  const { models, selectedModel, setSelectedModel } = useAppStore()
  // Use like normal React state
}
```

## Development Guidelines

### Adding a New Feature
1. Define types in `src/types/` if needed
2. Add store actions to `appStore.ts` if it needs global state
3. Create service layer in `src/services/` for complex logic
4. Build React components in `src/components/`
5. Use custom hooks in `src/hooks/` to encapsulate feature logic

### Memory Management
- **Short-term memory**: Limited to last 100 items, use for chat context
- **Long-term memory**: Unlimited, use for persistent knowledge/settings
- Access via `addShortTermMemory()` and `addLongTermMemory()` from store

### Plugin System
- Plugins stored as configuration in `plugins` object in store
- Each plugin has a name and config object
- Build plugin integration layer in `services/` when connecting external APIs

## Build & Deployment

### Development Build
```bash
npm run build       # Build all processes with electron-vite
npm run preview     # Preview the built app in Electron
```

### Package for Distribution
```bash
npm run package     # Build + package with electron-builder
```

Update `electron-builder` config in `package.json` as needed for platform-specific settings (Windows, macOS, Linux).

## Environment & Configuration

- API keys are stored in `apiKeys` store - add UI for managing them
- Plugin configurations in `plugins` store
- Tailwind CSS v4 uses new `@import "tailwindcss"` syntax in CSS files
- TypeScript strict mode enabled
- Google AI uses the OpenAI-compatible endpoint (via `@ai-sdk/openai` with a custom `baseURL`)
- Default dev server runs on `http://localhost:5173` (managed by electron-vite)
- Electron dev tools enabled in development mode

## Version Updates (2025-2026)

- **React**: 19.2.4
- **Zustand**: 5.0.12
- **AI SDK**: 6.0.137 + provider SDKs v3-4
- **Vite**: 6.x (compatible with electron-vite 5.x)
- **electron-vite**: 5.x (build tooling for Electron + Vite)
- **Electron**: 41.x
- **TypeScript**: 5.8.3
- **ESLint**: 10.x
- **Tailwind CSS**: 4.2.x
- **Electron Builder**: 26.x

## Notes

- Always use context isolation in Electron (`contextIsolation: true`)
- Never expose Node.js APIs directly to renderer - use IPC via preload bridge
- Use `@` alias for imports (configured in `electron.vite.config.ts` and `tsconfig.json`)
- Tailwind scans `src/**/*.{js,ts,jsx,tsx}` for class names
- **Electron processes**: Built by electron-vite from `electron/main.ts` and `electron/preload.ts`
  - Main process outputs to `out/main/` (ESM)
  - Preload script outputs to `out/preload/` (CJS for Electron compatibility)
  - Renderer outputs to `out/renderer/`
- **IPC Communication**: Use the exposed `window.electron` bridge for main↔renderer communication
- **Dev Server**: `npm run dev` starts electron-vite which manages both Vite dev server and Electron
