# Suora ユーザーガイド

このガイドは現在の実装コードに基づいています。古い計画や過去の文書ではなく、Suora が今できることを説明します。

## 1. Suora とは

Suora はローカル AI ワークベンチです。現在のアプリは単なるチャット画面ではなく、Chat、Documents、Models、Agents、Skills、Pipeline、Timer、Channels、MCP、Settings から成るデスクトップ作業環境です。

Suora では次のことができます。

- 複数モデルを使った日常会話やタスク実行
- コード、執筆、調査、セキュリティ、データ、DevOps 向けの専門 Agent への作業委譲
- ローカル文書ワークスペースの管理と、その文書コンテキストをチャットへ取り込み
- 複数ステップの Agent パイプラインを作成し、手動またはスケジュールで実行
- 外部メッセージングプラットフォームを接続し、デスクトップアシスタントが受信メッセージに応答

## 2. インストールと初回起動

### 要件

- Windows、macOS、Linux のデスクトップ環境
- ソースから実行する場合は Node.js 18+
- npm

### ソースから起動

```bash
npm install
npm run dev
```

### オンボーディング

初回起動時、Suora は 5 ステップのセットアップを表示します。

1. Welcome
2. Configure a Model Provider
3. Meet Your Agents
4. Explore Skills
5. You're All Set

スキップした場合でも、`Settings -> System` から再実行できます。

## 3. ワークベンチの構成

| モジュール | 現在の用途 |
| --- | --- |
| Chat | 複数セッションの会話、Agent / Model 切り替え、添付ファイル、ツール呼び出し確認 |
| Documents | ローカル文書グループ、フォルダー、バックリンク、グラフ表示 |
| Pipeline | 複数ステップの Agent ワークフロー設計と実行 |
| Models | Provider 設定、Model 有効化、接続テスト、比較 |
| Agents | 組み込み / カスタム Agent の管理、テスト、インポート / エクスポート、バージョン管理 |
| Skills | インストール済み Skill、レジストリ参照、`SKILL.md` 編集 |
| Timer | 単発、間隔、Cron スケジュール |
| Channels | メッセージング統合と返信ルーティング |
| MCP | Model Context Protocol サーバー設定 |
| Settings | 設定、セキュリティ、データ、ログ、診断 |

## 4. チャットの使い方

現在のチャット機能には次が含まれます。

- 複数セッションとタブ
- セッションごとの Agent と Model 選択
- 画像、ファイル、音声の添付
- ストリーミング応答
- Markdown、コードブロック、数式表示
- ツール呼び出しの状態表示
- 失敗した応答の再試行
- メッセージの編集、削除、ピン留め、分岐
- アシスタント応答へのフィードバック
- アシスタント応答の読み上げ
- インライン引用

### 現在使えるショートカット

- `Ctrl/Cmd + K`: コマンドパレットを開く
- `Enter`: メッセージ送信
- `Shift + Enter`: 入力欄で改行
- `Escape`: コマンドパレットやダイアログを閉じる
- `Ctrl/Cmd + S`: 文書エディターで保存

### コマンドパレット

コマンドパレットから次へ直接移動できます。

- セッション
- 文書
- Agent
- Skill
- Model
- 設定
- Channels
- Timer
- MCP
- Pipeline

## 5. Models と Provider

現在の Provider レイヤーは次をサポートします。

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
- OpenAI 互換エンドポイント

### Models モジュールで現在できること

- Provider 設定の追加
- Provider プリセットの利用
- API Key とカスタム Base URL の入力
- 接続テスト
- 個別 Model の有効 / 無効切り替え
- Model ごとの `temperature` と `maxTokens` 調整
- 有効化済み Model 一覧の表示
- Compare ビューでの Model 比較

Ollama を使う場合、既定のローカルエンドポイントは `http://localhost:11434/v1` です。

## 6. Agents と Skills

### 組み込み Agent

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### カスタム Agent の機能

現在の Agent エディターでは次を設定できます。

- 名前、アバター、色、システムプロンプト
- Model の割り当て
- Skill の割り当て
- 温度、最大ターン数、応答スタイル
- 許可 / 禁止ツール一覧
- Auto-learn
- インポート、エクスポート、複製
- バージョンスナップショットと復元
- Agent モジュール内のテストチャット

### Skills モジュールの機能

現在の Skill フローでは次をサポートします。

- インストール済み Skill の表示
- Skill の有効 / 無効切り替え
- `SKILL.md` の編集
- レジストリ Skill の参照
- インストール前のプレビュー
- Skill ソースの追加と管理
- 単一 Skill ファイルのインポート
- Skill フォルダー全体のインポート
- markdown または zip での Skill エクスポート

Skill はワークスペースや外部ディレクトリから自動読み込みも可能です。

## 7. Documents、Pipeline、Timer

### Documents

Documents モジュールは現在次をサポートします。

- 文書グループ
- ネストされたフォルダー
- Markdown 文書
- Mermaid 図
- 数式ブロック
- 文書検索
- バックリンクと参照
- グラフビュー
- 選択文書をチャット文脈として使用

### Pipeline

Pipeline モジュールは現在次をサポートします。

- 複数ステップの Agent ワークフロー
- ステップ単位の再試行とバックオフ戦略
- ステップごとのタイムアウト
- `runIf` による条件実行
- 出力変換と変数エクスポート
- 総実行時間、総トークン数、ステップ数の予算制限
- Mermaid プレビューとソース出力
- 実行履歴とステップ詳細
- 保存、インポート、エクスポート

チャットでは `/pipeline` コマンドも利用できます。

- `/pipeline list`
- `/pipeline run <name-or-id>`
- `/pipeline status`
- `/pipeline history <name-or-id>`
- `/pipeline cancel`

### Timer

現在の Timer 種類は次のとおりです。

- Once
- Interval
- Cron

現在の Timer アクションは次のとおりです。

- デスクトップ通知
- Agent Prompt 実行
- 保存済み Pipeline 実行

## 8. Channels と MCP

### 対応 Channel プラットフォーム

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

### Channels モジュールで現在できること

- webhook または stream の転送方式
- Channel ごとの返信 Agent 割り当て
- 自動返信のオン / オフ
- 許可チャット一覧
- メッセージ履歴
- ユーザー一覧
- ヘルス表示
- デバッグ表示

### MCP

MCP モジュールは現在次の用途で使います。

- サーバー設定の追加
- サーバー設定の編集
- 接続状態の確認
- Agent へ MCP 能力を公開

## 9. 設定、セキュリティ、データ

現在の設定セクションは次のとおりです。

- General
- Security
- Voice
- Shortcuts
- Data
- Logs
- System

### 現在重要な設定項目

- テーマ、言語、フォント、アクセント色
- 自動起動
- プロキシ設定
- SMTP メール設定と接続テスト
- 環境変数管理
- ツール実行確認ポリシー
- ファイルシステムサンドボックス
- 許可ディレクトリ一覧
- ブロックされた shell パターン
- 音声設定
- ショートカット管理
- インポート / エクスポート
- 履歴保持ポリシー
- ログとクラッシュ履歴
- ランタイムメトリクス
- オンボーディング再実行

### API Key と安全な保存

現在の実装では、API Key はまず OS の安全な保存領域へ保存しようとします。

システムの keyring が利用できない、または暗号化に失敗した場合、Suora は次を通知します。

- Key はメモリにのみ保持される
- 再起動後に再入力が必要

### 現在のエクスポート内容

- カスタム Agent
- カスタム Skill
- すべてのセッション
- Provider 設定
- 外部ディレクトリ設定

## 10. トラブルシューティング

### Model 接続に失敗する

次の順で確認してください。

1. API Key が正しい
2. Base URL が Provider と一致している
3. 1 つ以上の Model が有効になっている
4. プロキシ設定が通信を妨げていない
5. Models ビューの接続テストが成功する

### Channel がメッセージを受信しない

次の順で確認してください。

1. Channel が有効になっている
2. 返信 Agent が存在し有効である
3. webhook Channel ではローカル channel server が起動している
4. プラットフォーム側 callback URL が Suora の URL と完全一致している
5. 現在のチャットが `allowedChats` でブロックされていない
6. Health / Debug に認証エラーが出ていない

### Skill が有効に見えない

次の順で確認してください。

1. Skill が有効である
2. 必要な Skill が Agent に割り当てられている
3. Skill が現在のワークスペースまたは外部ディレクトリへ正しく取り込まれている
4. 内容が有効な `SKILL.md` である

### Timer が動かない

次の順で確認してください。

1. Timer が有効である
2. Cron 式が有効である
3. 対象 Agent または Pipeline が存在している
4. デスクトップアプリが起動中である

## 11. 最初に試す流れ

現在のビルドを初めて使う場合は、次の順番がおすすめです。

1. `Models` で Provider を追加し、Model を有効化する
2. `Agents` で組み込み Agent を確認する
3. `Chat` で最初の会話を始める
4. `Documents` で文書グループを作る
5. `Pipeline` で 2 〜 3 ステップのワークフローを保存する
6. `Timer` でそれをスケジュールする
7. ローカルの流れが安定してから `Channels` や `MCP` を設定する