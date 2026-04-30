# Suora Benutzerhandbuch

Dieses Handbuch basiert auf der aktuellen Implementierung im Codebestand. Es beschreibt, was Suora heute tatsächlich kann, nicht was in älteren Plänen oder veralteten Dokumenten stand.

## 1. Was Suora ist

Suora ist eine lokale KI-Workbench. Die aktuelle Anwendung ist nicht nur ein Chatfenster, sondern ein Desktop-Arbeitsbereich mit Chat, Dokumenten, Modellen, Agents, Skills, Pipelines, Timern, Channels, MCP-Servern und Einstellungen.

Sie können Suora verwenden, um:

- tägliche Gespräche und Aufgaben mit unterschiedlichen Modellen auszuführen
- Arbeit an spezialisierte Agents für Code, Schreiben, Recherche, Sicherheit, Daten und DevOps zu delegieren
- einen lokalen Dokumentenbereich aufzubauen und Dokumentkontext in Chats zu verwenden
- mehrstufige Agent-Pipelines manuell oder zeitgesteuert auszuführen
- externe Messaging-Plattformen zu verbinden, damit der Desktop-Assistent eingehende Nachrichten beantworten kann

## 2. Installation und erster Start

### Voraussetzungen

- Desktop-Umgebung unter Windows, macOS oder Linux
- Node.js 18+ bei Ausführung aus dem Quellcode
- npm

### Aus dem Quellcode starten

```bash
npm install
npm run dev
```

### Onboarding

Beim ersten Start zeigt Suora einen fünfstufigen Einrichtungsablauf:

1. Welcome
2. Configure a Model Provider
3. Meet Your Agents
4. Explore Skills
5. You're All Set

Wenn Sie ihn überspringen, können Sie ihn später unter `Settings -> System` erneut starten.

## 3. Überblick über die Workbench

| Modul | Aktueller Zweck |
| --- | --- |
| Chat | Mehrere Sitzungen, Agent-/Modellwechsel, Anhänge und Tool-Aufrufe |
| Documents | Lokale Dokumentgruppen, Ordner, Backlinks und Graphansicht |
| Pipeline | Mehrstufige Agent-Workflows entwerfen und ausführen |
| Models | Provider einrichten, Modelle aktivieren, Verbindungen testen und vergleichen |
| Agents | Eingebaute und eigene Agents verwalten, testen, importieren, exportieren und versionieren |
| Skills | Installierte Skills, Registry-Browser und `SKILL.md`-Editor |
| Timer | Einmalige, Intervall- und Cron-Zeitpläne |
| Channels | Messaging-Integrationen und Antwort-Routing |
| MCP | Konfiguration von Model Context Protocol-Servern |
| Settings | Präferenzen, Sicherheit, Daten, Logs und Diagnose |

## 4. Chat-Workflow

Der aktuelle Chat-Bereich unterstützt:

- mehrere Sitzungen und Tabs
- Agent- und Modellauswahl pro Sitzung
- Bild-, Datei- und Audioanhänge
- Streaming-Antworten
- Markdown-, Codeblock- und Mathematik-Darstellung
- Anzeige von Tool-Aufrufen und Status
- Wiederholung fehlgeschlagener Antworten
- Bearbeiten, Löschen, Anheften und Verzweigen von Nachrichten
- Feedback auf Assistentenantworten
- Vorlesen von Assistentenantworten
- Inline-Zitate

### Derzeit funktionierende Shortcuts

- `Ctrl/Cmd + K`: Befehls-Palette öffnen
- `Enter`: Nachricht senden
- `Shift + Enter`: Neue Zeile im Eingabefeld
- `Escape`: Befehls-Palette oder Dialoge schließen
- `Ctrl/Cmd + S`: Im Dokumenteditor speichern

### Befehls-Palette

Die Befehls-Palette kann direkt zu folgenden Bereichen springen:

- Sitzungen
- Dokumente
- Agents
- Skills
- Modelle
- Einstellungen
- Channels
- Timer
- MCP
- Pipeline

## 5. Modelle und Provider

Die aktuelle Provider-Schicht unterstützt:

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

### Was das Models-Modul aktuell unterstützt

- neue Provider-Konfigurationen anlegen
- Provider-Vorlagen verwenden
- API-Schlüssel und eigene Base URLs eintragen
- Verbindungen testen
- einzelne Modelle aktivieren oder deaktivieren
- `temperature` und `maxTokens` pro Modell anpassen
- aktivierte Modelle in einer eigenen Liste anzeigen
- Modelle in der Compare-Ansicht vergleichen

Bei Ollama ist der lokale Standard-Endpunkt `http://localhost:11434/v1`.

## 6. Agents und Skills

### Eingebaute Agents

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### Fähigkeiten eigener Agents

Der aktuelle Agent-Editor unterstützt:

- Namen, Avatar, Farbe und Systemprompt
- Modellbindung
- Skill-Zuweisung
- Temperatur, maximale Turns und Antwortstil
- Allow- und Deny-Listen für Tools
- Auto-Learn
- Import, Export und Duplizieren
- Versions-Snapshots und Wiederherstellung
- Test-Chat direkt im Agent-Modul

### Fähigkeiten des Skills-Moduls

Der aktuelle Skills-Workflow unterstützt:

- installierte Skills anzeigen
- Skills aktivieren oder deaktivieren
- `SKILL.md` bearbeiten
- Registry-Skills durchsuchen
- Installationsvorschau vor der Installation
- Skill-Quellen hinzufügen und verwalten
- einzelne Skill-Datei importieren
- kompletten Skill-Ordner importieren
- Skill als Markdown oder Zip exportieren

Skills können außerdem automatisch aus dem Workspace und aus externen Verzeichnissen geladen werden.

## 7. Dokumente, Pipelines und Timer

### Dokumente

Das Documents-Modul unterstützt aktuell:

- Dokumentgruppen
- verschachtelte Ordner
- Markdown-Dokumente
- Mermaid-Diagramme
- Mathematik-Blöcke
- Dokumentensuche
- Backlinks und Referenzen
- Graphansicht
- ausgewählte Dokumente als Chat-Kontext

### Pipelines

Das Pipeline-Modul unterstützt aktuell:

- mehrstufige Agent-Workflows
- Wiederholungen und Backoff-Strategien pro Schritt
- Timeouts pro Schritt
- bedingte Ausführung mit `runIf`
- Output-Transformationen und exportierte Variablen
- Budgets für Gesamtdauer, Gesamt-Token und Schrittanzahl
- Mermaid-Vorschau und Quelltext-Export
- Ausführungsverlauf und Schrittdetails
- Speichern, Import und Export

Im Chat werden außerdem `/pipeline`-Befehle unterstützt, etwa:

- `/pipeline list`
- `/pipeline run <name-or-id>`
- `/pipeline status`
- `/pipeline history <name-or-id>`
- `/pipeline cancel`

### Timer

Die aktuellen Timer-Typen sind:

- Once
- Interval
- Cron

Die aktuellen Timer-Aktionen sind:

- Desktop-Benachrichtigung
- Agent-Prompt ausführen
- gespeicherte Pipeline ausführen

## 8. Channels und MCP

### Unterstützte Channel-Plattformen

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

### Was das Channels-Modul aktuell unterstützt

- webhook- oder stream-basierter Transport
- genau einen Antwort-Agent pro Channel
- Auto-Reply ein oder aus
- Allowlist für Chats
- Nachrichtenverlauf
- Liste erkannter Benutzer
- Health-Ansicht
- Debug-Ansicht

### MCP

Das MCP-Modul wird aktuell verwendet, um:

- Server-Konfigurationen hinzuzufügen
- Server-Konfigurationen zu bearbeiten
- den Verbindungsstatus zu prüfen
- MCP-Fähigkeiten für Agents verfügbar zu machen

## 9. Einstellungen, Sicherheit und Daten

Die aktuellen Einstellungsbereiche sind:

- General
- Security
- Voice
- Shortcuts
- Data
- Logs
- System

### Wichtige aktuelle Funktionen

- Theme, Sprache, Schriftarten und Akzentfarbe
- Auto-Start
- Proxy-Konfiguration
- SMTP-Mail-Einstellungen und Verbindungstest
- Umgebungsvariablen-Verwaltung
- Bestätigungspolitik für Tool-Ausführung
- Filesystem-Sandbox-Modus
- Liste erlaubter Verzeichnisse
- blockierte Shell-Kommandos
- Spracheinstellungen
- Verwaltung von Shortcut-Zuordnungen
- Import und Export
- Aufbewahrungsrichtlinie
- Logs und Crash-Historie
- Laufzeitmetriken
- Onboarding erneut starten

### API-Schlüssel und sichere Speicherung

Die aktuelle Implementierung versucht zuerst, API-Schlüssel im sicheren Speicher des Betriebssystems abzulegen.

Wenn der System-Keyring nicht verfügbar ist oder die Verschlüsselung fehlschlägt, warnt Suora, dass:

- Schlüssel nur im Speicher bleiben
- sie nach einem Neustart erneut eingegeben werden müssen

### Was der aktuelle Export enthält

- eigene Agents
- eigene Skills
- alle Sitzungen
- Provider-Konfigurationen
- Einstellungen externer Verzeichnisse

## 10. Fehlerbehebung

### Modellverbindung schlägt fehl

Prüfen Sie in dieser Reihenfolge:

1. der API-Schlüssel ist gültig
2. die Base URL passt zum Provider
3. mindestens ein Modell ist aktiviert
4. Proxy-Einstellungen blockieren die Anfrage nicht
5. der Verbindungstest in Models ist erfolgreich

### Ein Channel empfängt keine Nachrichten

Prüfen Sie in dieser Reihenfolge:

1. der Channel ist aktiviert
2. der Antwort-Agent existiert und ist aktiviert
3. der lokale Channel-Server läuft bei Webhook-Channels
4. die Callback-URL auf der Plattform stimmt exakt mit der URL aus Suora überein
5. der aktuelle Chat wird nicht durch `allowedChats` blockiert
6. die Health- oder Debug-Ansicht zeigt keinen Credential-Fehler

### Ein Skill scheint nicht aktiv zu sein

Prüfen Sie in dieser Reihenfolge:

1. der Skill ist aktiviert
2. der benötigte Skill ist dem Agent zugewiesen
3. der Skill wurde in den aktuellen Workspace oder ein externes Verzeichnis importiert
4. der Skill-Inhalt ist ein gültiges `SKILL.md`

### Ein Timer löst nicht aus

Prüfen Sie in dieser Reihenfolge:

1. der Timer ist aktiviert
2. der Cron-Ausdruck ist gültig
3. der Ziel-Agent oder die Ziel-Pipeline existiert noch
4. die Desktop-App läuft

## 11. Empfohlene erste Sitzung

Für den Einstieg in den aktuellen Build ist diese Reihenfolge sinnvoll:

1. in `Models` einen Provider hinzufügen und ein Modell aktivieren
2. die eingebauten Agents in `Agents` ansehen
3. den ersten Chat in `Chat` starten
4. in `Documents` eine Dokumentgruppe anlegen
5. in `Pipeline` einen Workflow mit zwei oder drei Schritten speichern
6. ihn über `Timer` planen
7. `Channels` oder `MCP` erst konfigurieren, wenn der lokale Workflow stabil ist