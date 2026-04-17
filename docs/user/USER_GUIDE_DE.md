# Suora �?Benutzerhandbuch

Willkommen bei **Suora**, einer KI-gestützten Desktop-Anwendung, die Multi-Modell-Intelligenz, Automatisierung und Erweiterbarkeit in Ihren täglichen Arbeitsablauf bringt. Dieses Handbuch behandelt alles, was Sie für den Einstieg und die optimale Nutzung der App benötigen.

---

## Inhaltsverzeichnis

1. [Einführung](#einführung)
2. [Installation](#installation)
3. [Erste Schritte](#erste-schritte)
4. [Chat](#chat)
5. [KI-Modelle](#ki-modelle)
6. [Agenten](#agenten)
7. [Fähigkeiten](#fähigkeiten)
8. [Timer und Planung](#timer-und-planung)
9. [Kanäle](#kanäle)
10. [Einstellungen](#einstellungen)
11. [Wissensdatenbank und Gedächtnis](#wissensdatenbank-und-gedächtnis)
12. [Sicherheit und Datenschutz](#sicherheit-und-datenschutz)
13. [Tastenkürzel](#tastenkürzel)
14. [Fehlerbehebung](#fehlerbehebung)
15. [FAQ](#faq)

---

## Einführung

Suora ist eine plattformübergreifende Electron-Anwendung, mit der Sie über eine einheitliche Chat-Oberfläche mit führenden KI-Modellen interagieren können �?Anthropic Claude, OpenAI GPT, Google Gemini und viele mehr. Über einfache Konversationen hinaus bietet die App intelligente Agenten für Softwareentwicklung, Texterstellung, Recherche und DevOps; ein umfangreiches Fähigkeitensystem für Dateioperationen, Browser-Automatisierung, E-Mail und Git; geplante Aufgaben; Integrationen mit Messaging-Plattformen; sowie ein persistentes Gedächtnissystem, damit Ihre KI den Kontext über Sitzungen hinweg beibehält.

Ob Sie als Entwickler einen Programmier-Copiloten suchen, als Autor kreative Unterstützung benötigen oder als Power-User Routineaufgaben automatisieren möchten �?Suora passt sich Ihren Bedürfnissen an.

---

## Installation

### Systemvoraussetzungen

| Plattform | Mindestversion |
|-----------|---------------|
| Windows   | Windows 10 oder höher |
| macOS     | macOS 11 (Big Sur) oder höher |
| Linux     | Ubuntu 20.04 / Fedora 34 oder vergleichbar |

### Download

1. Besuchen Sie die **GitHub Releases**-Seite des Suora-Repositorys.
2. Laden Sie den Installer für Ihre Plattform herunter:
   - **Windows** �?`.exe`-Installer
   - **macOS** �?`.dmg`-Disk-Image
   - **Linux** �?`.AppImage`- oder `.deb`-Paket
3. Starten Sie den Installer und folgen Sie den Anweisungen auf dem Bildschirm.

### Aus dem Quellcode kompilieren

```bash
git clone https://github.com/fandych/suora.git
cd suora
npm install
npm run build
npm run package
```

---

## Erste Schritte

Beim ersten Start der App führt Sie ein **5-Schritte-Einrichtungsassistent** durch die Ersteinrichtung:

1. **Willkommen** �?Eine kurze Einführung in die Anwendung.
2. **Modellanbieter konfigurieren** �?Geben Sie Ihren API-Schlüssel für mindestens einen Anbieter ein (z. B. OpenAI, Anthropic).
3. **Ihre Agenten kennenlernen** �?Vorschau der integrierten, spezialisierten Agenten.
4. **Fähigkeiten entdecken** �?Sehen Sie, welche Funktionen Ihren Agenten zur Verfügung stehen.
5. **Alles bereit!** �?Beginnen Sie sofort mit dem Chatten.

> Sie können den Assistenten überspringen und alles später in den **Einstellungen** konfigurieren.

---

## Chat

Die Chat-Oberfläche ist das Herzstück von Suora.

### Eine neue Unterhaltung starten

- Klicken Sie auf die Schaltfläche **�?* in der Seitenleiste oder drücken Sie `Ctrl + N` (`Cmd + N` auf macOS).
- Jede Unterhaltung ist eine unabhängige Sitzung mit eigenem Verlauf.

### Nachrichten senden

- Geben Sie Ihre Nachricht ein und drücken Sie **Enter** zum Senden.
- Verwenden Sie **Shift + Enter** für einen Zeilenumbruch innerhalb einer Nachricht.
- Hängen Sie Bilder oder Dateien über die Schaltfläche für Anhänge an.

### Nachrichtenfunktionen

- **Streaming-Antworten** �?KI-Antworten erscheinen Wort für Wort in Echtzeit.
- **Markdown-Darstellung** �?Codeblöcke mit Syntaxhervorhebung, Tabellen, Listen und mehr.
- **Werkzeugausführungsanzeigen** �?Wenn die KI eine Fähigkeit aufruft, sehen Sie Statussymbole: ausstehend (�?, laufend (�?, Erfolg (�?, Fehler (�?, zusammen mit der Ausführungsdauer.
- **Feedback** �?Bewerten Sie jede Assistenten-Nachricht mit 👍 oder 👎.
- **Token-Verbrauch** �?Jede Antwort zeigt die Anzahl der verbrauchten Tokens an.
- **Spracheingabe** �?Drücken Sie `Ctrl + Shift + V`, um eine Nachricht zu diktieren.

### Befehlspalette

Drücken Sie `Ctrl + K`, um die Befehlspalette zu öffnen �?für schnelle Navigation, Agentenwechsel, Umschalten von Fähigkeiten und mehr.

---

## KI-Modelle

Suora unterstützt eine Vielzahl von KI-Anbietern.

### Unterstützte Anbieter

| Anbieter | Beispielmodelle |
|----------|----------------|
| Anthropic | Claude 3.5 Sonnet, Claude 3 Opus |
| OpenAI | GPT-4o, GPT-4 Turbo |
| Google Vertex AI | Gemini 1.5 Pro, Gemini 1.5 Flash |
| Ollama | Llama 3, Mistral (lokal) |
| DeepSeek | DeepSeek Coder, DeepSeek Chat |
| Groq | Mixtral, LLaMA (schnelle Inferenz) |
| Together AI | Verschiedene Open-Source-Modelle |
| Fireworks AI | Verschiedene Open-Source-Modelle |
| Perplexity | Sonar-Modelle |
| Cohere | Command R+ |
| OpenAI-kompatibel | Jeder kompatible Endpunkt |

### Einen Anbieter hinzufügen

1. Gehen Sie zu **Einstellungen �?Modellanbieter**.
2. Klicken Sie auf **Anbieter hinzufügen** und wählen Sie einen Anbietertyp.
3. Geben Sie Ihren **API-Schlüssel** ein und legen Sie optional eine **Basis-URL** fest.
4. Klicken Sie auf **Verbindung testen** zur Überprüfung.
5. Wählen Sie die Modelle aus, die Sie verwenden möchten.

### Konfiguration pro Modell

Jedes Modell kann individuelle Einstellungen für **Temperatur** (Kreativität) und **maximale Tokens** (Antwortlänge) haben.

---

## Agenten

Agenten sind spezialisierte KI-Persönlichkeiten mit eigenen Systemanweisungen, Fähigkeiten und Antwortstilen.

### Integrierte Agenten

| Agent | Ideal für | Temperatur |
|-------|----------|------------|
| 🤖 Assistent | Allgemeine Aufgaben | 0.7 |
| 🧑‍�?Code-Experte | Code-Review, Debugging | 0.5 |
| ✍️ Autor | Artikel, Dokumentation | 0.8 |
| 📚 Forscher | Recherche, Faktenprüfung | 0.6 |
| 📊 Datenanalyst | Datensätze, Trends | 0.5 |
| 🚀 DevOps-Ingenieur | CI/CD, Automatisierung | 0.4 |
| 🛡�?Sicherheitsprüfer | Schwachstellenanalyse | 0.3 |
| 🌐 Übersetzer | Übersetzung, Korrekturlesen | 0.3 |
| 📱 Produktmanager | Anforderungen, User Stories | 0.6 |

### Einen eigenen Agenten erstellen

1. Navigieren Sie zum **Agenten**-Panel.
2. Klicken Sie auf **Agent erstellen**.
3. Legen Sie einen **Namen**, eine **Systemanweisung**, einen **Antwortstil** (knapp / ausgewogen / ausführlich) und eine **Temperatur** fest.
4. Weisen Sie die Fähigkeiten zu, auf die der Agent Zugriff haben soll.
5. Speichern Sie.

Agenten unterstützen auch **automatisches Lernen**: Sie können während der Unterhaltungen Erkenntnisse im Gedächtnis speichern.

---

## Fähigkeiten

Fähigkeiten sind Werkzeuge, die Agenten während Unterhaltungen aufrufen können.

### Integrierte Fähigkeitskategorien (18+)

| Kategorie | Beispiele |
|-----------|---------|
| 📁 Dateisystem | Lesen, schreiben, bearbeiten, suchen, kopieren, verschieben von Dateien |
| 🖥�?Shell | Shell-Befehle ausführen |
| 🌐 Web | Im Web suchen, Seiten abrufen, URLs öffnen |
| 🔧 Dienstprogramme | Zwischenablage, Benachrichtigungen, Screenshots, Systeminformationen |
| 📋 Aufgaben | Aufgabenlisten verwalten |
| �?Timer | Timer erstellen und verwalten |
| 🧠 Gedächtnis | Erinnerungen speichern, suchen und verwalten |
| 🌍 Browser-Automatisierung | Navigieren, klicken, Formulare ausfüllen, Text extrahieren |
| 🤝 Agentenkommunikation | Aufgaben zwischen Agenten delegieren |
| �?Ereignisautomatisierung | Auslöser bei Dateiänderungen und Zeitplänen |
| 🧬 Selbstentwicklung | Fähigkeiten dynamisch erstellen und verbessern |
| 📎 Anhänge | Dateianhänge lesen |
| 🔀 Git | Status, Diff, Log, Commit, Stage |
| 🔬 Code-Analyse | Struktur analysieren, Muster finden |
| 🎯 Erweiterte Interaktion | Interaktive Eingabeaufforderungen, Schleifenausführung |
| 📱 Kanäle | Webhook-Server starten/stoppen, Nachrichten senden |
| 📧 E-Mail | E-Mails über SMTP senden |
| ⚙️ Systemverwaltung | Modelle/Sitzungen wechseln, Plugins verwalten |

### Fähigkeiten aktivieren / deaktivieren

Öffnen Sie **Einstellungen �?Fähigkeiten** oder verwenden Sie die Befehlspalette (`Ctrl + K`), um einzelne Fähigkeiten ein- oder auszuschalten. Das Deaktivieren einer Fähigkeit verhindert, dass alle Agenten sie aufrufen.

### Marketplace

Durchsuchen Sie von der Community bereitgestellte Fähigkeiten im **Fähigkeiten-Marketplace** und installieren Sie sie mit einem Klick. Benutzerdefinierte Fähigkeiten werden aus externen Verzeichnissen wie `~/.agents/skills` geladen.

---

## Timer und Planung

Automatisieren Sie wiederkehrende Aufgaben durch das Erstellen von Timern.

### Timer-Typen

| Typ | Beschreibung | Beispiel |
|-----|-------------|---------|
| **Einmalig** | Wird einmalig zu einem bestimmten Datum/Uhrzeit ausgelöst | „Erinnere mich heute um 15 Uhr" |
| **Intervall** | Wiederholt sich alle N Minuten | Alle 30 Minuten |
| **Cron** | Erweiterte wiederkehrende Zeitplanung | `0 9 * * 1-5` (9 Uhr an Werktagen) |

### Einen Timer erstellen

1. Öffnen Sie das **Timer**-Panel.
2. Klicken Sie auf **Timer hinzufügen**.
3. Wählen Sie den Timer-Typ und konfigurieren Sie den Zeitplan.
4. Legen Sie die Aktion fest: **Benachrichtigen** (Desktop-Benachrichtigung) oder **Agent beauftragen** (einen Prompt ausführen).
5. Speichern Sie. Die App zeigt die nächsten 5 anstehenden Ausführungszeiten als Vorschau an.

### Referenz für Cron-Ausdrücke

```
┌───────────── Minute (0-59)
�?┌───────────── Stunde (0-23)
�?�?┌───────────── Tag des Monats (1-31)
�?�?�?┌───────────── Monat (1-12)
�?�?�?�?┌───────────── Wochentag (0-6, So=0)
�?�?�?�?�?
* * * * *
```

Häufige Beispiele:
- `*/15 * * * *` �?Alle 15 Minuten
- `0 */2 * * *` �?Alle 2 Stunden
- `30 8 * * 1` �?Montag um 8:30 Uhr
- `0 0 1 * *` �?Mitternacht am 1. jedes Monats

---

## Kanäle

Verbinden Sie Suora mit Messaging-Plattformen für automatisierte Antworten.

### Unterstützte Plattformen

- **WeChat** �?Chinas führende Messaging-App
- **Feishu (Lark)** �?Die Kollaborationsplattform von Bytedance
- **DingTalk** �?Der Enterprise-Messenger von Alibaba

### Einen Kanal einrichten

1. Gehen Sie zu **Kanäle** in der Seitenleiste.
2. Wählen Sie eine Plattform und geben Sie die erforderlichen Anmeldedaten ein (App ID, App Secret, Verifizierungstoken, Verschlüsselungsschlüssel).
3. Wählen Sie den Verbindungsmodus **Webhook** oder **Stream**.
4. Aktivieren Sie die **automatische Antwort**, wenn die KI automatisch antworten soll.
5. Beschränken Sie optional auf bestimmte Chatgruppen.

Die App zeigt den Verbindungsstatus, die Latenz und den Nachrichtenverlauf an (bis zu 500 Nachrichten).

---

## Einstellungen

Greifen Sie über das Zahnrad-Symbol in der Seitenleiste auf die Einstellungen zu.

### Allgemein

- **Design** �?Hell, Dunkel oder System (folgt den Betriebssystemeinstellungen).
- **Sprache** �?English, 中文, 日本�? 한국�? Français, Deutsch, Español, Português, Русский, العربية.
- **Autostart** �?Suora beim Computerstart automatisch starten.
- **Automatisches Speichern** �?Chat-Sitzungen automatisch speichern.
- **Arbeitsbereich** �?Ein Verzeichnis für die Anwendungsdaten auswählen.

### Darstellung

- **Schriftgröße** �?Klein, Mittel, Groß.
- **Code-Schriftart** �?Fira Code, JetBrains Mono, Source Code Pro, Cascadia Code, Consolas oder Standard.
- **Blasenstil** �?Standard, Minimalistisch, Umrandet, Glassmorphism.
- **Akzentfarbe** �?Wählen Sie eine Hervorhebungsfarbe für die Benutzeroberfläche.

### Stimme

- **Stimme aktivieren** �?Spracherkennung und Sprachsynthese ein-/ausschalten.
- **Sprache** �?BCP 47-Code (z. B. `en-US`, `zh-CN`).
- **Sprechgeschwindigkeit / Tonhöhe / Lautstärke** �?Feinabstimmung der Sprachausgabe.
- **Automatisches Senden** �?Nachricht nach Abschluss der Spracherkennung automatisch senden.

### Proxy

- **Proxy aktivieren** �?Datenverkehr über einen HTTP-, HTTPS- oder SOCKS5-Proxy leiten.
- **Host**, **Port** und optionale Authentifizierung konfigurieren.

### E-Mail (SMTP)

- Konfigurieren Sie einen SMTP-Server, um E-Mails über die E-Mail-Fähigkeit zu versenden.
- Felder: Host, Port, Sicher (TLS/STARTTLS), Benutzername, Passwort, Absendername und Absenderadresse.

### Datenverwaltung

- **Verlaufsaufbewahrung** �?Anzahl der Tage, die der Chatverlauf aufbewahrt wird (0 = unbegrenzt).
- **Verlauf löschen** �?Alle Chat-Sitzungen löschen.
- **Exportieren / Importieren** �?Agenten, Fähigkeiten, Sitzungen und Anbieter als JSON-Datei sichern und wiederherstellen.

---

## Wissensdatenbank und Gedächtnis

Suora verfügt über ein mehrschichtiges Gedächtnissystem, das Ihrer KI einen dauerhaften Kontext bietet.

### Gedächtnistypen

| Typ | Zweck |
|-----|-------|
| Erkenntnis | Wichtige Erkenntnisse oder Schlussfolgerungen |
| Präferenz | Benutzerpräferenzen und Personalisierung |
| Korrektur | Fehler, die vermieden werden sollen |
| Wissen | Allgemeine Fakten |

### Gedächtnisbereiche

- **Sitzung** �?Existiert nur innerhalb der aktuellen Chat-Sitzung.
- **Global** �?Bleibt über alle Sitzungen und Agenten hinweg erhalten.

### Gedächtnis verwenden

Agenten können während Unterhaltungen automatisch Erinnerungen speichern und abrufen. Sie können das Gedächtnis auch manuell verwalten:

- **Speichern** �?Einen Fakt über die Fähigkeit `memory_store` speichern.
- **Suchen** �?Semantische Suche über alle Erinnerungen mit `memory_search`.
- **Auflisten** �?Nach Typ oder Bereich filtern mit `memory_list`.
- **Löschen** �?Einträge entfernen mit `memory_delete`.

### Vektorgedächtnis

Für fortgeschrittene Anwendungsfälle enthält Suora einen In-Memory-Vektorindex, der die semantische Ähnlichkeitssuche in Ihrer Wissensdatenbank ermöglicht.

---

## Sicherheit und Datenschutz

### Richtlinien zur Werkzeugausführung

- **Erlaubte Verzeichnisse** �?Beschränken Sie Dateioperationen auf eine Whitelist von Verzeichnissen.
- **Blockierte Befehle** �?Gefährliche Befehle (`rm -rf`, `format`, `shutdown` usw.) sind standardmäßig blockiert.
- **Bestätigungsaufforderungen** �?Erfordern Sie optional die Zustimmung des Benutzers vor jeder Werkzeugausführung.

### Fähigkeitsintegrität

- Fähigkeiten werden mit **SHA-256-Hashes** und kryptografischen Signaturen verifiziert.
- Das Prüfsystem erkennt gefährliche Code-Muster wie `eval()`, `Function()` und `require()`.

### Audit-Protokollierung

Jede Werkzeugausführung wird protokolliert mit:
- Zeitstempel, Werkzeugname, Status und Dauer
- Ein-/Ausgabedaten
- Fehler- und blockierte-Befehle-Einträge

Das Audit-Protokoll speichert bis zu 10.000 Einträge und kann als JSON exportiert werden. Ein Dashboard zeigt Ausführungsstatistiken der letzten 24 Stunden.

---

## Tastenkürzel

| Aktion | Windows / Linux | macOS |
|--------|----------------|-------|
| Neue Unterhaltung | `Ctrl + N` | `Cmd + N` |
| Befehlspalette | `Ctrl + K` | `Cmd + K` |
| Nachricht senden | `Enter` | `Enter` |
| Neue Zeile | `Shift + Enter` | `Shift + Enter` |
| Spracheingabe | `Ctrl + Shift + V` | `Cmd + Shift + V` |
| Seitenleiste umschalten | `Ctrl + B` | `Cmd + B` |
| Panel schließen | `Escape` | `Escape` |

Alle Tastenkürzel sind anpassbar unter **Einstellungen �?Tastenkürzel**.

---

## Fehlerbehebung

### Die App startet nicht

- Stellen Sie sicher, dass Ihr System die Mindestanforderungen erfüllt.
- Unter Linux überprüfen Sie, ob das AppImage Ausführungsberechtigungen hat: `chmod +x Suora.AppImage`.
- Prüfen Sie die Anwendungsprotokolle in `~/.suora/logs/`.

### KI-Antworten sind leer oder schlagen fehl

- Überprüfen Sie, ob Ihr API-Schlüssel unter **Einstellungen �?Modellanbieter** gültig ist.
- Klicken Sie auf **Verbindung testen**, um Verbindungsprobleme zu diagnostizieren.
- Wenn Sie sich hinter einer Unternehmens-Firewall befinden, konfigurieren Sie einen Proxy unter **Einstellungen �?Proxy**.

### Fähigkeiten werden nicht ausgeführt

- Überprüfen Sie, ob die Fähigkeit unter **Einstellungen �?Fähigkeiten** aktiviert ist.
- Prüfen Sie unter **Sicherheit �?Erlaubte Verzeichnisse**, ob eine Dateioperation blockiert wird.
- Sehen Sie im **Audit-Protokoll** nach Fehlerdetails.

### Timer wird nicht ausgelöst

- Stellen Sie sicher, dass der Timer eingeschaltet ist (**on**).
- Überprüfen Sie Ihren Cron-Ausdruck über das Vorschau-Panel (es zeigt die nächsten 5 Ausführungen).
- Die App muss laufen, damit Timer ausgeführt werden (Prüffrequenz: alle 15 Sekunden).

### Hoher Speicherverbrauch

- Reduzieren Sie die **Verlaufsaufbewahrung** in den Einstellungen.
- Löschen Sie alte Chat-Sitzungen.
- Deaktivieren Sie nicht benötigte Fähigkeiten und Agenten.

---

## FAQ

**F: Werden meine Daten an Drittanbieter-Server gesendet?**
A: Unterhaltungen werden nur an den von Ihnen konfigurierten KI-Anbieter gesendet (z. B. OpenAI, Anthropic). Es werden keine Daten an das Suora-Team übermittelt.

**F: Kann ich lokale Modelle verwenden?**
A: Ja. Fügen Sie einen **Ollama**-Anbieter hinzu und verweisen Sie ihn auf Ihre lokale Ollama-Instanz.

**F: Wie setze ich die App zurück?**
A: Löschen Sie das Verzeichnis `~/.suora/` und starten Sie die App neu.

**F: Kann ich mehrere KI-Anbieter gleichzeitig verwenden?**
A: Selbstverständlich. Fügen Sie beliebig viele Anbieter hinzu und wechseln Sie während einer Unterhaltung zwischen Modellen.

**F: Wo werden meine Chat-Sitzungen gespeichert?**
A: Lokal auf Ihrem Computer im Arbeitsbereichsverzeichnis (Standard: `~/.suora/`).

**F: Wie erstelle ich eine benutzerdefinierte Fähigkeit?**
A: Verwenden Sie die **Selbstentwicklungs**-Fähigkeit (`skill_create`), um dynamisch neue Fähigkeiten zu generieren, oder legen Sie eine Fähigkeitsdefinitionsdatei in `~/.agents/skills/` ab.

**F: Gibt es eine mobile Version?**
A: Suora ist derzeit nur für Windows, macOS und Linux verfügbar.

**F: Wie melde ich einen Fehler?**
A: Eröffnen Sie ein Issue im GitHub-Repository mit Reproduktionsschritten und Ihren Systeminformationen.

---

*Vielen Dank, dass Sie Suora nutzen! Wenn Sie Vorschläge oder Feedback haben, freuen wir uns über Ihre Nachricht auf GitHub.*
