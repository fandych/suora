# Техническая документация Suora

Этот документ является технической справкой, основанной на текущей реализации в репозитории. Он предназначен для контрибьюторов и мейнтейнеров и описывает только те структуры, которые реально присутствуют в коде.

## 1. Обзор системы

Suora — это локальная AI-workbench на базе Electron. Основные модули, доступные сейчас:

- Chat
- Documents
- Pipeline
- Models
- Agents
- Skills
- Timer
- Channels
- MCP
- Settings

Приложение построено по local-first модели. Пользовательское состояние, сессии, деревья документов, конфигурации агентов, конфигурации моделей и большая часть метаданных выполнения сохраняются локально через слой персистентности, работающий поверх IPC.

## 2. Архитектура выполнения

Runtime разделен на три слоя.

| Слой | Ответственность |
| --- | --- |
| Electron Main Process | Управляет файловой системой, сетевыми fetch-хелперами, Secure Storage, shell, runtime каналов и IPC-handlers |
| Preload Bridge | Предоставляет allowlist-ориентированное API `window.electron` под context isolation |
| React Renderer | Рендерит интерфейс workbench, хранит состояние в Zustand и оркестрирует AI, документы, пайплайны, каналы и настройки |

Renderer использует Hash Router и лениво загружает функциональные модули.

### Текущие маршруты верхнего уровня

| Route | Модуль |
| --- | --- |
| `/chat` | чат-рабочее пространство |
| `/documents` | рабочее пространство документов |
| `/pipeline` | редактор агентных пайплайнов и история выполнения |
| `/models/:view` | представления провайдеров, моделей и сравнения |
| `/agents` | управление агентами |
| `/skills/:view` | представления установленных skills, обзора и sources |
| `/timer` | управление таймерами и расписаниями |
| `/channels` | интеграции с мессенджерами |
| `/mcp` | интеграции и конфигурация MCP |
| `/settings/:section` | секции настроек |

### Текущие секции настроек

- `general`
- `security`
- `voice`
- `shortcuts`
- `data`
- `logs`
- `system`

## 3. Структура репозитория

Текущий репозиторий организован вокруг оболочки Electron и React-приложения, сгруппированного по возможностям.

```text
electron/
  main.ts          главный процесс Electron и IPC-handlers
  preload.ts       изолированный preload bridge
  channelService.ts
  database.ts

src/
  App.tsx          bootstrap роутера и глобальная инициализация
  main.tsx         вход renderer
  index.css        глобальные theme-токены и UI-стили
  components/      функциональные модули и общий UI
  hooks/           React hooks
  services/        AI, storage, i18n, pipelines, channels, documents
  store/           Zustand store и slices
  types/           общие типы

docs/
  user/            пользовательская документация
  technical/       технические справки

e2e/
  end-to-end тесты Playwright
```

## 4. Технологический стек

| Область | Технология |
| --- | --- |
| Desktop shell | Electron 41 |
| Frontend | React 19 |
| Сборка | Vite 6 + electron-vite 5 |
| Стили | Tailwind CSS 4 |
| Состояние | Zustand 5 |
| Язык | TypeScript 5.8 |
| AI runtime | Vercel AI SDK 6 |
| Unit-тесты | Vitest |
| E2E-тесты | Playwright |

## 5. Модель состояния приложения

Suora использует единый persist-Store Zustand в `src/store/appStore.ts`, который координирует всё состояние workbench.

### Основные домены состояния

- сессии и вкладки чата
- документы, папки и группы документов
- модели и конфигурации провайдеров
- агенты, memories агентов, версии агентов и показатели производительности
- skills, версии skills и внешние sources
- пайплайны и метаданные выполнения
- таймеры
- каналы, здоровье каналов, пользователи, история и tokens
- уведомления
- конфигурация и состояние MCP-серверов
- UI-предпочтения, включая theme, locale, размер шрифта и accent color

### Текущий охват импорта и экспорта

- пользовательские агенты
- пользовательские skills
- все сессии
- конфигурации провайдеров
- настройки внешних директорий

## 6. Слой моделей и AI-сервисов

Интеграция AI находится в `src/services/aiService.ts`.

### Текущая поддержка провайдеров

- Anthropic
- OpenAI
- Google
- Ollama
- DeepSeek
- Zhipu
- MiniMax
- Groq
- Together AI
- Fireworks
- Perplexity
- Cohere
- OpenAI-совместимые endpoints

### Задачи AI-сервиса

- валидировать конфигурацию моделей
- инициализировать и кэшировать клиентов по identity провайдера, API key и base URL
- классифицировать сетевые и provider-ошибки
- генерировать обычные текстовые ответы
- отдавать ответы в streaming внутри multi-step цикла с tools

### Текущие типы streaming-событий

- `text-delta`
- `tool-call`
- `tool-result`
- `tool-error`
- `finish-step`
- `usage`
- `error`

## 7. Система agents и skills

### Текущие встроенные агенты

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### Модель агента

Текущий тип `Agent` включает:

- `systemPrompt`
- `modelId`
- `skills`
- `temperature`
- `maxTokens`
- `maxTurns`
- `responseStyle`
- `allowedTools`
- `disallowedTools`
- `permissionMode`
- `memories`
- `autoLearn`

Это означает, что агенты Suora — не просто prompt-профили. Они также содержат маршрутизацию, ограничения по tools и memory-поведение.

### Модель skills

Текущая система skills построена как prompt-based capability package. Сейчас она поддерживает:

- список установленных skills
- обзор registry
- управление sources
- редактирование и preview `SKILL.md`
- импорт одного файла
- импорт целой папки
- экспорт в markdown или zip
- управление деревом ресурсов рядом с `SKILL.md`

Комментарии в коде и текущее поведение UI ясно разделяют два уровня: встроенные tools по-прежнему поставляются tool-системой, а skills добавляют специализированные инструкции и упакованные ресурсы.

## 8. Documents, pipelines и timers

### Documents

Модуль Documents сейчас поддерживает:

- группы документов
- вложенные папки
- markdown-документы
- Mermaid rendering
- math rendering
- backlinks и references
- поиск по документам
- graph view
- выбор документов как chat context

### Pipeline

Модуль Pipeline сейчас поддерживает:

- многошаговые агентные workflows
- retries и стратегии backoff
- timeouts по шагам
- условное выполнение через `runIf`
- output transforms и экспорт переменных
- лимиты по общей длительности, токенам и числу шагов
- Mermaid preview и экспорт source
- историю выполнения и детали шагов
- сохранение, импорт и экспорт

Chat-слой также поддерживает команды `/pipeline` для списка, запуска, проверки статуса, чтения истории и отмены сохранённых пайплайнов.

### Timer

Текущие типы timer:

- `Once`
- `Interval`
- `Cron`

Текущие действия timer:

- desktop notification
- выполнить agent prompt
- выполнить сохранённый pipeline

## 9. Channels и MCP

### Платформы каналов

Текущая поверхность `ChannelPlatform` поддерживает:

- WeChat Work
- WeChat Official Account
- WeChat Mini Program
- Feishu / Lark
- DingTalk
- Slack
- Telegram
- Discord
- Microsoft Teams
- Custom channels

### Текущее поведение каналов

- транспорт webhook или stream
- один reply-agent на канал
- auto-reply включен или выключен
- allowlist чатов
- история сообщений
- список пользователей
- панель здоровья
- панель отладки

### MCP

Модуль интеграций сейчас предоставляет:

- конфигурацию серверов
- отслеживание состояния подключения
- интеграцию MCP-возможностей в выполнение агентов

## 10. Модель IPC и безопасности

Suora сохраняет context isolation в Electron и направляет привилегированные операции через preload bridge.

### Основные текущие характеристики безопасности

- renderer не обращается напрямую к Node.js API
- preload раскрывает только allowlist-поверхность invoke/on/send
- сбои secure storage показываются как предупреждения в UI
- доступ к файловой системе можно ограничить sandbox-режимом
- пользователь может задать список разрешенных директорий
- опасные shell-паттерны можно блокировать
- выполнение tools может требовать предварительного подтверждения

### Текущее поведение Secure Storage

Приложение сначала пытается сохранить API keys в безопасном хранилище ОС. Если оно недоступно или шифрование завершается ошибкой, UI предупреждает, что ключи остаются только в памяти и должны быть введены заново после перезапуска.

## 11. UI theme, локализация, сборка и тесты

### Theme и предпочтения

Renderer использует общую систему theme-токенов в `src/index.css` и hooks вроде `useTheme`. Сейчас поддерживаются:

- светлая, тёмная или системная theme
- размер шрифта
- шрифт кода
- accent color
- язык

Текущий theme mode по умолчанию — `system`.

### Текущий набор языков

- English
- Chinese
- Japanese
- Korean
- French
- German
- Spanish
- Portuguese
- Russian
- Arabic

### Часто используемые команды разработки

```bash
npm install
npm run dev
npm run build
npm run preview
npm run package
npm run lint
npm run type-check
npm run test:run
npm run test:e2e
```

### Сейчас видимое покрытие тестами

- поведение Electron preload
- storage utilities
- onboarding UI
- поведение skill editor
- marketplace и skill registry flows
- theme hooks
- database helpers
- Playwright smoke-сценарии

## 12. Заметки по сопровождению

При обновлении технической документации этого репозитория отдавайте приоритет фактам, подтверждённым кодом, а не унаследованным формулировкам. Самые надёжные точки опоры:

- реальные routes в `src/App.tsx`
- реальные встроенные agents в `src/store/appStore.ts`
- реальные типы providers в `src/services/aiService.ts`
- реальные секции settings в `src/components/settings/SettingsLayout.tsx`

Если код не был только что перепроверен, не фиксируйте в документации числа, склонные к drift, например общее количество IPC channels или общее количество tools.