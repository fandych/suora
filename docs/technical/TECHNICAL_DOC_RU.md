# Suora �?Техническая документация

> Настольное AI-приложение на базе Electron с поддержкой нескольких моделей, интеллектуальными агентами, системой навыков, управлением памятью и архитектурой плагинов.

## Содержание

1. [Обзор архитектуры](#1-обзор-архитектуры)  
2. [Структура проекта](#2-структура-проекта)  
3. [Технологический стек](#3-технологический-стек)  
4. [Система сборки](#4-система-сборки)  
5. [Управление состоянием](#5-управление-состоянием)  
6. [Сервисный слой AI](#6-сервисный-слой-ai)  
7. [Система навыков / инструментов](#7-система-навыков--инструментов)  
8. [Система интернационализации](#8-система-интернационализации)  
9. [Система памяти](#9-система-памяти)  
10. [IPC-взаимодействие](#10-ipc-взаимодействие)  
11. [Архитектура безопасности](#11-архитектура-безопасности)  
12. [Система плагинов](#12-система-плагинов)  
13. [Интеграция каналов](#13-интеграция-каналов)  
14. [Тестирование](#14-тестирование)  
15. [CI/CD и релизы](#15-cicd-и-релизы)  
16. [Руководство разработчика](#16-руководство-разработчика)  
17. [Справочник API](#17-справочник-api)

---

## 1. Обзор архитектуры

```
┌───────────────────────────────────────────────────────�?
�?                  Electron Shell                      �?
�?                                                      �?
�? ┌─────────────�? IPC (68 channels)  ┌────────────�? �?
�? │Main Process │◄───────────────────►│  Renderer   �? �?
�? �?(Node.js)   �? preload bridge     �?(React 19)  �? �?
�? �?            �?                     �?            �? �?
�? │�?IPC handlers�?                    │�?Zustand 5  �? �?
�? │�?File I/O   �?                     │�?AI SDK 6   �? �?
�? │�?Shell exec �?                     │�?Tools      �? �?
�? │�?SMTP email �?                     │�?Router     �? �?
�? │�?Logger     �?                     │�?Tailwind 4 �? �?
�? └─────────────�?                     └────────────�? �?
�?       �? contextIsolation: true            �?        �?
�?       └──────── Preload (preload.ts) ──────�?        �?
�?             window.electron.invoke/on/send            �?
└───────────────────────────────────────────────────────�?
```

- **Главный процесс** (`electron/main.ts`) �?Владеет `BrowserWindow`; обрабатывает все операции на уровне ОС (файловая система, командная оболочка, буфер обмена, SMTP, таймеры, автоматизация браузера) через IPC-обработчики.
- **Preload-скрипт** (`electron/preload.ts`) �?Изолированный контекст, предоставляющий белый список из 68 IPC-каналов через `contextBridge.exposeInMainWorld('electron', ...)`.
- **Рендерер** (`src/`) �?React 19 SPA, собранный с помощью Vite 6, состояние через Zustand 5, AI через Vercel AI SDK 6, доступ к ОС через preload-мост.

---

## 2. Структура проекта

```
src/
├── App.tsx                  # React Router (8 маршрутов)
├── index.css                # Tailwind @theme токены (тёмная/светлая тема)
├── store/appStore.ts        # Глобальное состояние Zustand (версия 12)
├── services/
�?  ├── aiService.ts         # Мультипровайдерная AI-интеграция
�?  ├── tools.ts             # 18 категорий навыков, 42+ инструмента
�?  ├── i18n.ts              # 10 языков перевода (~910 ключей)
�?  ├── fileStorage.ts       # JSON-персистенция через IPC + кэш
�?  ├── voiceInteraction.ts  # Web Speech API (STT/TTS)
�?  └── logger.ts            # Перенаправление логов из рендерера в главный процесс
├── hooks/
�?  ├── useI18n.ts           # Хук перевода
�?  └── useTheme.ts          # Хук темы/акцента/шрифта
├── components/              # React-компоненты, организованные по функциональности
├── types/index.ts           # Общие TypeScript-интерфейсы
└── test/setup.ts            # Настройка Vitest

electron/
├── main.ts                  # Главный процесс, IPC-обработчики, SMTP, обновления
├── preload.ts               # Изолированный мост (68 каналов)
└── logger.ts                # RotatingLogger (~/.suora/logs)
```

**Результаты сборки:** `out/main/` (ESM) · `out/preload/` (CJS) · `out/renderer/` (SPA) · `dist/` (установщики)

---

## 3. Технологический стек

| Уровень | Технология | Версия |
|---------|-----------|--------|
| Десктоп | Electron | 41.x |
| Фронтенд | React | 19.2 |
| Сборщик | Vite + electron-vite | 6.0 + 5.0 |
| Стилизация | Tailwind CSS | 4.2 |
| Состояние | Zustand | 5.0 |
| AI SDK | Vercel AI SDK (`ai`) | 6.0 |
| Язык | TypeScript | 5.8+ |
| Маршрутизация | React Router | 7.x |
| Валидация | Zod | 4.x |
| Электронная почта | nodemailer | 8.x |
| HTTP/WS | Express 5 + ws 8 | �?|
| Упаковка | electron-builder | 26.x |
| Тестирование | Vitest 4.x + Playwright 1.58 | �?|

**SDK AI-провайдеров:** `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google-vertex`, `@ai-sdk/openai-compatible` (для Ollama, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, Zhipu, MiniMax и пользовательских эндпоинтов).

---

## 4. Система сборки

Три цели сборки в `electron.vite.config.ts`:

| Цель | Точка входа | Результат | Формат |
|------|-------------|-----------|--------|
| Main | `electron/main.ts` | `out/main/` | ESM |
| Preload | `electron/preload.ts` | `out/preload/` | CJS |
| Renderer | `index.html` | `out/renderer/` | SPA |

Рендерер использует `@vitejs/plugin-react` + `@tailwindcss/vite`, алиас пути `@` �?`./src`, dev-сервер на `127.0.0.1:5173` (строгий порт).

| Команда | Описание |
|---------|----------|
| `npm run dev` | Electron + Vite dev-сервер с HMR |
| `npm run build` | Продакшен-сборка (все три цели) |
| `npm run package` | Сборка + electron-builder (NSIS/DMG/AppImage) |

**Целевые платформы electron-builder:** Windows (NSIS + portable), macOS (DMG + ZIP), Linux (AppImage + DEB + RPM).

---

## 5. Управление состоянием

Единое хранилище Zustand с мидлваром `persist`, использующим IPC-файловое хранилище.

**Имя хранилища:** `suora-store` · **Версия:** 12 · **Бэкенд:** `~/.suora/data/`

### Основные срезы состояния

| Срез | Ключевые поля |
|------|--------------|
| Сессии | `sessions`, `activeSessionId`, `openSessionTabs` |
| Агенты | `agents`, `selectedAgent`, `agentPerformance`, `agentVersions` |
| Модели | `providerConfigs`, `globalModels`, `modelUsageStats` |
| Навыки | `skills`, `pluginTools`, `skillVersions` |
| Память | `globalMemories` |
| Безопасность | `toolSecurity` (разрешённые директории, заблокированные команды, подтверждение) |
| Внешний вид | `theme`, `fontSize`, `codeFont`, `accentColor`, `bubbleStyle`, `locale` |
| Каналы | `channelConfigs`, `channelMessages`, `channelTokens`, `channelHealth` |
| Плагины | `installedPlugins` |
| Электронная почта | `emailConfig` (SMTP) |

### Схема персистенции

```
Zustand �?fileStateStorage adapter �?IPC (store:load/save/remove) �?~/.suora/data/*.json
```

Кэш на основе `Map` в памяти обеспечивает синхронное чтение через `readCached()`/`writeCached()`. При первой загрузке адаптер проверяет файловое хранилище, откатывается к `localStorage` (миграция), затем кэширует.

### Миграции (v1 �?v12)

v2: память агентов, инструменты навыков · v3: значения по умолчанию для `toolSecurity` · v5: `workspacePath` · v7: миграция `providerConfigs` из Record в Array · v8: подтверждение отключено по умолчанию · v9: `globalMemories`, обратное заполнение области видимости памяти · v10: каналы, плагины, локаль, прокси, онбординг · v11: `pluginTools`, `skillVersions` · v12: `emailConfig`

---

## 6. Сервисный слой AI

Экземпляры провайдеров кэшируются по ключу `${providerId}:${apiKey}:${baseUrl}`.

### Поддерживаемые провайдеры (13+)

Anthropic и OpenAI используют нативные SDK. Все остальные используют `@ai-sdk/openai-compatible` с предустановленными базовыми URL (Google �?`generativelanguage.googleapis.com`, Ollama �?`localhost:11434/v1`, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, Zhipu, MiniMax или пользовательский).

### Ключевые функции

```ts
validateModelConfig(model): { valid: boolean; error?: string }
initializeProvider(providerType, apiKey, baseUrl?, providerId?): void
testConnection(providerType, apiKey, baseUrl, modelId): Promise<{ success; error?; latency? }>
generateResponse(modelId, messages, systemPrompt?): Promise<string>
streamResponseWithTools(model, messages, tools, systemPrompt?, maxSteps?): AsyncGenerator<AppStreamEvent[]>
```

### События потока

`text-delta` · `tool-call` · `tool-result` · `tool-error` · `finish-step` · `usage` · `error`

Вызовы инструментов выполняются в многошаговом цикле (максимум 20 шагов по умолчанию, `toolChoice: 'auto'`).

---

## 7. Система навыков / инструментов

### 18 встроенных навыков

| Идентификатор навыка | Инструменты (примеры) |
|---------------------|----------------------|
| `builtin-filesystem` | `list_dir`, `read_file`, `write_file`, `search_files`, `copy_file`, `move_file`, `stat_file` |
| `builtin-shell` | `shell` (bash в Unix, PowerShell в Windows) |
| `builtin-web` | `web_search` (DuckDuckGo), `fetch_webpage` |
| `builtin-utilities` | `get_current_time`, `parse_json`, `generate_uuid` |
| `builtin-todo` | `list_todos`, `add_todo`, `update_todo`, `delete_todo` |
| `builtin-timer` | `list_timers`, `create_timer`, `update_timer`, `delete_timer` |
| `builtin-memory` | `search_memory`, `add_memory` |
| `builtin-browser` | `browser_navigate`, `browser_screenshot`, `browser_evaluate`, `browser_click`, `browser_fill_form` |
| `builtin-agent-comm` | `send_agent_message`, `broadcast_agent_message` |
| `builtin-event-automation` | `register_event_trigger`, `trigger_event` |
| `builtin-self-evolution` | `create_agent_memory`, `update_skill_description` |
| `builtin-file-attachment` | `analyze_image_attachment`, `save_attachment` |
| `builtin-git` | `git_exec` |
| `builtin-code-analysis` | `analyze_code`, `suggest_refactoring` |
| `builtin-advanced-interaction` | `send_persistent_message`, `request_user_input` |
| `builtin-channels` | `channel_send_message`, `channel_read_message` |
| `builtin-email` | `send_email` |
| `builtin-system-management` | `get_system_info`, `read_clipboard`, `write_clipboard`, `notify`, `take_screenshot` |

### Регистрация инструментов

```ts
import { tool } from 'ai'
import { z } from 'zod'

export const builtinToolDefs: ToolSet = {
  list_dir: tool({
    description: 'List files and directories',
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => { /* IPC call */ },
  }),
}
```

Функции: `registerTools()`, `getToolsForSkills(skillIds)`, `buildToolSet()`, `getCustomToolsFromSkill()`, `getPluginTools()`.

Навыки могут быть установлены из маркетплейса (официальный или приватный реестр, управляется через настройку `marketplace` в хранилище).

---

## 8. Система интернационализации

**10 локалей:** en · zh · ja · ko · fr · de · es · pt · ru · ar (~910 ключей в каждой)

```ts
import { useI18n } from '@/hooks/useI18n'
const { t } = useI18n()
t('chat.send')  // перевод с учётом текущей локали
```

**Основные пространства имён:** `nav.*`, `chat.*`, `agents.*`, `skills.*`, `models.*`, `settings.*`, `channels.*`, `common.*`, `onboarding.*`

**Цепочка резервных значений:** текущая локаль �?английский �?переданное значение по умолчанию �?необработанный ключ.

**Добавление языка:** (1) Добавить код в тип `AppLocale`, (2) добавить карту переводов в `i18n.ts`, (3) добавить пункт в интерфейсе настроек.

---

## 9. Система памяти

| Уровень | Область | Лимит | Персистенция |
|---------|---------|-------|-------------|
| Краткосрочная | Сессия | 100 элементов | Только в рамках сессии |
| Долгосрочная | Глобальная | Без ограничений | `globalMemories` в хранилище |
| Векторная | Глобальная | Без ограничений | Инструменты `search_memory`/`add_memory` |

```ts
interface AgentMemoryEntry {
  id: string; content: string; type: string;     // 'fact', 'preference', 'context'
  scope: 'session' | 'global'; createdAt: number; source?: string;
}
```

Агенты с `autoLearn: true` автоматически сохраняют факты через навык `builtin-self-evolution`.

---

## 10. IPC-взаимодействие

**67 invoke-каналов** (запрос-ответ) · **1 send-канал** (`app:ready`) · **6 receive-каналов** (события)

### Preload-мост

```ts
window.electron.invoke(channel, ...args): Promise<unknown>  // по белому списку, выбрасывает ошибку при неизвестном канале
window.electron.on(channel, listener): void                  // по белому списку, тихо игнорирует неизвестные
window.electron.send(channel, ...args): void                 // по белому списку, тихо игнорирует неизвестные
```

### Каталог каналов

| Категория | Каналы |
|-----------|--------|
| Файловая система | `fs:listDir`, `fs:readFile`, `fs:readFileRange`, `fs:writeFile`, `fs:deleteFile`, `fs:editFile`, `fs:searchFiles`, `fs:moveFile`, `fs:copyFile`, `fs:stat`, `fs:watch:start`, `fs:watch:stop` |
| Командная оболочка | `shell:exec`, `shell:openUrl` |
| Веб | `web:search`, `web:fetch` |
| Браузер | `browser:navigate`, `browser:screenshot`, `browser:evaluate`, `browser:extractLinks`, `browser:extractText`, `browser:fillForm`, `browser:click` |
| Буфер обмена | `clipboard:read`, `clipboard:write` |
| Таймеры | `timer:list`, `timer:create`, `timer:update`, `timer:delete`, `timer:history` |
| Хранилище | `store:load`, `store:save`, `store:remove` |
| Безопасное хранилище | `safe-storage:encrypt`, `safe-storage:decrypt`, `safe-storage:isAvailable` |
| Система | `system:getDefaultWorkspacePath`, `system:ensureDirectory`, `system:info`, `system:notify`, `system:screenshot` |
| Каналы | `channel:start/stop/status/register`, `channel:getWebhookUrl`, `channel:sendMessage`, `channel:sendMessageQueued`, `channel:getAccessToken`, `channel:healthCheck`, `channel:debugSend` |
| Электронная почта | `email:send`, `email:test` |
| Обновление | `updater:check`, `updater:getVersion` |
| Логирование | `log:write` |
| Прочее | `app:setAutoStart`, `app:getAutoStart`, `deep-link:getProtocol`, `crash:report/getLogs/clearLogs`, `perf:getMetrics` |

**Входящие события:** `timer:fired`, `channel:message`, `fs:watch:changed`, `app:update`, `updater:available`, `deep-link`

---

## 11. Архитектура безопасности

| Мера | Описание |
|------|----------|
| `nodeIntegration` | `false` �?Node.js недоступен в рендерере |
| `contextIsolation` | `true` �?раздельные JS-контексты |
| Белый список IPC | 68 каналов; неизвестные каналы вызывают ошибку или отклоняются |
| Валидация путей | `ensureAllowedPath()` проверяет пути по `allowedDirectories` со строгим сопоставлением префиксов |
| Чёрный список команд | `ensureCommandAllowed()` отклоняет `rm -rf`, `del /f /q`, `format`, `shutdown` |
| Подтверждение | Опциональное подтверждение пользователя перед выполнением инструмента |
| Безопасное хранилище | Шифрование через связку ключей ОС (DPAPI / Keychain / libsecret) для API-ключей |
| Целостность навыков | Контрольные суммы SHA-256; история версий (`skillVersions`, максимум 500 записей) |
| Аудит логирования | `RotatingLogger` �?10 МБ/файл, 5 файлов/день, хранение 7 дней |

---

## 12. Система плагинов

```ts
interface PluginInfo {
  id: string; name: string; version: string;
  description: string; enabled: boolean; config: Record<string, unknown>;
}
```

Плагины хранятся в `appStore.installedPlugins` и могут регистрировать инструменты через маппинг `pluginTools` (`Record<string, string[]>` �?ID плагина �?имена инструментов). Во время выполнения `getPluginTools()` объединяет инструменты плагинов с доступным набором.

**Точки расширения:** новые инструменты (через `pluginTools`), новые навыки (`type: 'marketplace'`), коннекторы каналов (`ChannelConfig`), пользовательские AI-провайдеры (OpenAI-совместимый `ProviderConfig`).

---

## 13. Интеграция каналов

Внешние платформы (Slack, Discord, Telegram, пользовательские) подключаются через Express-сервер вебхуков, запущенный в главном процессе.

```
Platform �?HTTP webhook �?Main Process (Express) �?channel:message event �?Renderer/AI �?channel:sendMessage �?Platform
```

```ts
interface ChannelConfig {
  id: string; platform: 'slack' | 'discord' | 'telegram' | 'custom';
  name: string; token?: string; webhookUrl?: string; enabled: boolean;
}
```

Мониторинг состояния осуществляется через `channelHealth` в хранилище. Агенты могут взаимодействовать программно, используя навык `builtin-channels`.

---

## 14. Тестирование

### Модульные тесты (Vitest)

Конфигурация: среда `jsdom`, глобальные переменные включены, паттерн `src/**/*.{test,spec}.{ts,tsx}`, пороги покрытия (строки 8%, функции 5%, ветви 5%).

```bash
npm run test          # Режим наблюдения
npm run test:run      # Однократный запуск
npm run test:coverage # С покрытием v8
```

### E2E-тесты (Playwright)

Конфигурация: только Chromium, базовый URL `localhost:5173`, автозапуск dev-сервера (таймаут 120 сек), повторы: 0 локально / 2 в CI.

```bash
npm run test:e2e      # Запуск E2E-тестов
npm run test:e2e:ui   # Интерфейс Playwright
```

---

## 15. CI/CD и релизы

### Рабочий процесс тестирования (`test.yml`) �?push/PR в `main`/`develop`

- **test** задание: линтинг �?проверка типов �?модульные тесты �?загрузка покрытия (Codecov) �?Node 20.x и 22.x, Ubuntu
- **build** задание: сборка �?упаковка �?загрузка артефактов (7 дней) �?Ubuntu/Windows/macOS, Node 22.x

### Рабочий процесс релиза (`release.yml`) �?запускается при создании GitHub Release

Собирает и загружает установщики для платформ: `.AppImage`/`.deb`/`.rpm` (Linux), `.exe`/`.msi` (Windows), `.dmg`/`.zip` (macOS), а также манифесты `latest-*.yml`.

**Автообновление:** GitHub-провайдер electron-builder; `updater:check` запрашивает последний релиз при запуске.

---

## 16. Руководство разработчика

### Начало работы

```bash
git clone https://github.com/fandych/suora.git && cd suora
npm install
npm run dev    # Electron + HMR
```

### Добавление функциональности

1. Определите типы в `src/types/index.ts`
2. Добавьте состояние/действия в `appStore.ts`; увеличьте версию, добавьте миграцию
3. Реализуйте логику в `src/services/`
4. Создайте компоненты в `src/components/`; выделите хуки в `src/hooks/`
5. Зарегистрируйте маршрут в `App.tsx` при необходимости
6. Добавьте ключи интернационализации для всех 10 локалей

### Добавление AI-провайдера

Добавьте ветку в `aiService.ts �?initializeProvider()` с фабрикой SDK и базовым URL по умолчанию, затем добавьте интерфейс на странице моделей. Протестируйте с помощью `testConnection()`.

### Добавление инструмента

```ts
// src/services/tools.ts
my_tool: tool({
  description: 'Does something',
  inputSchema: z.object({ input: z.string() }),
  execute: async ({ input }) => {
    return JSON.stringify(await window.electron.invoke('my:channel', input))
  },
})
```

Если требуется доступ к ОС: добавьте IPC-обработчик в `electron/main.ts`, внесите канал в белый список в `electron/preload.ts`.

### Соглашения

- Алиас пути `@` для всех импортов · Предпочтителен `window.electron.invoke()` вместо Node API · Zod-схемы для входных данных инструментов · Токены Tailwind `@theme` для новых стилей

---

## 17. Справочник API

### Действия хранилища (основные)

```ts
addSession(session) / updateSession(id, data) / removeSession(id)
addAgent(agent) / updateAgent(id, data) / removeAgent(id)
addSkill(skill) / removeSkill(id)
setProviderConfigs(configs: ProviderConfig[])
recordModelUsage(modelId, promptTokens, completionTokens)
recordAgentPerformance(agentId, responseTimeMs, tokens, isError?)
addChannelMessage(msg) / clearChannelMessages(channelId?)
addInstalledPlugin(plugin) / updateInstalledPlugin(id, data) / removeInstalledPlugin(id)
setTheme(mode) / setLocale(locale) / setEmailConfig(config)
```

### Файловое хранилище

```ts
fileStateStorage.getItem(name): Promise<string | null>
fileStateStorage.setItem(name, value): void
fileStateStorage.removeItem(name): void
readCached(name): string | null      // синхронно, из кэша
writeCached(name, value): void       // кэш + асинхронное сохранение через IPC
```

### IPC-мост (сторона рендерера)

```ts
await window.electron.invoke('fs:readFile', path)
await window.electron.invoke('shell:exec', command)
await window.electron.invoke('email:send', { to, subject, body })
window.electron.on('timer:fired', (event, timer) => { ... })
window.electron.on('channel:message', (event, msg) => { ... })
```

### Встроенные агенты

| Агент | Идентификатор | Ключевые навыки |
|-------|--------------|----------------|
| Ассистент | `default-assistant` | Все 18 навыков |
| Эксперт по коду | `builtin-code-expert` | git, code-analysis, filesystem, shell |
| Писатель | `builtin-writer` | filesystem, web, utilities, memory |
| Исследователь | `builtin-researcher` | web, browser, filesystem, memory |
| Аналитик данных | `builtin-data-analyst` | filesystem, shell, utilities, code-analysis |
| DevOps-инженер | `builtin-devops` | shell, filesystem, system-management, git |
| Продакт-менеджер | `builtin-product-manager` | web, browser, utilities, channels |
| Переводчик | `builtin-translator` | web, utilities |
| Специалист по безопасности | `builtin-security` | filesystem, shell, git, code-analysis |

---

*Последнее обновление: 2025*
