# Suora 기술 문서

이 문서는 현재 저장소 구현을 기준으로 작성한 기술 참조 문서입니다. 기여자와 유지보수자를 위해 코드와 일치하는 구조만 기록합니다.

## 1. 시스템 개요

Suora 는 Electron 기반의 로컬 AI 워크벤치입니다. 현재 주요 작업 모듈은 다음과 같습니다.

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

앱은 로컬 우선 방식으로 설계되어 있으며, 사용자 상태, 대화 세션, 문서 트리, Agent 설정, Model 설정, 실행 메타데이터 대부분을 IPC 기반 영속화 계층에 저장합니다.

## 2. 런타임 아키텍처

런타임은 세 층으로 나뉩니다.

| 층 | 역할 |
| --- | --- |
| Electron Main Process | 파일 시스템, 네트워크 fetch 보조, Secure Storage, Shell, 채널 런타임, IPC handler 담당 |
| Preload Bridge | context isolation 아래 allowlist 기반 `window.electron` API 노출 |
| React Renderer | 워크벤치 UI 렌더링, Zustand 상태 관리, AI·문서·파이프라인·채널·설정 조합 |

렌더러는 Hash Router 를 사용하고 각 기능 모듈을 lazy load 합니다.

### 현재 최상위 라우트

| 라우트 | 모듈 |
| --- | --- |
| `/chat` | 채팅 워크벤치 |
| `/documents` | 문서 워크벤치 |
| `/pipeline` | Agent Pipeline 편집과 실행 이력 |
| `/models/:view` | Provider, Model, Compare 뷰 |
| `/agents` | Agent 관리 |
| `/skills/:view` | 설치됨, 탐색, 소스 뷰 |
| `/timer` | 타이머와 스케줄 관리 |
| `/channels` | 메시징 채널 통합 |
| `/mcp` | 통합과 MCP 설정 |
| `/settings/:section` | 설정 섹션 |

### 현재 설정 섹션

- `general`
- `security`
- `voice`
- `shortcuts`
- `data`
- `logs`
- `system`

## 3. 저장소 구조

현재 구조는 Electron 셸과 기능별로 정리된 React 앱을 중심으로 구성됩니다.

```text
electron/
  main.ts          Electron main process 와 IPC handlers
  preload.ts       context-isolated preload bridge
  channelService.ts
  database.ts

src/
  App.tsx          라우터 부트스트랩과 전역 초기화
  main.tsx         renderer entry
  index.css        전역 theme token 과 UI 스타일
  components/      기능 모듈과 공유 UI
  hooks/           React hooks
  services/        AI, storage, i18n, pipeline, channel, documents
  store/           Zustand store 와 slices
  types/           공유 타입 정의

docs/
  user/            사용자 문서
  technical/       기술 참조 문서

e2e/
  Playwright E2E 테스트
```

## 4. 기술 스택

| 영역 | 기술 |
| --- | --- |
| 데스크톱 셸 | Electron 41 |
| 프론트엔드 | React 19 |
| 빌드 도구 | Vite 6 + electron-vite 5 |
| 스타일 | Tailwind CSS 4 |
| 상태 관리 | Zustand 5 |
| 언어 | TypeScript 5.8 |
| AI 런타임 | Vercel AI SDK 6 |
| 단위 테스트 | Vitest |
| E2E 테스트 | Playwright |

## 5. 애플리케이션 상태 모델

Suora 는 `src/store/appStore.ts` 의 단일 persist Zustand Store 로 워크벤치 전체 상태를 조정합니다.

### 주요 상태 도메인

- 세션과 채팅 탭
- 문서, 폴더, 문서 그룹
- 모델과 provider 설정
- Agent, Agent memory, Agent version, performance stats
- Skill, Skill version, 외부 skill source
- Pipeline 과 실행 메타데이터
- Timer
- Channel, health, users, history, tokens
- 알림
- MCP server 설정과 상태
- theme, locale, font size, accent color 같은 UI 선호값

### 현재 import / export 범위

- 사용자 Agent
- 사용자 Skill
- 모든 세션
- Provider 설정
- 외부 디렉터리 설정

## 6. Model 과 AI 서비스 계층

AI 통합은 `src/services/aiService.ts` 에 있습니다.

### 현재 provider 지원

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
- OpenAI-compatible endpoints

### AI 서비스 책임

- model 설정 검증
- provider identity, API key, base URL 기준 client 초기화와 cache
- network / provider error 분류
- 일반 텍스트 응답 생성
- multi-step tool loop 기반 스트리밍 응답

### 현재 stream event type

- `text-delta`
- `tool-call`
- `tool-result`
- `tool-error`
- `finish-step`
- `usage`
- `error`

## 7. Agent 와 Skill 시스템

### 현재 내장 Agent

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### Agent 모델

현재 `Agent` 타입에는 다음이 포함됩니다.

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

즉 Suora 의 Agent 는 단순한 prompt preset 이 아니라 routing, tool 제한, memory 동작까지 포함합니다.

### Skill 모델

현재 Skill 시스템은 prompt-based capability package 입니다. 현재 지원 범위는 다음과 같습니다.

- 설치된 Skill 목록
- registry 탐색
- source 관리
- `SKILL.md` 편집과 preview
- 단일 skill file import
- skill folder 전체 import
- markdown / zip export
- `SKILL.md` 옆 bundled resource tree 관리

현재 코드 주석과 UI 는 built-in tools 는 tool system 이 제공하고, skills 는 도메인 지식, prompt, resource 를 추가한다는 점을 명확히 합니다.

## 8. Documents, Pipeline, Timer

### Documents

현재 Documents 모듈은 다음을 제공합니다.

- document groups
- nested folders
- markdown documents
- Mermaid rendering
- math rendering
- backlinks 와 references
- document search
- graph view
- chat context 로서의 document selection

### Pipeline

현재 Pipeline 모듈은 다음을 제공합니다.

- multi-step agent workflow
- step retry 와 backoff strategy
- step-level timeout
- `runIf` 조건 실행
- output transform 과 variable export
- total duration, tokens, step count budget
- Mermaid preview 와 source export
- execution history 와 step details
- save, import, export

chat 계층에서도 `/pipeline` 명령으로 list, run, status, history, cancel 을 처리할 수 있습니다.

### Timer

현재 timer type:

- `Once`
- `Interval`
- `Cron`

현재 timer action:

- desktop notification
- agent prompt 실행
- saved pipeline 실행

## 9. Channels 와 MCP

### Channel platform

현재 `ChannelPlatform` 지원 범위는 다음과 같습니다.

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

### 현재 Channel 기능

- webhook / stream transport
- 채널별 reply agent 지정
- auto-reply on / off
- allowed chat list
- message history
- user list
- health panel
- debug panel

### MCP

현재 Integrations 모듈은 다음 MCP 관리 기능을 제공합니다.

- server configuration
- connection status tracking
- agent 실행 경로에 MCP capability 통합

## 10. IPC 와 보안 모델

Suora 는 Electron context isolation 을 유지하고 preload bridge 를 통해 특권 작업을 전달합니다.

### 현재 주요 보안 특성

- renderer 는 Node.js API 를 직접 호출하지 않음
- preload 는 allowlist invoke/on/send surface 만 노출함
- secure storage 실패는 UI warning 으로 표시됨
- filesystem access 는 sandbox mode 로 제한 가능
- allowed directory list 설정 가능
- 위험한 shell pattern 차단 가능
- tool 실행 전 confirmation 요구 가능

### Secure Storage 현재 동작

API key 는 먼저 OS secure storage 에 저장을 시도합니다. secure storage 를 사용할 수 없거나 암호화에 실패하면 key 는 메모리에만 남고 재시작 후 다시 입력해야 한다는 경고가 UI 에 표시됩니다.

## 11. UI 테마, 국제화, 빌드, 테스트

### 테마와 선호값

renderer 는 `src/index.css` 의 token theme system 과 `useTheme` 같은 hook 을 사용합니다. 현재 지원하는 설정 축은 다음과 같습니다.

- light / dark / system theme
- font size
- code font
- accent color
- locale

현재 기본 theme mode 는 `system` 입니다.

### 현재 locale

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

### 자주 쓰는 개발 명령

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

### 현재 확인 가능한 테스트 범위

- Electron preload behavior
- storage utilities
- onboarding UI
- skill editor behavior
- marketplace / skill registry flows
- theme hooks
- database helpers
- Playwright smoke path

## 12. 유지보수 메모

이 저장소에서 기술 문서를 갱신할 때는 과거 설계 문구보다 구현된 사실을 우선해야 합니다. 특히 아래 파일을 직접 기준점으로 삼는 것이 안전합니다.

- `src/App.tsx` 의 실제 라우트
- `src/store/appStore.ts` 의 실제 내장 Agent
- `src/services/aiService.ts` 의 실제 provider type
- `src/components/settings/SettingsLayout.tsx` 의 실제 설정 섹션

코드를 막 확인하지 않았다면 IPC 채널 수, tool 총 개수처럼 쉽게 drift 하는 숫자는 문서에 고정하지 않는 편이 안전합니다.