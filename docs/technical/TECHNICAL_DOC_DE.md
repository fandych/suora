# Technische Dokumentation von Suora

Dieses Dokument ist eine technische Referenz auf Basis der aktuellen Implementierung im Repository. Es richtet sich an Mitwirkende und Maintainer und beschreibt nur Strukturen, die im Code tatsächlich vorhanden sind.

## 1. Systemüberblick

Suora ist eine lokale KI-Workbench auf Basis von Electron. Die derzeit vorhandenen Hauptmodule sind:

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

Die Anwendung ist lokal orientiert aufgebaut. Benutzerzustand, Sitzungen, Dokumentbäume, Agent-Konfigurationen, Modellkonfigurationen und der Großteil der Laufzeitmetadaten werden lokal über eine IPC-gestützte Persistenzschicht gespeichert.

## 2. Laufzeitarchitektur

Die Laufzeit ist in drei Schichten gegliedert.

| Schicht | Aufgabe |
| --- | --- |
| Electron Main Process | Verwaltet Dateisystem, Netzwerk-Fetch-Helfer, Secure Storage, Shell, Channel-Runtime und IPC-Handler |
| Preload Bridge | Stellt unter Context Isolation eine allowlist-basierte `window.electron` API bereit |
| React Renderer | Rendert die Workbench-Oberfläche, verwaltet Zustand-State und orchestriert KI, Dokumente, Pipelines, Channels und Einstellungen |

Der Renderer verwendet einen Hash Router und lädt Feature-Module lazy.

### Aktuelle Top-Level-Routen

| Route | Modul |
| --- | --- |
| `/chat` | Chat-Workbench |
| `/documents` | Dokumenten-Workbench |
| `/pipeline` | Agent-Pipeline-Editor und Ausführungshistorie |
| `/models/:view` | Provider-, Modell- und Compare-Ansichten |
| `/agents` | Agent-Verwaltung |
| `/skills/:view` | Installierte, Browse- und Sources-Ansichten |
| `/timer` | Timer- und Planungsverwaltung |
| `/channels` | Messaging-Integrationen |
| `/mcp` | Integrationen und MCP-Konfiguration |
| `/settings/:section` | Einstellungssektionen |

### Aktuelle Einstellungssektionen

- `general`
- `security`
- `voice`
- `shortcuts`
- `data`
- `logs`
- `system`

## 3. Repository-Struktur

Das Repository ist aktuell um eine Electron-Shell und eine funktionsorientiert organisierte React-Anwendung aufgebaut.

```text
electron/
  main.ts          Electron-Hauptprozess und IPC-Handler
  preload.ts       isolierte Preload-Bridge
  channelService.ts
  database.ts

src/
  App.tsx          Router-Bootstrap und globale Initialisierung
  main.tsx         Renderer-Entry
  index.css        globale Theme-Tokens und UI-Stile
  components/      Funktionsmodule und gemeinsame UI
  hooks/           React-Hooks
  services/        AI, Storage, i18n, Pipelines, Channels, Documents
  store/           Zustand-Store und Slices
  types/           gemeinsame Typdefinitionen

docs/
  user/            Benutzerdokumentation
  technical/       technische Referenzen

e2e/
  Playwright-End-to-End-Tests
```

## 4. Technologie-Stack

| Bereich | Technologie |
| --- | --- |
| Desktop-Shell | Electron 41 |
| Frontend | React 19 |
| Build-Tooling | Vite 6 + electron-vite 5 |
| Styling | Tailwind CSS 4 |
| State | Zustand 5 |
| Sprache | TypeScript 5.8 |
| KI-Runtime | Vercel AI SDK 6 |
| Unit-Tests | Vitest |
| E2E-Tests | Playwright |

## 5. Anwendungszustand

Suora verwendet einen einzelnen persistierten Zustand-Store in `src/store/appStore.ts`, der den gesamten Workbench-Zustand koordiniert.

### Wichtige Zustandsdomänen

- Sitzungen und Chat-Tabs
- Dokumente, Ordner und Dokumentgruppen
- Modelle und Provider-Konfigurationen
- Agents, Agent-Memories, Agent-Versionen und Performance-Werte
- Skills, Skill-Versionen und externe Skill-Quellen
- Pipelines und Ausführungsmetadaten
- Timer
- Channels, Channel-Health, Benutzer, Historie und Tokens
- Benachrichtigungen
- MCP-Server-Konfiguration und -Status
- UI-Präferenzen wie Theme, Locale, Schriftgröße und Akzentfarbe

### Aktueller Import- und Exportumfang

- benutzerdefinierte Agents
- benutzerdefinierte Skills
- alle Sitzungen
- Provider-Konfigurationen
- Einstellungen externer Verzeichnisse

## 6. Modell- und KI-Service-Schicht

Die KI-Integration befindet sich in `src/services/aiService.ts`.

### Aktuell unterstützte Provider

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
- OpenAI-kompatible Endpunkte

### Aufgaben des KI-Service

- Modellkonfiguration validieren
- Clients nach Provider-Identität, API-Key und Base URL initialisieren und cachen
- Netzwerk- und Provider-Fehler klassifizieren
- normale Textantworten erzeugen
- Antworten in einer Multi-Step-Tool-Schleife streamen

### Aktuelle Streaming-Eventtypen

- `text-delta`
- `tool-call`
- `tool-result`
- `tool-error`
- `finish-step`
- `usage`
- `error`

## 7. Agent- und Skill-System

### Aktuelle eingebaute Agents

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### Agent-Modell

Der aktuelle `Agent`-Typ enthält:

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

Suora-Agents sind damit nicht nur Prompt-Vorlagen, sondern tragen auch Routing-, Tool- und Memory-Verhalten.

### Skill-Modell

Das aktuelle Skill-System basiert auf promptbasierten Fähigkeitspaketen. Unterstützt werden derzeit:

- installierte Skill-Listen
- Registry-Browsing
- Source-Verwaltung
- Bearbeitung und Vorschau von `SKILL.md`
- Import einer einzelnen Skill-Datei
- Import ganzer Skill-Ordner
- Export als Markdown oder Zip
- Verwaltung von Ressourcenbäumen neben `SKILL.md`

Kommentare im Code und das aktuelle UI-Verhalten trennen klar zwischen zwei Ebenen: eingebaute Tools kommen weiterhin aus dem Tool-System, Skills ergänzen domänenspezifische Anweisungen und gebündelte Ressourcen.

## 8. Documents, Pipelines und Timer

### Documents

Das Documents-Modul unterstützt aktuell:

- Dokumentgruppen
- verschachtelte Ordner
- Markdown-Dokumente
- Mermaid-Rendering
- Mathe-Rendering
- Backlinks und Referenzen
- Dokumentensuche
- Graph-Ansicht
- Dokumentauswahl als Chat-Kontext

### Pipeline

Das Pipeline-Modul unterstützt aktuell:

- mehrstufige Agent-Workflows
- Wiederholungen und Backoff-Strategien
- Timeouts pro Schritt
- bedingte Ausführung mit `runIf`
- Output-Transformationen und exportierte Variablen
- Budgets für Gesamtdauer, Tokens und Schrittanzahl
- Mermaid-Vorschau und Source-Export
- Ausführungshistorie und Schrittdetails
- Speichern, Import und Export

Auch die Chat-Schicht unterstützt `/pipeline`-Befehle zum Auflisten, Starten, Prüfen des Status, Lesen der Historie und Abbrechen gespeicherter Pipelines.

### Timer

Aktuelle Timer-Typen:

- `Once`
- `Interval`
- `Cron`

Aktuelle Timer-Aktionen:

- Desktop-Benachrichtigung
- Agent-Prompt ausführen
- gespeicherte Pipeline ausführen

## 9. Channels und MCP

### Channel-Plattformen

Die aktuelle `ChannelPlatform`-Fläche unterstützt:

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

### Aktuelles Channel-Verhalten

- Webhook- oder Stream-Transport
- genau ein Reply-Agent pro Channel
- Auto-Reply ein oder aus
- Allowlist für Chats
- Nachrichtenhistorie
- Benutzerliste
- Health-Panel
- Debug-Panel

### MCP

Das Integrationsmodul bietet aktuell:

- Server-Konfiguration
- Statusverfolgung der Verbindung
- Einbindung von MCP-Fähigkeiten in die Agent-Ausführung

## 10. IPC- und Sicherheitsmodell

Suora behält Electron Context Isolation bei und leitet privilegierte Operationen über die Preload-Bridge weiter.

### Zentrale aktuelle Sicherheitsmerkmale

- der Renderer greift nicht direkt auf Node.js APIs zu
- der Preload stellt nur eine allowlist-basierte invoke/on/send-Oberfläche bereit
- Ausfälle von Secure Storage werden als UI-Warnungen angezeigt
- Dateisystemzugriffe können sandboxed werden
- erlaubte Verzeichnisse können konfiguriert werden
- gefährliche Shell-Muster können blockiert werden
- Tool-Ausführung kann vorab eine Bestätigung verlangen

### Aktuelles Secure-Storage-Verhalten

Die Anwendung versucht zuerst, API-Schlüssel im sicheren Speicher des Betriebssystems abzulegen. Wenn Secure Storage nicht verfügbar ist oder die Verschlüsselung fehlschlägt, warnt die UI, dass Schlüssel nur im Speicher verbleiben und nach einem Neustart erneut eingegeben werden müssen.

## 11. UI-Theme, Internationalisierung, Build und Tests

### Theme und Präferenzen

Der Renderer verwendet ein gemeinsames Token-Theme-System in `src/index.css` und Hooks wie `useTheme`. Aktuell unterstützte Präferenzachsen sind:

- helles, dunkles oder System-Theme
- Schriftgröße
- Code-Schriftart
- Akzentfarbe
- Sprache

Der Standardwert für das Theme ist aktuell `system`.

### Aktuell integrierte Sprachen

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

### Häufige Entwicklungsbefehle

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

### Aktuell sichtbare Testrichtungen

- Electron-Preload-Verhalten
- Storage-Utilities
- Onboarding-UI
- Skill-Editor-Verhalten
- Marketplace- und Skill-Registry-Flows
- Theme-Hooks
- Datenbank-Helper
- Playwright-Smoke-Pfade

## 12. Wartungshinweise

Wenn Sie die technische Dokumentation in diesem Repository aktualisieren, sollten Sie implementierte Fakten gegenüber historischen Formulierungen bevorzugen. Besonders verlässlich sind folgende Anker:

- die realen Routen in `src/App.tsx`
- die realen eingebauten Agents in `src/store/appStore.ts`
- die realen Provider-Typen in `src/services/aiService.ts`
- die realen Einstellungssektionen in `src/components/settings/SettingsLayout.tsx`

Sofern Sie den Code nicht unmittelbar geprüft haben, sollten Sie keine driftanfälligen Zahlen wie die Gesamtzahl der IPC-Kanäle oder Tools fest in die Dokumentation schreiben.