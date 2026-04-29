# Suora �?技術ドキュメン�?

> マルチモデル対応、インテリジェントエージェント、スキルシステム、メモリ管理、プラグインアーキテクチャを備え�?Electron ベースのインテリジェントデスクトップアプリケーション�?

## 目次

1. [アーキテクチャ概要](#1-アーキテクチャ概�?
2. [プロジェクト構成](#2-プロジェクト構成)
3. [技術スタック](#3-技術スタッ�?
4. [ビルドシステム](#4-ビルドシステ�?
5. [状態管理](#5-状態管理)
6. [AI サービスレイヤー](#6-ai-サービスレイヤー)
7. [スキル／ツールシステム](#7-スキルツールシステム)
8. [国際化システム](#8-国際化システ�?
9. [メモリシステム](#9-メモリシステ�?
10. [IPC 通信](#10-ipc-通信)
11. [セキュリティアーキテクチャ](#11-セキュリティアーキテクチ�?
12. [プラグインシステム](#12-プラグインシステ�?
13. [チャネル統合](#13-チャネル統合)
14. [テスト](#14-テス�?
15. [CI/CD とリリース](#15-cicd-とリリー�?
16. [開発ガイド](#16-開発ガイ�?
17. [API リファレンス](#17-api-リファレンス)

---

## 1. アーキテクチャ概�?

```
┌───────────────────────────────────────────────────────�?
�?                  Electron Shell                      �?
�?                                                      �?
�? ┌─────────────�? IPC�?8 チャネル�?┌────────────�? �?
�? │メインプロセス │◄───────────────────►│ レンダラー   �? �?
�? �?(Node.js)   �? preload ブリッジ    �?(React 19)  �? �?
�? �?            �?                     �?            �? �?
�? │�?IPC ハンドラ�?                     │�?Zustand 5  �? �?
�? │�?ファイル I/O�?                     │�?AI SDK 6   �? �?
�? │�?Shell 実行 �?                     │�?ツー�?     �? �?
�? │�?SMTP メール│                      │�?ルーター    �? �?
�? │�?ロガ�?    �?                     │�?Tailwind 4 �? �?
�? └─────────────�?                     └────────────�? �?
�?       �? contextIsolation: true            �?        �?
�?       └──────── Preload (preload.ts) ──────�?        �?
�?             window.electron.invoke/on/send            �?
└───────────────────────────────────────────────────────�?
```

- **メインプロセ�?* (`electron/main.ts`) �?`BrowserWindow` を所有し、IPC ハンドラを介して OS レベルの全操作（ファイルシステム、Shell、クリップボード、SMTP、タイマー、ブラウザ自動化）を処理します�?
- **プリロードスクリプト** (`electron/preload.ts`) �?分離されたコンテキストで、`contextBridge.exposeInMainWorld('electron', ...)` を通じ�?68 �?IPC チャネルのホワイトリストを公開します�?
- **レンダラー** (`src/`) �?Vite 6 でバンドルされた React 19 シングルページアプリケーション。Zustand 5 による状態管理、Vercel AI SDK 6 によ�?AI 統合、プリロードブリッジを通じ�?OS アクセスを提供します�?

---

## 2. プロジェクト構成

```
src/
├── App.tsx                  # React Router�? ルート）
├── index.css                # Tailwind @theme トークン（ダーク/ライト）
├── store/appStore.ts        # Zustand グローバル状態（バージョ�?18�?
├── services/
�?  ├── aiService.ts         # マルチプロバイダ�?AI 統合
�?  ├── tools.ts             # 18 スキルカテゴリ�?2 以上のツール
�?  ├── i18n.ts              # 10 言語翻訳（�?910 キー�?
�?  ├── fileStorage.ts       # IPC ベースの JSON 永続�?+ キャッシ�?
�?  ├── voiceInteraction.ts  # Web Speech API（音声認�?音声合成�?
�?  └── logger.ts            # レンダラー �?メインプロセスへのログ転�?
├── hooks/
�?  ├── useI18n.ts           # 翻訳フッ�?
�?  └── useTheme.ts          # テー�?アクセントカラー/フォントフッ�?
├── components/              # 機能別に整理され�?React コンポーネン�?
├── types/index.ts           # 共有 TypeScript インターフェース
└── test/setup.ts            # Vitest セットアップ

electron/
├── main.ts                  # メインプロセス、IPC ハンドラ、SMTP、アップデーター
├── preload.ts               # コンテキスト分離ブリッジ�?8 チャネル�?
└── logger.ts                # RotatingLogger（~/.suora/logs�?
```

**ビルド出力：** `out/main/`（ESM）�?`out/preload/`（CJS）�?`out/renderer/`（SPA）�?`dist/`（インストーラー�?

---

## 3. 技術スタッ�?

| レイヤー | 技�?| バージョ�?|
|---------|------|-----------|
| デスクトップ | Electron | 41.x |
| フロントエン�?| React | 19.2 |
| バンドラ�?| Vite + electron-vite | 6.0 + 5.0 |
| スタイリング | Tailwind CSS | 4.2 |
| 状態管理 | Zustand | 5.0 |
| AI SDK | Vercel AI SDK (`ai`) | 6.0 |
| 言�?| TypeScript | 5.8+ |
| ルーター | React Router | 7.x |
| バリデーショ�?| Zod | 4.x |
| メー�?| nodemailer | 8.x |
| HTTP/WS | Express 5 + ws 8 | �?|
| パッケージン�?| electron-builder | 26.x |
| テス�?| Vitest 4.x + Playwright 1.58 | �?|

**AI プロバイダーパッケージ�?* `@ai-sdk/anthropic`、`@ai-sdk/openai`、`@ai-sdk/google-vertex`、`@ai-sdk/openai-compatible`（Ollama、DeepSeek、Groq、Together、Fireworks、Perplexity、Cohere、Zhipu、MiniMax、およびカスタムエンドポイント向け）�?

---

## 4. ビルドシステ�?

`electron.vite.config.ts` �?3 つのビルドターゲットが定義されています：

| ターゲッ�?| エントリ�?| 出力 | フォーマット |
|-----------|-----------|------|-------------|
| Main | `electron/main.ts` | `out/main/` | ESM |
| Preload | `electron/preload.ts` | `out/preload/` | CJS |
| Renderer | `index.html` | `out/renderer/` | SPA |

レンダラー�?`@vitejs/plugin-react` + `@tailwindcss/vite` を使用し、パスエイリアス `@` �?`./src` が設定され、開発サーバーは `127.0.0.1:5173`（厳密なポート）で動作します�?

| コマンド | 説明 |
|---------|------|
| `npm run dev` | Electron + Vite 開発サーバー（ホットモジュールリプレースメント（HMR）付き） |
| `npm run build` | 本番ビルド（3 つの全ターゲット�?|
| `npm run package` | ビル�?+ electron-builder パッケージング（NSIS/DMG/AppImage�?|

**electron-builder ターゲット：** Windows（NSIS + ポータブル）、macOS（DMG + ZIP）、Linux（AppImage + DEB + RPM）�?

---

## 5. 状態管理

IPC ファイルストレージをバックエンドとす�?`persist` ミドルウェアを持つ単一�?Zustand ストア�?

**ストア名�?* `suora-store` · **バージョン：** 18 · **バックエンド�?* `{workspace}/`

### 主要な状態スライ�?

| スライス | 主要フィール�?|
|---------|---------------|
| セッショ�?| `sessions`、`activeSessionId`、`openSessionTabs` |
| エージェント | `agents`、`selectedAgent`、`agentPerformance`、`agentVersions` |
| モデ�?| `providerConfigs`、`globalModels`、`modelUsageStats` |
| スキ�?| `skills`、`pluginTools`、`skillVersions` |
| メモ�?| `globalMemories` |
| セキュリティ | `toolSecurity`（許可ディレクトリ、ブロックコマンド、確認） |
| 外観 | `theme`、`fontSize`、`codeFont`、`accentColor`、`bubbleStyle`、`locale` |
| チャネル | `channelConfigs`、`channelMessages`、`channelTokens`、`channelHealth` |
| プラグイ�?| `installedPlugins` |
| メー�?| `emailConfig`（SMTP�?|

### 永続化フロー

```
Zustand �?fileStateStorage アダプタ�?�?IPC (db:loadPersistedStore / db:savePersistedStore) �?{workspace}/{settings,models}.json + sessions/, agents/, channels/, …
```

インメモ�?`Map` キャッシュにより `readCached()`/`writeCached()` を介した同期読み取りが可能です。初回ロード時、アダプターはファイルストレージを確認し、`localStorage`（マイグレーション）にフォールバックしてからキャッシュします�?

### マイグレーション（バージョン 1 �?18�?

v2：エージェントメモリ、スキルツー�?· v3：`toolSecurity` のデフォルト�?· v5：`workspacePath` · v7：`providerConfigs` �?Record から Array に移�?· v8：確認をデフォルトで無効�?· v9：`globalMemories`、メモリスコープのバックフィ�?· v10：チャネル、プラグイン、ロケール、エージェント、オンボーディン�?· v11：`pluginTools`、`skillVersions` · v12：`emailConfig`

---

## 6. AI サービスレイヤー

プロバイダーインスタンスは `${providerId}:${apiKey}:${baseUrl}` をキーとしてキャッシュされます�?

### 対応プロバイダー（13 以上�?

Anthropic �?OpenAI はそれぞれのネイティ�?SDK パッケージを使用します。その他すべてのプロバイダーは `@ai-sdk/openai-compatible` を使用し、事前設定されたベー�?URL（Google �?`generativelanguage.googleapis.com`、Ollama �?`localhost:11434/v1`、DeepSeek、Groq、Together、Fireworks、Perplexity、Cohere、Zhipu、MiniMax、またはカスタム）で動作します�?

### 主要関数

```ts
validateModelConfig(model): { valid: boolean; error?: string }
initializeProvider(providerType, apiKey, baseUrl?, providerId?): void
testConnection(providerType, apiKey, baseUrl, modelId): Promise<{ success; error?; latency? }>
generateResponse(modelId, messages, systemPrompt?): Promise<string>
streamResponseWithTools(model, messages, tools, systemPrompt?, maxSteps?): AsyncGenerator<AppStreamEvent[]>
```

### ストリーミングイベン�?

`text-delta` · `tool-call` · `tool-result` · `tool-error` · `finish-step` · `usage` · `error`

ツール呼び出しはマルチステップループで実行されます（デフォルト最�?20 ステップ、`toolChoice: 'auto'`）�?

---

## 7. スキル／ツールシステ�?

### 18 の組み込みスキル

| スキ�?ID | ツール（例） |
|----------|-------------|
| `builtin-filesystem` | `list_dir`、`read_file`、`write_file`、`search_files`、`copy_file`、`move_file`、`stat_file` |
| `builtin-shell` | `shell`（Unix では bash、Windows では PowerShell�?|
| `builtin-web` | `web_search`（DuckDuckGo）、`fetch_webpage` |
| `builtin-utilities` | `get_current_time`、`parse_json`、`generate_uuid` |
| `builtin-todo` | `list_todos`、`add_todo`、`update_todo`、`delete_todo` |
| `builtin-timer` | `list_timers`、`create_timer`、`update_timer`、`delete_timer` |
| `builtin-memory` | `search_memory`、`add_memory` |
| `builtin-browser` | `browser_navigate`、`browser_screenshot`、`browser_evaluate`、`browser_click`、`browser_fill_form` |
| `builtin-agent-comm` | `send_agent_message`、`broadcast_agent_message` |
| `builtin-event-automation` | `register_event_trigger`、`trigger_event` |
| `builtin-self-evolution` | `create_agent_memory`、`update_skill_description` |
| `builtin-file-attachment` | `analyze_image_attachment`、`save_attachment` |
| `builtin-git` | `git_exec` |
| `builtin-code-analysis` | `analyze_code`、`suggest_refactoring` |
| `builtin-advanced-interaction` | `send_persistent_message`、`request_user_input` |
| `builtin-channels` | `channel_send_message`、`channel_read_message` |
| `builtin-email` | `send_email` |
| `builtin-system-management` | `get_system_info`、`read_clipboard`、`write_clipboard`、`notify`、`take_screenshot` |

### ツール登�?

```ts
import { tool } from 'ai'
import { z } from 'zod'

export const builtinToolDefs: ToolSet = {
  list_dir: tool({
    description: 'List files and directories',
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => { /* IPC 呼び出し */ },
  }),
}
```

関数：`registerTools()`、`getToolsForSkills(skillIds)`、`buildToolSet()`、`getCustomToolsFromSkill()`、`getPluginTools()`�?

スキルはマーケットプレイスからインストールできます（公式またはプライベートレジストリ、ストア�?`marketplace` 設定で制御）�?

---

## 8. 国際化システ�?

**10 言語：** en · zh · ja · ko · fr · de · es · pt · ru · ar（各言語約 910 キー�?

```ts
import { useI18n } from '@/hooks/useI18n'
const { t } = useI18n()
t('chat.send')  // ロケール対応の翻�?
```

**主要な名前空間：** `nav.*`、`chat.*`、`agents.*`、`skills.*`、`models.*`、`settings.*`、`channels.*`、`common.*`、`onboarding.*`

**フォールバックチェーン：** 現在のロケー�?�?英語 �?指定されたフォールバック �?生のキー�?

**言語の追加�?* (1) `AppLocale` 型にコードを追加�?2) `i18n.ts` に翻訳マップを追加�?3) 設定�?UI オプションを追加�?

---

## 9. メモリシステ�?

| レベ�?| スコープ | 制限 | 永続�?|
|-------|---------|------|--------|
| 短期 | セッション単�?| 100 �?| セッションの存続期間のみ |
| 長期 | グローバ�?| 無制�?| ストアの `globalMemories` |
| ベクトル | グローバ�?| 無制�?| `search_memory`/`add_memory` ツー�?|

```ts
interface AgentMemoryEntry {
  id: string; content: string; type: string;     // 'fact'�?preference'�?context'
  scope: 'session' | 'global'; createdAt: number; source?: string;
}
```

`autoLearn: true` が設定されたエージェントは、`builtin-self-evolution` スキルを通じて自動的に事実を永続化します�?

---

## 10. IPC 通信

**67 �?invoke チャネル**（リクエスト-レスポンス）· **1 つの send チャネル**（`app:ready`）�?**6 つの on チャネル**（イベント）

### Preload ブリッジ

```ts
window.electron.invoke(channel, ...args): Promise<unknown>  // ホワイトリスト対象；不明なチャネルはスロ�?
window.electron.on(channel, listener): void                  // ホワイトリスト対象；それ以外は無�?
window.electron.send(channel, ...args): void                 // ホワイトリスト対象；それ以外は無�?
```

### チャネルインデックス

| カテゴリ | チャネル |
|---------|---------|
| ファイルシステム | `fs:listDir`、`fs:readFile`、`fs:readFileRange`、`fs:writeFile`、`fs:deleteFile`、`fs:editFile`、`fs:searchFiles`、`fs:moveFile`、`fs:copyFile`、`fs:stat`、`fs:watch:start`、`fs:watch:stop` |
| Shell | `shell:exec`、`shell:openUrl` |
| Web | `web:search`、`web:fetch` |
| ブラウザ | `browser:navigate`、`browser:screenshot`、`browser:evaluate`、`browser:extractLinks`、`browser:extractText`、`browser:fillForm`、`browser:click` |
| クリップボー�?| `clipboard:read`、`clipboard:write` |
| タイマー | `timer:list`、`timer:create`、`timer:update`、`timer:delete`、`timer:history` |
| スト�?| `db:getSnapshot`、`db:loadPersistedStore`、`db:savePersistedStore`, `db:listEntities`, `db:saveEntity`, `db:deleteEntity` |
| セーフストレージ | `safe-storage:encrypt`、`safe-storage:decrypt`、`safe-storage:isAvailable` |
| システム | `system:getDefaultWorkspacePath`、`system:ensureDirectory`、`system:info`、`system:notify`、`system:screenshot` |
| チャネル | `channel:start/stop/status/register`、`channel:getWebhookUrl`、`channel:sendMessage`、`channel:sendMessageQueued`、`channel:getAccessToken`、`channel:healthCheck`、`channel:debugSend` |
| メー�?| `email:send`、`email:test` |
| アップデータ�?| `updater:check`、`updater:getVersion` |
| ロギング | `log:write` |
| その�?| `app:setAutoStart`、`app:getAutoStart`、`deep-link:getProtocol`、`crash:report/getLogs/clearLogs`、`perf:getMetrics` |

**イベントチャネル�?* `timer:fired`、`channel:message`、`fs:watch:changed`、`app:update`、`updater:available`、`deep-link`

---

## 11. セキュリティアーキテクチ�?

| 対策 | 詳細 |
|------|------|
| `nodeIntegration` | `false` �?レンダラー�?Node.js を使用しない |
| `contextIsolation` | `true` �?分離され�?JavaScript コンテキスト |
| IPC ホワイトリス�?| 68 チャネル；不明なチャネルはスローまたは無�?|
| パス検証 | `ensureAllowedPath()` が厳密なプレフィックスマッチング�?`allowedDirectories` を検�?|
| ブロックコマンド | `ensureCommandAllowed()` �?`rm -rf`、`del /f /q`、`format`、`shutdown` を拒�?|
| 確認 | ツール実行前のオプションのユーザー確�?|
| セーフストレージ | OS キーリング暗号化（DPAPI / Keychain / libsecret）による API キーの保�?|
| スキル整合�?| SHA-256 チェックサム；バージョン履歴（`skillVersions`、最�?500 エントリ�?|
| 監査ログ | `RotatingLogger` �?10 MB/ファイル�? ファイル/日�? 日間保持 |

---

## 12. プラグインシステ�?

```ts
interface PluginInfo {
  id: string; name: string; version: string;
  description: string; enabled: boolean; config: Record<string, unknown>;
}
```

プラグインは `appStore.installedPlugins` に保存され、`pluginTools` マッピング（`Record<string, string[]>` �?プラグイ�?ID �?ツール名）を通じてツールを登録できます。ランタイムでは、`getPluginTools()` がプラグインツールを利用可能なツールセットにマージします�?

**拡張ポイント�?* 新しいツール（`pluginTools` 経由）、新しいスキル（`type: 'marketplace'`）、チャネルコネクタ（`ChannelConfig`）、カスタ�?AI プロバイダー（OpenAI 互換�?`ProviderConfig`）�?

---

## 13. チャネル統合

外部プラットフォーム（Slack、Discord、Telegram、カスタム）は、メインプロセスで実行される Express Webhook サーバーを介して接続します�?

```
プラットフォーム �?HTTP webhook �?メインプロセス（Express）→ channel:message イベント �?レンダラー/AI �?channel:sendMessage �?プラットフォーム
```

```ts
interface ChannelConfig {
  id: string; platform: 'slack' | 'discord' | 'telegram' | 'custom';
  name: string; token?: string; webhookUrl?: string; enabled: boolean;
}
```

ヘルスは `channelHealth` ストアを通じて監視されます。エージェントは `builtin-channels` スキルを使用してプログラム的に対話できます�?

---

## 14. テス�?

### ユニットテスト（Vitest�?

セットアップ：`jsdom` 環境、globals 有効、パター�?`src/**/*.{test,spec}.{ts,tsx}`、カバレッジ閾値（�?8%、関�?5%、ブラン�?5%）�?

```bash
npm run test          # ウォッチモー�?
npm run test:run      # 単発実行
npm run test:coverage # v8 カバレッジ付�?
```

### エンドツーエンドテスト（Playwright�?

セットアップ：Chromium のみ、ベース URL `localhost:5173`、開発サーバー自動起動（120 秒タイムアウト）、ローカルでリトライ 0 �?/ CI �?2 回�?

```bash
npm run test:e2e      # エンドツーエンドテストを実行
npm run test:e2e:ui   # Playwright UI
```

---

## 15. CI/CD とリリー�?

### テストワークフロー（`test.yml`）�?`main`/`develop` へのプッシュまたはプルリクエスト�?

- **Test** ジョブ：lint �?型チェッ�?�?ユニットテス�?�?カバレッジアップロード（Codecov）�?Node 20.x & 22.x、Ubuntu
- **Build** ジョブ：ビル�?�?パッケージン�?�?アーティファクトアップロード�? 日間）�?Ubuntu/Windows/macOS、Node 22.x

### リリースワークフロー（`release.yml`）�?GitHub リリース作成時にトリガー

プラットフォーム別インストーラーをビルドしてアップロード：`.AppImage`/`.deb`/`.rpm`（Linux）、`.exe`/`.msi`（Windows）、`.dmg`/`.zip`（macOS）、および `latest-*.yml` メタデータ�?

**自動アップデーター：** electron-builder GitHub プロバイダー；`updater:check` が起動時に最新リリースを確認します�?

---

## 16. 開発ガイ�?

### セットアップ

```bash
git clone https://github.com/fandych/suora.git && cd suora
npm install
npm run dev    # Electron + HMR
```

### 機能の追�?

1. `src/types/index.ts` で型を定�?
2. `appStore.ts` にステー�?アクションを追加；バージョンをバンプしてマイグレーションを追�?
3. `src/services/` にロジックを実装
4. `src/components/` でコンポーネントを構築；フックは `src/hooks/` に抽�?
5. 必要に応じて `App.tsx` にルートを登�?
6. �?10 言語の i18n キーを追�?

### AI プロバイダーの追加

`aiService.ts �?initializeProvider()` にケースを追加し、SDK ファクトリとデフォルトのベー�?URL を設定、モデルページに UI を追加します。`testConnection()` でテストしてください�?

### ツールの追加

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

ツールが OS アクセスを必要とする場合：`electron/main.ts` �?IPC ハンドラを追加し、`electron/preload.ts` のホワイトリストにチャネルを追加してください�?

### 規約

- すべてのインポートで `@` パスエイリアスを使用 · Node API より `window.electron.invoke()` を優�?· ツール入力に�?Zod スキーマを使�?· 新しいスタイルに�?Tailwind `@theme` トークンを使�?

---

## 17. API リファレンス

### ストアアクション（主要なサブセット）

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

### ファイルストレー�?

```ts
fileStateStorage.getItem(name): Promise<string | null>
fileStateStorage.setItem(name, value): void
fileStateStorage.removeItem(name): void
readCached(name): string | null      // 同期、インメモリキャッシュから読み取�?
writeCached(name, value): void       // キャッシ�?+ 非同�?IPC 保存
```

### IPC ブリッジ（レンダラー側）

```ts
await window.electron.invoke('fs:readFile', path)
await window.electron.invoke('shell:exec', command)
await window.electron.invoke('email:send', { to, subject, body })
window.electron.on('timer:fired', (event, timer) => { ... })
window.electron.on('channel:message', (event, msg) => { ... })
```

### 組み込みエージェント

| エージェント | ID | 主要スキ�?|
|------------|----|-----------| 
| アシスタント | `default-assistant` | �?18 スキ�?|
| コードエキスパー�?| `builtin-code-expert` | git、code-analysis、filesystem、shell |
| ライター | `builtin-writer` | filesystem、web、utilities、memory |
| リサーチャー | `builtin-researcher` | web、browser、filesystem、memory |
| データアナリスト | `builtin-data-analyst` | filesystem、shell、utilities、code-analysis |
| DevOps エンジニ�?| `builtin-devops` | shell、filesystem、system-management、git |
| プロダクトマネージャー | `builtin-product-manager` | web、browser、utilities、channels |
| トランスレーター | `builtin-translator` | web、utilities |
| セキュリティスペシャリス�?| `builtin-security` | filesystem、shell、git、code-analysis |

---

*最終更新：2025*
