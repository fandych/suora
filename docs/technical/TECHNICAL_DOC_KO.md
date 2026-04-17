# Suora �?기술 문서

> 멀�?모델 지�? 지능형 에이전트, 스킬 시스�? 메모�?관�? 플러그인 아키텍처�?갖춘 Electron 기반 인텔리전�?데스크톱 애플리케이션.

## 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [프로젝트 구조](#2-프로젝트-구조)
3. [기술 스택](#3-기술-스택)
4. [빌드 시스템](#4-빌드-시스�?
5. [상태 관리](#5-상태-관�?
6. [AI 서비�?레이어](#6-ai-서비�?레이�?
7. [스킬/도구 시스템](#7-스킬도구-시스�?
8. [국제�?시스템](#8-국제�?시스�?
9. [메모�?시스템](#9-메모�?시스�?
10. [IPC 통신](#10-ipc-통신)
11. [보안 아키텍처](#11-보안-아키텍처)
12. [플러그인 시스템](#12-플러그인-시스�?
13. [채널 통합](#13-채널-통합)
14. [테스트](#14-테스�?
15. [CI/CD �?릴리스](#15-cicd-�?릴리�?
16. [개발 가이드](#16-개발-가이드)
17. [API 레퍼런스](#17-api-레퍼런스)

---

## 1. 아키텍처 개요

```
┌───────────────────────────────────────────────────────�?
�?                  Electron Shell                      �?
�?                                                      �?
�? ┌─────────────�? IPC (68�?채널)    ┌────────────�? �?
�? │메�?프로세스  │◄───────────────────►│  렌더�?    �? �?
�? �?(Node.js)   �? preload 브리지     �?(React 19)  �? �?
�? �?            �?                     �?            �? �?
�? │�?IPC 핸들�?�?                     │�?Zustand 5  �? �?
�? │�?파일 I/O   �?                     │�?AI SDK 6   �? �?
�? │�?Shell 실행 �?                     │�?도구       �? �?
�? │�?SMTP 이메일│                      │�?라우�?    �? �?
�? │�?로거       �?                     │�?Tailwind 4 �? �?
�? └─────────────�?                     └────────────�? �?
�?       �? contextIsolation: true            �?        �?
�?       └──────── Preload (preload.ts) ──────�?        �?
�?             window.electron.invoke/on/send            �?
└───────────────────────────────────────────────────────�?
```

- **메인 프로세스** (`electron/main.ts`) �?`BrowserWindow`�?소유하며 IPC 핸들러를 통해 모든 OS 수준 작업(파일시스�? Shell, 클립보드, SMTP, 타이머, 브라우저 자동�?�?처리합니�?
- **프리로드 스크립트** (`electron/preload.ts`) �?격리�?컨텍스트�? `contextBridge.exposeInMainWorld('electron', ...)`�?통해 68�?IPC 채널�?화이트리스트�?노출합니�?
- **렌더�?* (`src/`) �?Vite 6으로 번들링된 React 19 싱글 페이지 애플리케이션. Zustand 5�?상태 관�? Vercel AI SDK 6으로 AI 통합, 프리로드 브리지�?통한 OS 접근�?제공합니�?

---

## 2. 프로젝트 구조

```
src/
├── App.tsx                  # React Router (8�?라우�?
├── index.css                # Tailwind @theme 토큰 (다크/라이�?
├── store/appStore.ts        # Zustand 글로벌 상태 (버전 12)
├── services/
�?  ├── aiService.ts         # 멀�?프로바이�?AI 통합
�?  ├── tools.ts             # 18�?스킬 카테고리, 42�?이상�?도구
�?  ├── i18n.ts              # 10�?언어 번역 (�?910�?�?
�?  ├── fileStorage.ts       # IPC 기반 JSON 영속�?+ 캐시
�?  ├── voiceInteraction.ts  # Web Speech API (음성 인식/음성 합성)
�?  └── logger.ts            # 렌더�?�?메인 프로세스 로그 전달
├── hooks/
�?  ├── useI18n.ts           # 번역 �?
�?  └── useTheme.ts          # 테마/강조�?폰트 �?
├── components/              # 기능별로 정리�?React 컴포넌트
├── types/index.ts           # 공유 TypeScript 인터페이�?
└── test/setup.ts            # Vitest 설정

electron/
├── main.ts                  # 메인 프로세스, IPC 핸들�? SMTP, 업데이터
├── preload.ts               # 컨텍스트 격리 브리지 (68�?채널)
└── logger.ts                # RotatingLogger (~/.suora/logs)
```

**빌드 출력:** `out/main/` (ESM) · `out/preload/` (CJS) · `out/renderer/` (SPA) · `dist/` (설치 파일)

---

## 3. 기술 스택

| 레이�?| 기술 | 버전 |
|--------|------|------|
| 데스크톱 | Electron | 41.x |
| 프론트엔�?| React | 19.2 |
| 번들�?| Vite + electron-vite | 6.0 + 5.0 |
| 스타일링 | Tailwind CSS | 4.2 |
| 상태 관�?| Zustand | 5.0 |
| AI SDK | Vercel AI SDK (`ai`) | 6.0 |
| 언어 | TypeScript | 5.8+ |
| 라우�?| React Router | 7.x |
| 유효�?검�?| Zod | 4.x |
| 이메�?| nodemailer | 8.x |
| HTTP/WS | Express 5 + ws 8 | �?|
| 패키�?| electron-builder | 26.x |
| 테스�?| Vitest 4.x + Playwright 1.58 | �?|

**AI 프로바이�?패키지:** `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google-vertex`, `@ai-sdk/openai-compatible` (Ollama, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, Zhipu, MiniMax �?커스텀 엔드포인트용).

---

## 4. 빌드 시스�?

`electron.vite.config.ts`�?3개의 빌드 대상이 정의되어 있습니다:

| 대�?| 엔트�?| 출력 | 포맷 |
|------|--------|------|------|
| Main | `electron/main.ts` | `out/main/` | ESM |
| Preload | `electron/preload.ts` | `out/preload/` | CJS |
| Renderer | `index.html` | `out/renderer/` | SPA |

렌더러는 `@vitejs/plugin-react` + `@tailwindcss/vite`�?사용하며, 경로 별칭 `@` �?`./src`가 설정되어 있고, 개발 서버�?`127.0.0.1:5173` (엄격 포트)에서 동작합니�?

| 명령�?| 설명 |
|--------|------|
| `npm run dev` | Electron + Vite 개발 서버 (�?모듈 교체(HMR) 지�? |
| `npm run build` | 프로덕션 빌드 (전체 3�?대�? |
| `npm run package` | 빌드 + electron-builder 패키�?(NSIS/DMG/AppImage) |

**electron-builder 대�?플랫�?** Windows (NSIS + 포터�?, macOS (DMG + ZIP), Linux (AppImage + DEB + RPM).

---

## 5. 상태 관�?

IPC 파일 스토리지�?백엔드로 하는 `persist` 미들웨어가 적용�?단일 Zustand 스토�?

**스토�?이름:** `suora-store` · **버전:** 12 · **백엔�?** `~/.suora/data/`

### 주요 상태 슬라이스

| 슬라이스 | 주요 필드 |
|---------|----------|
| 세션 | `sessions`, `activeSessionId`, `openSessionTabs` |
| 에이전트 | `agents`, `selectedAgent`, `agentPerformance`, `agentVersions` |
| 모델 | `providerConfigs`, `globalModels`, `modelUsageStats` |
| 스킬 | `skills`, `pluginTools`, `skillVersions` |
| 메모�?| `globalMemories` |
| 보안 | `toolSecurity` (허용 디렉토리, 차단 명령�? 확인) |
| 외관 | `theme`, `fontSize`, `codeFont`, `accentColor`, `bubbleStyle`, `locale` |
| 채널 | `channelConfigs`, `channelMessages`, `channelTokens`, `channelHealth` |
| 플러그인 | `installedPlugins` |
| 이메�?| `emailConfig` (SMTP) |

### 영속�?플로�?

```
Zustand �?fileStateStorage 어댑�?�?IPC (store:load/save/remove) �?~/.suora/data/*.json
```

인메모리 `Map` 캐시�?통해 `readCached()`/`writeCached()`�?동기 읽기가 가능합니다. 최초 로드 �?어댑터는 파일 스토리지�?확인하고, `localStorage`(마이그레이션)�?폴백�?�?캐시합니�?

### 마이그레이션 (버전 1 �?12)

v2: 에이전트 메모�? 스킬 도구 · v3: `toolSecurity` 기본�?· v5: `workspacePath` · v7: `providerConfigs`�?Record에서 Array�?마이그레이션 · v8: 기본적으�?확인 비활성화 · v9: `globalMemories`, 메모�?스코�?백필 · v10: 채널, 플러그인, 로캘, 에이전트, 온보�?· v11: `pluginTools`, `skillVersions` · v12: `emailConfig`

---

## 6. AI 서비�?레이�?

프로바이�?인스턴스�?`${providerId}:${apiKey}:${baseUrl}` 키로 캐시됩니�?

### 지�?프로바이�?(13�?이상)

Anthropic�?OpenAI�?각각�?네이티브 SDK 패키지�?사용합니�? 기타 모든 프로바이더는 `@ai-sdk/openai-compatible`�?사용하며 사전 구성�?베이�?URL (Google �?`generativelanguage.googleapis.com`, Ollama �?`localhost:11434/v1`, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, Zhipu, MiniMax 또는 커스텀)�?동작합니�?

### 주요 함수

```ts
validateModelConfig(model): { valid: boolean; error?: string }
initializeProvider(providerType, apiKey, baseUrl?, providerId?): void
testConnection(providerType, apiKey, baseUrl, modelId): Promise<{ success; error?; latency? }>
generateResponse(modelId, messages, systemPrompt?): Promise<string>
streamResponseWithTools(model, messages, tools, systemPrompt?, maxSteps?): AsyncGenerator<AppStreamEvent[]>
```

### 스트리밍 이벤�?

`text-delta` · `tool-call` · `tool-result` · `tool-error` · `finish-step` · `usage` · `error`

도구 호출은 멀�?스텝 루프에서 실행됩니�?(기본 최대 20스텝, `toolChoice: 'auto'`).

---

## 7. 스킬/도구 시스�?

### 18�?내장 스킬

| 스킬 ID | 도구 (예시) |
|---------|------------|
| `builtin-filesystem` | `list_dir`, `read_file`, `write_file`, `search_files`, `copy_file`, `move_file`, `stat_file` |
| `builtin-shell` | `shell` (Unix에서�?bash, Windows에서�?PowerShell) |
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

### 도구 등록

```ts
import { tool } from 'ai'
import { z } from 'zod'

export const builtinToolDefs: ToolSet = {
  list_dir: tool({
    description: 'List files and directories',
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => { /* IPC 호출 */ },
  }),
}
```

함수: `registerTools()`, `getToolsForSkills(skillIds)`, `buildToolSet()`, `getCustomToolsFromSkill()`, `getPluginTools()`.

스킬은 마켓플레이스에서 설치�?�?있습니다 (공식 또는 프라이빗 레지스트�? 스토어의 `marketplace` 설정으로 제어).

---

## 8. 국제�?시스�?

**10�?언어:** en · zh · ja · ko · fr · de · es · pt · ru · ar (언어�?�?910�?�?

```ts
import { useI18n } from '@/hooks/useI18n'
const { t } = useI18n()
t('chat.send')  // 로캘 인식 번역
```

**주요 네임스페이스:** `nav.*`, `chat.*`, `agents.*`, `skills.*`, `models.*`, `settings.*`, `channels.*`, `common.*`, `onboarding.*`

**폴백 체인:** 현재 로캘 �?영어 �?제공�?폴백 �?원시 �?

**언어 추가:** (1) `AppLocale` 타입에 코드 추가, (2) `i18n.ts`�?번역 �?추가, (3) 설정�?UI 옵션 추가.

---

## 9. 메모�?시스�?

| 레벨 | 범위 | 제한 | 영속�?|
|------|------|------|--------|
| 단기 | 세션�?| 100�?| 세션 수명 동안�?|
| 장기 | 글로벌 | 무제�?| 스토어의 `globalMemories` |
| 벡터 | 글로벌 | 무제�?| `search_memory`/`add_memory` 도구 |

```ts
interface AgentMemoryEntry {
  id: string; content: string; type: string;     // 'fact', 'preference', 'context'
  scope: 'session' | 'global'; createdAt: number; source?: string;
}
```

`autoLearn: true`가 설정�?에이전트�?`builtin-self-evolution` 스킬�?통해 자동으로 사실�?영속화합니다.

---

## 10. IPC 통신

**67�?invoke 채널** (요청-응답) · **1�?send 채널** (`app:ready`) · **6�?on 채널** (이벤�?

### Preload 브리지

```ts
window.electron.invoke(channel, ...args): Promise<unknown>  // 화이트리스트 대�? �?�?없는 채널은 예외 발생
window.electron.on(channel, listener): void                  // 화이트리스트 대�? �?외는 무시
window.electron.send(channel, ...args): void                 // 화이트리스트 대�? �?외는 무시
```

### 채널 인덱�?

| 카테고리 | 채널 |
|---------|------|
| 파일시스�?| `fs:listDir`, `fs:readFile`, `fs:readFileRange`, `fs:writeFile`, `fs:deleteFile`, `fs:editFile`, `fs:searchFiles`, `fs:moveFile`, `fs:copyFile`, `fs:stat`, `fs:watch:start`, `fs:watch:stop` |
| Shell | `shell:exec`, `shell:openUrl` |
| �?| `web:search`, `web:fetch` |
| 브라우저 | `browser:navigate`, `browser:screenshot`, `browser:evaluate`, `browser:extractLinks`, `browser:extractText`, `browser:fillForm`, `browser:click` |
| 클립보드 | `clipboard:read`, `clipboard:write` |
| 타이머 | `timer:list`, `timer:create`, `timer:update`, `timer:delete`, `timer:history` |
| 스토�?| `store:load`, `store:save`, `store:remove` |
| 보안 스토리지 | `safe-storage:encrypt`, `safe-storage:decrypt`, `safe-storage:isAvailable` |
| 시스�?| `system:getDefaultWorkspacePath`, `system:ensureDirectory`, `system:info`, `system:notify`, `system:screenshot` |
| 채널 | `channel:start/stop/status/register`, `channel:getWebhookUrl`, `channel:sendMessage`, `channel:sendMessageQueued`, `channel:getAccessToken`, `channel:healthCheck`, `channel:debugSend` |
| 이메�?| `email:send`, `email:test` |
| 업데이터 | `updater:check`, `updater:getVersion` |
| 로깅 | `log:write` |
| 기타 | `app:setAutoStart`, `app:getAutoStart`, `deep-link:getProtocol`, `crash:report/getLogs/clearLogs`, `perf:getMetrics` |

**이벤�?채널:** `timer:fired`, `channel:message`, `fs:watch:changed`, `app:update`, `updater:available`, `deep-link`

---

## 11. 보안 아키텍처

| 조치 | 상세 |
|------|------|
| `nodeIntegration` | `false` �?렌더러에�?Node.js 사용 불가 |
| `contextIsolation` | `true` �?분리�?JavaScript 컨텍스트 |
| IPC 화이트리스트 | 68�?채널; �?�?없는 채널은 예외 발생 또는 무시 |
| 경로 검�?| `ensureAllowedPath()`가 엄격�?접두�?매칭으로 `allowedDirectories`�?검�?|
| 차단 명령�?| `ensureCommandAllowed()`가 `rm -rf`, `del /f /q`, `format`, `shutdown`�?거부 |
| 확인 | 도구 실행 �?선택�?사용�?확인 |
| 보안 스토리지 | OS 키링 암호�?(DPAPI / Keychain / libsecret)�?API �?보호 |
| 스킬 무결�?| SHA-256 체크�? 버전 이력 (`skillVersions`, 최대 500�?항목) |
| 감사 로그 | `RotatingLogger` �?파일�?10 MB, 하루 5�?파일, 7�?보존 |

---

## 12. 플러그인 시스�?

```ts
interface PluginInfo {
  id: string; name: string; version: string;
  description: string; enabled: boolean; config: Record<string, unknown>;
}
```

플러그인은 `appStore.installedPlugins`�?저장되�?`pluginTools` 매핑 (`Record<string, string[]>` �?플러그인 ID �?도구 이름)�?통해 도구�?등록�?�?있습니다. 런타�?�?`getPluginTools()`가 플러그인 도구�?사용 가능한 도구 세트�?병합합니�?

**확장 포인�?** �?도구 (`pluginTools` 통해), �?스킬 (`type: 'marketplace'`), 채널 커넥�?(`ChannelConfig`), 커스텀 AI 프로바이�?(OpenAI 호환 `ProviderConfig`).

---

## 13. 채널 통합

외부 플랫�?(Slack, Discord, Telegram, 커스텀)은 메인 프로세스에서 실행되는 Express Webhook 서버�?통해 연결합니�?

```
플랫�?�?HTTP webhook �?메인 프로세스 (Express) �?channel:message 이벤�?�?렌더�?AI �?channel:sendMessage �?플랫�?
```

```ts
interface ChannelConfig {
  id: string; platform: 'slack' | 'discord' | 'telegram' | 'custom';
  name: string; token?: string; webhookUrl?: string; enabled: boolean;
}
```

헬스�?`channelHealth` 스토어를 통해 모니터링됩니�? 에이전트�?`builtin-channels` 스킬�?사용하여 프로그래�?방식으로 상호작용�?�?있습니다.

---

## 14. 테스�?

### 단위 테스�?(Vitest)

설정: `jsdom` 환경, globals 활성�? 패턴 `src/**/*.{test,spec}.{ts,tsx}`, 커버리지 임계�?(라인 8%, 함수 5%, 브랜�?5%).

```bash
npm run test          # 감시 모드
npm run test:run      # 단일 실행
npm run test:coverage # v8 커버리지 포함
```

### 엔드투엔�?테스�?(Playwright)

설정: Chromium�?사용, 베이�?URL `localhost:5173`, 개발 서버 자동 시작 (120�?타임아�?, 로컬 재시�?0�?/ CI에서 2�?

```bash
npm run test:e2e      # 엔드투엔�?테스�?실행
npm run test:e2e:ui   # Playwright UI
```

---

## 15. CI/CD �?릴리�?

### 테스�?워크플로�?(`test.yml`) �?`main`/`develop`�?대�?push 또는 pull request �?

- **Test** 작업: lint �?타�?검�?�?단위 테스�?�?커버리지 업로�?(Codecov) �?Node 20.x & 22.x, Ubuntu
- **Build** 작업: 빌드 �?패키�?�?아티팩트 업로�?(7�? �?Ubuntu/Windows/macOS, Node 22.x

### 릴리�?워크플로�?(`release.yml`) �?GitHub 릴리�?생성 �?트리�?

플랫폼별 설치 파일�?빌드하여 업로�? `.AppImage`/`.deb`/`.rpm` (Linux), `.exe`/`.msi` (Windows), `.dmg`/`.zip` (macOS) �?`latest-*.yml` 메타데이�?

**자동 업데이터:** electron-builder GitHub 프로바이�? `updater:check`가 시작 �?최신 릴리스를 확인합니�?

---

## 16. 개발 가이드

### 설정

```bash
git clone https://github.com/fandych/suora.git && cd suora
npm install
npm run dev    # Electron + HMR
```

### 기능 추가

1. `src/types/index.ts`에서 타�?정의
2. `appStore.ts`�?상태/액션 추가; 버전 업데이트 �?마이그레이션 추가
3. `src/services/`�?로직 구현
4. `src/components/`에서 컴포넌트 빌드; 훅은 `src/hooks/`�?추출
5. 필요�?`App.tsx`�?라우�?등록
6. 모든 10�?언어�?i18n �?추가

### AI 프로바이�?추가

`aiService.ts �?initializeProvider()`�?케이스�?추가하고 SDK 팩토리와 기본 베이�?URL�?설정�?�?모델 페이지�?UI�?추가합니�? `testConnection()`으로 테스트하세요.

### 도구 추가

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

도구가 OS 접근�?필요�?경우: `electron/main.ts`�?IPC 핸들러를 추가하고 `electron/preload.ts`�?화이트리스트�?채널�?추가하세�?

### 컨벤�?

- 모든 임포트에 `@` 경로 별칭 사용 · Node API 대�?`window.electron.invoke()` 우선 · 도구 입력�?Zod 스키�?사용 · �?스타일에 Tailwind `@theme` 토큰 사용

---

## 17. API 레퍼런스

### 스토�?액션 (주요 하위 집합)

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

### 파일 스토리지

```ts
fileStateStorage.getItem(name): Promise<string | null>
fileStateStorage.setItem(name, value): void
fileStateStorage.removeItem(name): void
readCached(name): string | null      // 동기, 인메모리 캐시에서 읽기
writeCached(name, value): void       // 캐시 + 비동�?IPC 저�?
```

### IPC 브리지 (렌더�?�?

```ts
await window.electron.invoke('fs:readFile', path)
await window.electron.invoke('shell:exec', command)
await window.electron.invoke('email:send', { to, subject, body })
window.electron.on('timer:fired', (event, timer) => { ... })
window.electron.on('channel:message', (event, msg) => { ... })
```

### 내장 에이전트

| 에이전트 | ID | 주요 스킬 |
|---------|----|---------| 
| 어시스턴�?| `default-assistant` | 전체 18�?스킬 |
| 코드 전문가 | `builtin-code-expert` | git, code-analysis, filesystem, shell |
| 작가 | `builtin-writer` | filesystem, web, utilities, memory |
| 연구�?| `builtin-researcher` | web, browser, filesystem, memory |
| 데이�?분석가 | `builtin-data-analyst` | filesystem, shell, utilities, code-analysis |
| DevOps 엔지니어 | `builtin-devops` | shell, filesystem, system-management, git |
| 프로덕트 매니저 | `builtin-product-manager` | web, browser, utilities, channels |
| 번역가 | `builtin-translator` | web, utilities |
| 보안 전문가 | `builtin-security` | filesystem, shell, git, code-analysis |

---

*마지�?업데이트: 2025*
