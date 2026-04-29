# Suora �?Technische Dokumentation

> Eine intelligente Electron-basierte Desktop-Anwendung mit Multi-Modell-Unterstützung, intelligenten Agenten, Skill-System, Speicherverwaltung und Plugin-Architektur.

## Inhaltsverzeichnis

1. [Architekturübersicht](#1-architekturübersicht)
2. [Projektstruktur](#2-projektstruktur)
3. [Technologie-Stack](#3-technologie-stack)
4. [Build-System](#4-build-system)
5. [Zustandsverwaltung](#5-zustandsverwaltung)
6. [KI-Service-Schicht](#6-ki-service-schicht)
7. [Skill- / Tool-System](#7-skill---tool-system)
8. [Internationalisierungssystem](#8-internationalisierungssystem)
9. [Speichersystem](#9-speichersystem)
10. [IPC-Kommunikation](#10-ipc-kommunikation)
11. [Sicherheitsarchitektur](#11-sicherheitsarchitektur)
12. [Plugin-System](#12-plugin-system)
13. [Kanal-Integration](#13-kanal-integration)
14. [Tests](#14-tests)
15. [CI/CD und Veröffentlichung](#15-cicd-und-veröffentlichung)
16. [Entwicklungshandbuch](#16-entwicklungshandbuch)
17. [API-Referenz](#17-api-referenz)

---

## 1. Architekturübersicht

```
┌───────────────────────────────────────────────────────�?
�?                  Electron Shell                      �?
�?                                                      �?
�? ┌─────────────�? IPC (68 Kanäle)     ┌────────────�? �?
�? │Hauptprozess │◄───────────────────►│  Renderer   �? �?
�? �?(Node.js)   �? Preload-Brücke      �?(React 19)  �? �?
�? �?            �?                     �?            �? �?
�? │�?IPC-Handler�?                     │�?Zustand 5  �? �?
�? │�?Datei-E/A  �?                     │�?AI SDK 6   �? �?
�? │�?Shell-Exec �?                     │�?Tools      �? �?
�? │�?SMTP-Email �?                     │�?Router     �? �?
�? │�?Logger     �?                     │�?Tailwind 4 �? �?
�? └─────────────�?                     └────────────�? �?
�?       �? contextIsolation: true            �?        �?
�?       └──────── Preload (preload.ts) ──────�?        �?
�?             window.electron.invoke/on/send            �?
└───────────────────────────────────────────────────────�?
```

- **Hauptprozess** (`electron/main.ts`) �?besitzt das `BrowserWindow`; verwaltet alle Betriebssystem-Operationen (Dateisystem, Shell, Zwischenablage, SMTP, Timer, Browser-Automatisierung) über IPC-Handler.
- **Preload-Script** (`electron/preload.ts`) �?isolierter Kontext, der eine Whitelist von 68 IPC-Kanälen über `contextBridge.exposeInMainWorld('electron', ...)` bereitstellt.
- **Renderer** (`src/`) �?Einseitige React-19-Anwendung, gebündelt durch Vite 6, Zustand über Zustand 5, KI über Vercel AI SDK 6 und Betriebssystemzugriff über die Preload-Brücke.

---

## 2. Projektstruktur

```
src/
├── App.tsx                  # React Router (8 Routen)
├── index.css                # Tailwind @theme-Token (Dunkel/Hell)
├── store/appStore.ts        # Globaler Zustand mit Zustand (Version 18)
├── services/
�?  ├── aiService.ts         # Multi-Provider-KI-Integration
�?  ├── tools.ts             # 18 Skill-Kategorien, 42+ Tools
�?  ├── i18n.ts              # 10-Sprachen-Übersetzung (~910 Schlüssel)
�?  ├── fileStorage.ts       # IPC-gestützte JSON-Persistenz + Cache
�?  ├── voiceInteraction.ts  # Web Speech API (STT/TTS)
�?  └── logger.ts            # Renderer �?Main Log-Weiterleitung
├── hooks/
�?  ├── useI18n.ts           # Übersetzungs-Hook
�?  └── useTheme.ts          # Theme/Akzent/Schrift-Hook
├── components/              # Feature-organisierte React-Komponenten
├── types/index.ts           # Gemeinsame TypeScript-Interfaces
└── test/setup.ts            # Vitest-Konfiguration

electron/
├── main.ts                  # Hauptprozess, IPC-Handler, SMTP, Updater
├── preload.ts               # Kontextisolierte Brücke (68 Kanäle)
└── logger.ts                # RotatingLogger (~/.suora/logs)
```

**Build-Ausgaben:** `out/main/` (ESM) · `out/preload/` (CJS) · `out/renderer/` (SPA) · `dist/` (Installationsprogramme)

---

## 3. Technologie-Stack

| Schicht | Technologie | Version |
|---------|------------|---------|
| Desktop | Electron | 41.x |
| Frontend | React | 19.2 |
| Bundler | Vite + electron-vite | 6.0 + 5.0 |
| Styling | Tailwind CSS | 4.2 |
| Zustand | Zustand | 5.0 |
| KI-SDK | Vercel AI SDK (`ai`) | 6.0 |
| Sprache | TypeScript | 5.8+ |
| Router | React Router | 7.x |
| Validierung | Zod | 4.x |
| E-Mail | nodemailer | 8.x |
| HTTP/WS | Express 5 + ws 8 | �?|
| Paketierung | electron-builder | 26.x |
| Tests | Vitest 4.x + Playwright 1.58 | �?|

**KI-Provider-Pakete:** `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google-vertex`, `@ai-sdk/openai-compatible` (für Ollama, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, Zhipu, MiniMax und benutzerdefinierte Endpunkte).

---

## 4. Build-System

Drei Build-Ziele definiert in `electron.vite.config.ts`:

| Ziel | Einstiegspunkt | Ausgabe | Format |
|------|---------------|---------|--------|
| Main | `electron/main.ts` | `out/main/` | ESM |
| Preload | `electron/preload.ts` | `out/preload/` | CJS |
| Renderer | `index.html` | `out/renderer/` | SPA |

Der Renderer verwendet `@vitejs/plugin-react` + `@tailwindcss/vite`, mit dem Pfad-Alias `@` �?`./src`, und der Entwicklungsserver auf `127.0.0.1:5173` (strikter Port).

| Befehl | Beschreibung |
|--------|-------------|
| `npm run dev` | Electron + Vite-Entwicklungsserver mit Hot Module Replacement (HMR) |
| `npm run build` | Produktions-Build (alle drei Ziele) |
| `npm run package` | Build + electron-builder (NSIS/DMG/AppImage) |

**electron-builder-Ziele:** Windows (NSIS + Portable), macOS (DMG + ZIP), Linux (AppImage + DEB + RPM).

---

## 5. Zustandsverwaltung

Ein einzelner Zustand-Store mit `persist`-Middleware, gestützt auf IPC-Dateispeicher.

**Store-Name:** `suora-store` · **Version:** 18 · **Backend:** `{workspace}/`

### Wichtige Zustandsbereiche

| Bereich | Schlüsselfelder |
|---------|----------------|
| Sitzungen | `sessions`, `activeSessionId`, `openSessionTabs` |
| Agenten | `agents`, `selectedAgent`, `agentPerformance`, `agentVersions` |
| Modelle | `providerConfigs`, `globalModels`, `modelUsageStats` |
| Skills | `skills`, `pluginTools`, `skillVersions` |
| Speicher | `globalMemories` |
| Sicherheit | `toolSecurity` (erlaubte Verzeichnisse, blockierte Befehle, Bestätigung) |
| Erscheinungsbild | `theme`, `fontSize`, `codeFont`, `accentColor`, `bubbleStyle`, `locale` |
| Kanäle | `channelConfigs`, `channelMessages`, `channelTokens`, `channelHealth` |
| Plugins | `installedPlugins` |
| E-Mail | `emailConfig` (SMTP) |

### Persistenz-Ablauf

```
Zustand �?fileStateStorage-Adapter �?IPC (db:loadPersistedStore / db:savePersistedStore) �?{workspace}/{settings,models}.json + sessions/, agents/, channels/, …
```

Ein In-Memory-`Map`-Cache ermöglicht synchrone Lesezugriffe über `readCached()`/`writeCached()`. Beim ersten Laden prüft der Adapter den Dateispeicher, fällt auf `localStorage` zurück (Migration) und speichert dann im Cache.

### Migrationen (Version 1 �?18)

v2: Agent-Speicher, Skill-Tools · v3: `toolSecurity`-Standardwerte · v5: `workspacePath` · v7: Migration von `providerConfigs` von Record zu Array · v8: Bestätigung standardmäßig deaktiviert · v9: `globalMemories`, Nachrüstung des Speicherbereichs · v10: Kanäle, Plugins, Locale, Agent, Onboarding · v11: `pluginTools`, `skillVersions` · v12: `emailConfig`

---

## 6. KI-Service-Schicht

Provider-Instanzen werden nach Schlüssel `${providerId}:${apiKey}:${baseUrl}` zwischengespeichert.

### Unterstützte Provider (13+)

Anthropic und OpenAI verwenden ihre nativen SDK-Pakete. Alle anderen Provider verwenden `@ai-sdk/openai-compatible` mit vorkonfigurierten Basis-URLs (Google �?`generativelanguage.googleapis.com`, Ollama �?`localhost:11434/v1`, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, Zhipu, MiniMax oder benutzerdefiniert).

### Wichtige Funktionen

```ts
validateModelConfig(model): { valid: boolean; error?: string }
initializeProvider(providerType, apiKey, baseUrl?, providerId?): void
testConnection(providerType, apiKey, baseUrl, modelId): Promise<{ success; error?; latency? }>
generateResponse(modelId, messages, systemPrompt?): Promise<string>
streamResponseWithTools(model, messages, tools, systemPrompt?, maxSteps?): AsyncGenerator<AppStreamEvent[]>
```

### Streaming-Ereignisse

`text-delta` · `tool-call` · `tool-result` · `tool-error` · `finish-step` · `usage` · `error`

Tool-Aufrufe werden in einer mehrstufigen Schleife ausgeführt (standardmäßig maximal 20 Schritte, `toolChoice: 'auto'`).

---

## 7. Skill- / Tool-System

### 18 integrierte Skills

| Skill-ID | Tools (Beispiele) |
|----------|-----------------|
| `builtin-filesystem` | `list_dir`, `read_file`, `write_file`, `search_files`, `copy_file`, `move_file`, `stat_file` |
| `builtin-shell` | `shell` (Bash unter Unix, PowerShell unter Windows) |
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

### Tool-Registrierung

```ts
import { tool } from 'ai'
import { z } from 'zod'

export const builtinToolDefs: ToolSet = {
  list_dir: tool({
    description: 'Dateien und Verzeichnisse auflisten',
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => { /* IPC-Aufruf */ },
  }),
}
```

Funktionen: `registerTools()`, `getToolsForSkills(skillIds)`, `buildToolSet()`, `getCustomToolsFromSkill()`, `getPluginTools()`.

Skills können über den Marketplace installiert werden (offizielles oder privates Register, gesteuert über die `marketplace`-Einstellung im Store).

---

## 8. Internationalisierungssystem

**10 Sprachen:** en · zh · ja · ko · fr · de · es · pt · ru · ar (~910 Schlüssel pro Sprache)

```ts
import { useI18n } from '@/hooks/useI18n'
const { t } = useI18n()
t('chat.send')  // Locale-abhängige Übersetzung
```

**Wichtige Namensräume:** `nav.*`, `chat.*`, `agents.*`, `skills.*`, `models.*`, `settings.*`, `channels.*`, `common.*`, `onboarding.*`

**Fallback-Kette:** aktuelle Locale �?Englisch �?bereitgestellter Fallback �?Rohschlüssel.

**Eine Sprache hinzufügen:** (1) den Code zum Typ `AppLocale` hinzufügen, (2) die Übersetzungstabelle in `i18n.ts` ergänzen, (3) die UI-Option in den Einstellungen hinzufügen.

---

## 9. Speichersystem

| Ebene | Geltungsbereich | Limit | Persistenz |
|-------|----------------|-------|------------|
| Kurzzeit | Pro Sitzung | 100 Einträge | Nur während der Sitzungsdauer |
| Langzeit | Global | Unbegrenzt | `globalMemories` im Store |
| Vektor | Global | Unbegrenzt | Tools `search_memory`/`add_memory` |

```ts
interface AgentMemoryEntry {
  id: string; content: string; type: string;     // 'fact', 'preference', 'context'
  scope: 'session' | 'global'; createdAt: number; source?: string;
}
```

Agenten mit `autoLearn: true` speichern automatisch Fakten über den `builtin-self-evolution`-Skill.

---

## 10. IPC-Kommunikation

**67 Invoke-Kanäle** (Anfrage-Antwort) · **1 Send-Kanal** (`app:ready`) · **6 On-Kanäle** (Ereignisse)

### Preload-Brücke

```ts
window.electron.invoke(channel, ...args): Promise<unknown>  // Whitelist; wirft Fehler bei unbekannten Kanälen
window.electron.on(channel, listener): void                  // Whitelist; wird andernfalls stillschweigend ignoriert
window.electron.send(channel, ...args): void                 // Whitelist; wird andernfalls stillschweigend ignoriert
```

### Kanalverzeichnis

| Kategorie | Kanäle |
|-----------|--------|
| Dateisystem | `fs:listDir`, `fs:readFile`, `fs:readFileRange`, `fs:writeFile`, `fs:deleteFile`, `fs:editFile`, `fs:searchFiles`, `fs:moveFile`, `fs:copyFile`, `fs:stat`, `fs:watch:start`, `fs:watch:stop` |
| Shell | `shell:exec`, `shell:openUrl` |
| Web | `web:search`, `web:fetch` |
| Browser | `browser:navigate`, `browser:screenshot`, `browser:evaluate`, `browser:extractLinks`, `browser:extractText`, `browser:fillForm`, `browser:click` |
| Zwischenablage | `clipboard:read`, `clipboard:write` |
| Timer | `timer:list`, `timer:create`, `timer:update`, `timer:delete`, `timer:history` |
| Store | `db:getSnapshot`, `db:loadPersistedStore`, `db:savePersistedStore`, `db:listEntities`, `db:saveEntity`, `db:deleteEntity` |
| Sicherer Speicher | `safe-storage:encrypt`, `safe-storage:decrypt`, `safe-storage:isAvailable` |
| System | `system:getDefaultWorkspacePath`, `system:ensureDirectory`, `system:info`, `system:notify`, `system:screenshot` |
| Kanäle | `channel:start/stop/status/register`, `channel:getWebhookUrl`, `channel:sendMessage`, `channel:sendMessageQueued`, `channel:getAccessToken`, `channel:healthCheck`, `channel:debugSend` |
| E-Mail | `email:send`, `email:test` |
| Updater | `updater:check`, `updater:getVersion` |
| Protokollierung | `log:write` |
| Sonstiges | `app:setAutoStart`, `app:getAutoStart`, `deep-link:getProtocol`, `crash:report/getLogs/clearLogs`, `perf:getMetrics` |

**Ereignis-Kanäle:** `timer:fired`, `channel:message`, `fs:watch:changed`, `app:update`, `updater:available`, `deep-link`

---

## 11. Sicherheitsarchitektur

| Maßnahme | Details |
|----------|---------|
| `nodeIntegration` | `false` �?kein Node.js im Renderer |
| `contextIsolation` | `true` �?getrennte JavaScript-Kontexte |
| IPC-Whitelist | 68 Kanäle; unbekannte Kanäle werfen Fehler oder werden stillschweigend ignoriert |
| Pfadvalidierung | `ensureAllowedPath()` prüft gegen `allowedDirectories` mit strikter Präfix-Übereinstimmung |
| Blockierte Befehle | `ensureCommandAllowed()` lehnt `rm -rf`, `del /f /q`, `format`, `shutdown` ab |
| Bestätigung | Optionale Benutzerbestätigung vor der Tool-Ausführung |
| Sicherer Speicher | Betriebssystem-Schlüsselbund-Verschlüsselung (DPAPI / Keychain / libsecret) für API-Schlüssel |
| Skill-Integrität | SHA-256-Prüfsummen; Versionshistorie (`skillVersions`, max. 500 Einträge) |
| Audit-Protokollierung | `RotatingLogger` �?10 MB/Datei, 5 Dateien/Tag, 7-Tage-Aufbewahrung |

---

## 12. Plugin-System

```ts
interface PluginInfo {
  id: string; name: string; version: string;
  description: string; enabled: boolean; config: Record<string, unknown>;
}
```

Plugins werden in `appStore.installedPlugins` gespeichert und können Tools über das `pluginTools`-Mapping registrieren (`Record<string, string[]>` �?Plugin-ID �?Tool-Namen). Zur Laufzeit fügt `getPluginTools()` Plugin-Tools in das verfügbare Tool-Set ein.

**Erweiterungspunkte:** neue Tools (über `pluginTools`), neue Skills (`type: 'marketplace'`), Kanal-Konnektoren (`ChannelConfig`), benutzerdefinierte KI-Provider (OpenAI-kompatible `ProviderConfig`).

---

## 13. Kanal-Integration

Externe Plattformen (Slack, Discord, Telegram, benutzerdefiniert) verbinden sich über einen Express-Webhook-Server, der im Hauptprozess läuft.

```
Plattform �?HTTP-Webhook �?Hauptprozess (Express) �?channel:message-Ereignis �?Renderer/KI �?channel:sendMessage �?Plattform
```

```ts
interface ChannelConfig {
  id: string; platform: 'slack' | 'discord' | 'telegram' | 'custom';
  name: string; token?: string; webhookUrl?: string; enabled: boolean;
}
```

Der Zustand wird über den `channelHealth`-Store überwacht. Agenten können programmatisch über den `builtin-channels`-Skill interagieren.

---

## 14. Tests

### Unit-Tests (Vitest)

Konfiguration: `jsdom`-Umgebung, Globals aktiviert, Muster `src/**/*.{test,spec}.{ts,tsx}`, Abdeckungsschwellen (Zeilen 8 %, Funktionen 5 %, Branches 5 %).

```bash
npm run test          # Watch-Modus
npm run test:run      # Einzelner Durchlauf
npm run test:coverage # Mit v8-Abdeckung
```

### End-to-End-Tests (Playwright)

Konfiguration: nur Chromium, Basis-URL `localhost:5173`, automatischer Start des Entwicklungsservers (Timeout 120 s), Wiederholungen 0 lokal / 2 in CI.

```bash
npm run test:e2e      # End-to-End-Tests ausführen
npm run test:e2e:ui   # Playwright-Benutzeroberfläche
```

---

## 15. CI/CD und Veröffentlichung

### Test-Workflow (`test.yml`) �?bei Push oder Pull Request auf `main`/`develop`

- **Test**-Job: Lint �?Typ-Prüfung �?Unit-Tests �?Coverage-Upload (Codecov) �?Node 20.x und 22.x, Ubuntu
- **Build**-Job: Build �?Paketierung �?Artefakt-Upload (7 Tage) �?Ubuntu/Windows/macOS, Node 22.x

### Release-Workflow (`release.yml`) �?ausgelöst bei GitHub-Release-Erstellung

Erstellt und lädt plattformspezifische Installationsprogramme hoch: `.AppImage`/`.deb`/`.rpm` (Linux), `.exe`/`.msi` (Windows), `.dmg`/`.zip` (macOS), plus `latest-*.yml`-Metadaten.

**Auto-Updater:** electron-builder GitHub-Provider; `updater:check` fragt beim Start das neueste Release ab.

---

## 16. Entwicklungshandbuch

### Einrichtung

```bash
git clone https://github.com/fandych/suora.git && cd suora
npm install
npm run dev    # Electron + HMR
```

### Eine Funktion hinzufügen

1. Typen in `src/types/index.ts` definieren
2. Zustand/Aktionen in `appStore.ts` hinzufügen; Version erhöhen und Migration ergänzen
3. Logik in `src/services/` implementieren
4. Komponenten in `src/components/` bauen; Hooks nach `src/hooks/` extrahieren
5. Route in `App.tsx` registrieren, falls erforderlich
6. i18n-Schlüssel für alle 10 Sprachen hinzufügen

### Einen KI-Provider hinzufügen

Einen Fall in `aiService.ts �?initializeProvider()` mit der SDK-Factory und Standard-Basis-URL hinzufügen, dann die Benutzeroberfläche auf der Modellseite ergänzen. Mit `testConnection()` testen.

### Ein Tool hinzufügen

```ts
// src/services/tools.ts
my_tool: tool({
  description: 'Macht etwas',
  inputSchema: z.object({ input: z.string() }),
  execute: async ({ input }) => {
    return JSON.stringify(await window.electron.invoke('my:channel', input))
  },
})
```

Wenn das Tool Betriebssystemzugriff benötigt: einen IPC-Handler in `electron/main.ts` hinzufügen und den Kanal zur Whitelist in `electron/preload.ts` hinzufügen.

### Konventionen

- `@`-Pfad-Alias für alle Importe · `window.electron.invoke()` statt Node-APIs bevorzugen · Zod-Schemas für Tool-Eingaben · Tailwind `@theme`-Token für neue Styles

---

## 17. API-Referenz

### Store-Aktionen (wichtige Auswahl)

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

### Dateispeicher

```ts
fileStateStorage.getItem(name): Promise<string | null>
fileStateStorage.setItem(name, value): void
fileStateStorage.removeItem(name): void
readCached(name): string | null      // Synchron, aus dem In-Memory-Cache
writeCached(name, value): void       // Cache + asynchrone IPC-Speicherung
```

### IPC-Brücke (Renderer-Seite)

```ts
await window.electron.invoke('fs:readFile', path)
await window.electron.invoke('shell:exec', command)
await window.electron.invoke('email:send', { to, subject, body })
window.electron.on('timer:fired', (event, timer) => { ... })
window.electron.on('channel:message', (event, msg) => { ... })
```

### Integrierte Agenten

| Agent | ID | Wichtige Skills |
|-------|----|----------------|
| Assistent | `default-assistant` | Alle 18 Skills |
| Code-Experte | `builtin-code-expert` | git, code-analysis, filesystem, shell |
| Autor | `builtin-writer` | filesystem, web, utilities, memory |
| Forscher | `builtin-researcher` | web, browser, filesystem, memory |
| Datenanalyst | `builtin-data-analyst` | filesystem, shell, utilities, code-analysis |
| DevOps-Ingenieur | `builtin-devops` | shell, filesystem, system-management, git |
| Produktmanager | `builtin-product-manager` | web, browser, utilities, channels |
| Übersetzer | `builtin-translator` | web, utilities |
| Sicherheitsspezialist | `builtin-security` | filesystem, shell, git, code-analysis |

---

*Letzte Aktualisierung: 2025*
