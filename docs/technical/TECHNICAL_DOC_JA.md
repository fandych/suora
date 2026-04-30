# Suora 技術ドキュメント

この文書は現在のリポジトリ実装に基づく技術参照です。貢献者と保守担当者向けに、コードと一致した構成だけを記載します。

## 1. システム概要

Suora は Electron ベースのローカル AI ワークベンチです。現在の主要モジュールは次のとおりです。

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

アプリはローカル優先で設計されており、ユーザー状態、会話、文書ツリー、Agent 設定、Model 設定、各種実行メタデータは IPC 経由の永続化レイヤーに保存されます。

## 2. 実行時アーキテクチャ

実行時は 3 層に分かれます。

| 層 | 役割 |
| --- | --- |
| Electron Main Process | ファイルシステム、ネットワーク取得補助、Secure Storage、Shell、Channel ランタイム、IPC handler を担当 |
| Preload Bridge | context isolation 下で allowlist 型の `window.electron` API を公開 |
| React Renderer | ワークベンチ UI を描画し、Zustand で状態を管理し、AI・文書・Pipeline・Channel・設定を編成 |

レンダラーは Hash Router を使い、各機能モジュールを lazy load します。

### 現在のトップレベルルート

| ルート | モジュール |
| --- | --- |
| `/chat` | チャットワークベンチ |
| `/documents` | 文書ワークベンチ |
| `/pipeline` | Agent Pipeline 編集と実行履歴 |
| `/models/:view` | Provider、Model、比較ビュー |
| `/agents` | Agent 管理 |
| `/skills/:view` | インストール済み、参照、Source 管理 |
| `/timer` | Timer とスケジュール管理 |
| `/channels` | メッセージング統合 |
| `/mcp` | Integrations と MCP 設定 |
| `/settings/:section` | 設定セクション |

### 現在の設定セクション

- `general`
- `security`
- `voice`
- `shortcuts`
- `data`
- `logs`
- `system`

## 3. リポジトリ構成

現在の構成は Electron シェルと機能別に整理された React アプリを中心にしています。

```text
electron/
  main.ts          Electron main process と IPC handlers
  preload.ts       context-isolated preload bridge
  channelService.ts
  database.ts

src/
  App.tsx          ルーター初期化とグローバル初期化
  main.tsx         renderer entry
  index.css        グローバルテーマ token と UI スタイル
  components/      機能モジュールと共有 UI
  hooks/           React hooks
  services/        AI、storage、i18n、pipeline、channel、documents
  store/           Zustand store と slices
  types/           共有型定義

docs/
  user/            ユーザー向け文書
  technical/       技術参照文書

e2e/
  Playwright E2E テスト
```

## 4. 技術スタック

| 領域 | 技術 |
| --- | --- |
| デスクトップシェル | Electron 41 |
| フロントエンド | React 19 |
| ビルド | Vite 6 + electron-vite 5 |
| スタイル | Tailwind CSS 4 |
| 状態管理 | Zustand 5 |
| 言語 | TypeScript 5.8 |
| AI ランタイム | Vercel AI SDK 6 |
| 単体テスト | Vitest |
| E2E テスト | Playwright |

## 5. アプリケーション状態モデル

Suora は `src/store/appStore.ts` の単一 persist 済み Zustand Store を使ってワークベンチ全体の状態を管理します。

### 主要な状態ドメイン

- 会話セッションとチャットタブ
- 文書、フォルダー、文書グループ
- Model と provider 設定
- Agent、Agent memory、Agent versions、performance stats
- Skill、Skill versions、外部 skill source
- Pipeline と実行メタデータ
- Timer
- Channel、health、users、history、tokens
- 通知
- MCP server 設定と状態
- theme、locale、font size、accent color などの UI 設定

### 現在のインポート / エクスポート対象

- カスタム Agent
- カスタム Skill
- すべてのセッション
- Provider 設定
- 外部ディレクトリ設定

## 6. Model と AI サービス層

AI 統合は `src/services/aiService.ts` にあります。

### 現在の provider 対応

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

### AI サービスの役割

- model 設定の検証
- provider identity、API key、base URL 単位での client 初期化と cache
- network / provider error の分類
- 通常のテキスト応答生成
- multi-step tool loop でのストリーミング応答

### 現在の stream event type

- `text-delta`
- `tool-call`
- `tool-result`
- `tool-error`
- `finish-step`
- `usage`
- `error`

## 7. Agent と Skill システム

### 現在の組み込み Agent

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### Agent モデル

現在の `Agent` 型には次が含まれます。

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

つまり Suora の Agent は単なる prompt preset ではなく、routing、tool 制御、memory 振る舞いも持ちます。

### Skill モデル

現在の Skill システムは prompt-based capability package です。現在サポートされる内容は次のとおりです。

- インストール済み Skill 一覧
- registry 参照
- source 管理
- `SKILL.md` 編集と preview
- 単一 skill file の import
- skill folder 全体の import
- markdown / zip export
- `SKILL.md` と同梱 resource tree の管理

現在のコードコメントと UI は、built-in tools は tool system 側が提供し、skills は専門知識、prompt、resource を追加するという構造を示しています。

## 8. Documents、Pipeline、Timer

### Documents

現在の Documents モジュールは次を備えます。

- document groups
- nested folders
- markdown documents
- Mermaid rendering
- math rendering
- backlinks と references
- document search
- graph view
- chat context としての document selection

### Pipeline

現在の Pipeline モジュールは次を備えます。

- multi-step agent workflow
- step retry と backoff strategy
- step-level timeout
- `runIf` 条件実行
- output transform と variable export
- total duration、tokens、step count の budget 制御
- Mermaid preview と source export
- execution history と step details
- save、import、export

chat 層でも `/pipeline` コマンドで list、run、status、history、cancel を扱えます。

### Timer

現在の timer type：

- `Once`
- `Interval`
- `Cron`

現在の timer action：

- desktop notification
- agent prompt 実行
- saved pipeline 実行

## 9. Channels と MCP

### Channel platform

現在の `ChannelPlatform` は次をサポートします。

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

### Channel の現在機能

- webhook / stream transport
- channel ごとの reply agent 設定
- auto-reply の有効 / 無効
- allowed chat list
- message history
- user list
- health panel
- debug panel

### MCP

現在の Integrations モジュールは次の MCP 管理を提供します。

- server configuration
- connection status tracking
- agent 実行への MCP capability 統合

## 10. IPC とセキュリティモデル

Suora は Electron の context isolation を維持し、特権操作を preload bridge 経由で中継します。

### 現在の主要セキュリティ特性

- renderer は Node.js API を直接呼ばない
- preload は allowlist の invoke/on/send surface のみ公開する
- secure storage failure は UI warning として可視化される
- filesystem access は sandbox 化できる
- allowed directory list を設定できる
- 危険な shell pattern をブロックできる
- tool 実行前に confirmation を要求できる

### Secure Storage の現在動作

API key はまず OS の secure storage へ保存を試みます。secure storage が使えない、または暗号化に失敗した場合、keys はメモリにのみ保持され、再起動後に再入力が必要であると UI が警告します。

## 11. UI テーマ、国際化、ビルド、テスト

### テーマと設定

renderer は `src/index.css` の token theme system と `useTheme` などの hook を使います。現在サポートされる設定軸は次のとおりです。

- light / dark / system theme
- font size
- code font
- accent color
- locale

現在の既定 theme mode は `system` です。

### 現在の locale

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

### よく使う開発コマンド

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

### 現在確認できるテスト対象

- Electron preload behavior
- storage utilities
- onboarding UI
- skill editor behavior
- marketplace / skill registry flows
- theme hooks
- database helpers
- Playwright smoke path

## 12. 保守上の注意

このリポジトリで技術文書を更新する場合は、履歴上の構想ではなく、実装済みの事実を優先してください。特に次を直接確認するのが安全です。

- `src/App.tsx` の実ルート
- `src/store/appStore.ts` の組み込み Agent
- `src/services/aiService.ts` の provider type
- `src/components/settings/SettingsLayout.tsx` の設定セクション

コードを確認していない限り、IPC channel 数や tool 総数のようなドリフトしやすい数字を文書に固定しない方が安全です。