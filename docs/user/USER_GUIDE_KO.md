# Suora 사용자 가이드

이 가이드는 현재 코드 구현을 기준으로 작성되었습니다. 오래된 계획이나 예전 문서가 아니라, 지금 Suora가 실제로 할 수 있는 일을 설명합니다.

## 1. Suora란 무엇인가

Suora는 로컬 AI 워크벤치입니다. 현재 앱은 단순한 채팅 창이 아니라 Chat, Documents, Models, Agents, Skills, Pipeline, Timer, Channels, MCP, Settings 로 구성된 데스크톱 작업 공간입니다.

Suora로 할 수 있는 일은 다음과 같습니다.

- 여러 모델을 사용한 일상 대화와 작업 실행
- 코드, 글쓰기, 리서치, 보안, 데이터, DevOps 에 특화된 Agent 에게 작업 위임
- 로컬 문서 공간을 유지하고 그 문서 맥락을 채팅에 연결
- 여러 단계의 Agent 파이프라인을 만들고 수동 또는 예약 실행
- 외부 메시징 플랫폼을 연결해 데스크톱 도우미가 수신 메시지에 응답하도록 구성

## 2. 설치와 첫 실행

### 요구 사항

- Windows, macOS, Linux 데스크톱 환경
- 소스 실행 시 Node.js 18+
- npm

### 소스에서 실행

```bash
npm install
npm run dev
```

### 온보딩

첫 실행 시 Suora는 5단계 온보딩을 표시합니다.

1. Welcome
2. Configure a Model Provider
3. Meet Your Agents
4. Explore Skills
5. You're All Set

건너뛴 경우에도 `Settings -> System` 에서 다시 실행할 수 있습니다.

## 3. 워크벤치 구성

| 모듈 | 현재 용도 |
| --- | --- |
| Chat | 다중 세션 채팅, Agent / Model 전환, 첨부파일, 도구 호출 확인 |
| Documents | 로컬 문서 그룹, 폴더, 백링크, 그래프 보기 |
| Pipeline | 다단계 Agent 워크플로 설계 및 실행 |
| Models | Provider 설정, 모델 활성화, 연결 테스트, 비교 |
| Agents | 내장 / 사용자 Agent 관리, 테스트, 가져오기 / 내보내기, 버전 관리 |
| Skills | 설치된 Skill, 레지스트리 탐색, `SKILL.md` 편집 |
| Timer | 일회성, 간격, Cron 스케줄 |
| Channels | 메시징 통합 및 응답 라우팅 |
| MCP | Model Context Protocol 서버 설정 |
| Settings | 환경설정, 보안, 데이터, 로그, 진단 |

## 4. 채팅 워크플로

현재 채팅 기능에는 다음이 포함됩니다.

- 여러 세션과 탭
- 세션별 Agent 와 Model 선택
- 이미지, 파일, 오디오 첨부
- 스트리밍 응답
- Markdown, 코드 블록, 수식 표시
- 도구 호출 상태 표시
- 실패한 응답 다시 시도
- 메시지 편집, 삭제, 고정, 분기
- 응답 피드백
- 응답 읽어주기
- 인라인 인용

### 현재 동작하는 단축키

- `Ctrl/Cmd + K`: 명령 팔레트 열기
- `Enter`: 메시지 전송
- `Shift + Enter`: 입력창 줄바꿈
- `Escape`: 명령 팔레트 또는 대화상자 닫기
- `Ctrl/Cmd + S`: 문서 편집기에서 저장

### 명령 팔레트

명령 팔레트에서 바로 이동할 수 있는 대상은 다음과 같습니다.

- 세션
- 문서
- Agent
- Skill
- Model
- Settings
- Channels
- Timer
- MCP
- Pipeline

## 5. Models 와 Provider

현재 Provider 계층은 다음을 지원합니다.

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
- OpenAI 호환 엔드포인트

### Models 모듈에서 현재 가능한 작업

- 새 Provider 설정 추가
- Provider preset 사용
- API Key 와 사용자 Base URL 입력
- 연결 테스트
- 개별 모델 활성화 / 비활성화
- 모델별 `temperature`, `maxTokens` 조정
- 활성 모델 목록 보기
- Compare 보기에서 모델 비교

Ollama 를 사용할 경우 기본 로컬 엔드포인트는 `http://localhost:11434/v1` 입니다.

## 6. Agents 와 Skills

### 내장 Agent

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### 사용자 Agent 기능

현재 Agent 편집기는 다음을 지원합니다.

- 이름, 아바타, 색상, 시스템 프롬프트
- Model 바인딩
- Skill 할당
- 온도, 최대 턴 수, 응답 스타일
- 허용 / 차단 도구 목록
- Auto-learn
- 가져오기, 내보내기, 복제
- 버전 스냅샷과 복원
- Agent 모듈 내부 테스트 채팅

### Skills 모듈 기능

현재 Skill 흐름은 다음을 지원합니다.

- 설치된 Skill 보기
- Skill 활성화 / 비활성화
- `SKILL.md` 편집
- 레지스트리 Skill 탐색
- 설치 전 미리보기
- Skill 소스 추가 및 관리
- 단일 Skill 파일 가져오기
- 전체 Skill 폴더 가져오기
- markdown 또는 zip 으로 Skill 내보내기

Skill 은 워크스페이스와 외부 디렉터리에서 자동 로드할 수도 있습니다.

## 7. Documents, Pipeline, Timer

### Documents

Documents 모듈은 현재 다음을 지원합니다.

- 문서 그룹
- 중첩 폴더
- Markdown 문서
- Mermaid 다이어그램
- 수식 블록
- 문서 검색
- 백링크와 참조
- 그래프 보기
- 선택 문서를 채팅 컨텍스트로 사용

### Pipeline

Pipeline 모듈은 현재 다음을 지원합니다.

- 다단계 Agent 워크플로
- 단계별 재시도와 백오프 전략
- 단계별 타임아웃
- `runIf` 조건 실행
- 출력 변환과 변수 내보내기
- 총 실행 시간, 총 토큰, 단계 수에 대한 예산 제한
- Mermaid 미리보기와 원본 내보내기
- 실행 이력과 단계 상세 보기
- 저장, 가져오기, 내보내기

채팅에서는 `/pipeline` 명령도 지원합니다.

- `/pipeline list`
- `/pipeline run <name-or-id>`
- `/pipeline status`
- `/pipeline history <name-or-id>`
- `/pipeline cancel`

### Timer

현재 Timer 유형은 다음과 같습니다.

- Once
- Interval
- Cron

현재 Timer 동작은 다음과 같습니다.

- 데스크톱 알림
- Agent Prompt 실행
- 저장된 Pipeline 실행

## 8. Channels 와 MCP

### 지원되는 Channel 플랫폼

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

### Channels 모듈에서 현재 가능한 작업

- webhook 또는 stream 전송 방식
- 채널별 응답 Agent 지정
- 자동 응답 켜기 / 끄기
- 허용 채팅 목록
- 메시지 이력
- 사용자 목록
- 상태 보기
- 디버그 보기

### MCP

MCP 모듈은 현재 다음 용도로 사용됩니다.

- 서버 설정 추가
- 서버 설정 편집
- 연결 상태 확인
- Agent 에 MCP 기능 노출

## 9. 설정, 보안, 데이터

현재 설정 섹션은 다음과 같습니다.

- General
- Security
- Voice
- Shortcuts
- Data
- Logs
- System

### 현재 중요한 설정 기능

- 테마, 언어, 폰트, 강조 색상
- 자동 시작
- 프록시 설정
- SMTP 메일 설정과 연결 테스트
- 환경 변수 관리
- 도구 실행 확인 정책
- 파일 시스템 샌드박스
- 허용 디렉터리 목록
- 차단된 shell 패턴
- 음성 설정
- 단축키 매핑 관리
- 가져오기 / 내보내기
- 기록 보존 정책
- 로그와 크래시 기록
- 런타임 메트릭
- 온보딩 다시 실행

### API Key 와 안전 저장소

현재 구현은 먼저 운영체제의 안전 저장소에 API Key 를 저장하려고 시도합니다.

시스템 keyring 을 사용할 수 없거나 암호화에 실패하면 Suora 는 다음을 경고합니다.

- 키는 메모리에만 유지됨
- 재시작 후 다시 입력해야 함

### 현재 내보내기에 포함되는 항목

- 사용자 Agent
- 사용자 Skill
- 모든 세션
- Provider 설정
- 외부 디렉터리 설정

## 10. 문제 해결

### Model 연결 실패

다음 순서로 확인하세요.

1. API Key 가 유효한지
2. Base URL 이 Provider 와 일치하는지
3. 최소 하나의 모델이 활성화되어 있는지
4. 프록시가 요청을 막고 있지 않은지
5. Models 화면의 연결 테스트가 성공하는지

### Channel 에서 메시지를 받지 못함

다음 순서로 확인하세요.

1. Channel 이 활성화되어 있는지
2. 응답 Agent 가 존재하고 활성화되어 있는지
3. webhook Channel 의 경우 로컬 channel server 가 실행 중인지
4. 플랫폼 callback URL 이 Suora 의 URL 과 정확히 일치하는지
5. 현재 채팅이 `allowedChats` 에 의해 차단되지 않는지
6. Health / Debug 화면에 인증 오류가 없는지

### Skill 이 활성화되지 않은 것처럼 보임

다음 순서로 확인하세요.

1. Skill 이 활성화되어 있는지
2. 필요한 Skill 이 Agent 에 할당되어 있는지
3. Skill 이 현재 워크스페이스나 외부 디렉터리에 정상적으로 가져와졌는지
4. 내용이 유효한 `SKILL.md` 인지

### Timer 가 실행되지 않음

다음 순서로 확인하세요.

1. Timer 가 활성화되어 있는지
2. Cron 식이 유효한지
3. 대상 Agent 또는 Pipeline 이 아직 존재하는지
4. 데스크톱 앱이 실행 중인지

## 11. 추천 시작 순서

현재 빌드를 처음 사용할 때는 다음 순서가 좋습니다.

1. `Models` 에서 Provider 를 추가하고 Model 을 활성화하기
2. `Agents` 에서 내장 Agent 를 확인하기
3. `Chat` 에서 첫 대화를 시작하기
4. `Documents` 에서 문서 그룹 만들기
5. `Pipeline` 에서 2~3단계 워크플로 저장하기
6. `Timer` 에서 이를 예약하기
7. 로컬 흐름이 안정된 뒤 `Channels` 또는 `MCP` 를 설정하기