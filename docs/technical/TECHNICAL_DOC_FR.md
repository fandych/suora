# Suora �?Documentation Technique

> Une application de bureau intelligente basée sur Electron avec prise en charge multi-modèles, agents intelligents, système de compétences, gestion de la mémoire et architecture de plugins.

## Table des matières

1. [Vue d'ensemble de l'architecture](#1-vue-densemble-de-larchitecture)
2. [Structure du projet](#2-structure-du-projet)
3. [Pile technologique](#3-pile-technologique)
4. [Système de build](#4-système-de-build)
5. [Gestion de l'état](#5-gestion-de-létat)
6. [Couche de service IA](#6-couche-de-service-ia)
7. [Système de compétences / outils](#7-système-de-compétences--outils)
8. [Système d'internationalisation](#8-système-dinternationalisation)
9. [Système de mémoire](#9-système-de-mémoire)
10. [Communication IPC](#10-communication-ipc)
11. [Architecture de sécurité](#11-architecture-de-sécurité)
12. [Système de plugins](#12-système-de-plugins)
13. [Intégration des canaux](#13-intégration-des-canaux)
14. [Tests](#14-tests)
15. [CI/CD et publication](#15-cicd-et-publication)
16. [Guide de développement](#16-guide-de-développement)
17. [Référence API](#17-référence-api)

---

## 1. Vue d'ensemble de l'architecture

```
┌───────────────────────────────────────────────────────�?
�?                  Electron Shell                      �?
�?                                                      �?
�? ┌─────────────�? IPC (68 canaux)     ┌────────────�? �?
�? │Processus    │◄───────────────────►│  Renderer   �? �?
�? │principal    �? pont preload        �?(React 19)  �? �?
�? �?(Node.js)   �?                     �?            �? �?
�? │�?Handlers   �?                     │�?Zustand 5  �? �?
�? �? IPC        �?                     │�?AI SDK 6   �? �?
�? │�?E/S fich.  �?                     │�?Outils     �? �?
�? │�?Exec shell �?                     │�?Routeur    �? �?
�? │�?Email SMTP �?                     │�?Tailwind 4 �? �?
�? │�?Logger     �?                     �?            �? �?
�? └─────────────�?                     └────────────�? �?
�?       �? contextIsolation: true            �?        �?
�?       └──────── Preload (preload.ts) ──────�?        �?
�?             window.electron.invoke/on/send            �?
└───────────────────────────────────────────────────────�?
```

- **Processus principal** (`electron/main.ts`) �?possède la `BrowserWindow` ; gère toutes les opérations au niveau du système d'exploitation (système de fichiers, shell, presse-papiers, SMTP, minuteries, automatisation du navigateur) via les handlers IPC.
- **Script de préchargement** (`electron/preload.ts`) �?contexte isolé qui expose une liste blanche de 68 canaux IPC via `contextBridge.exposeInMainWorld('electron', ...)`.
- **Renderer** (`src/`) �?application React 19 monopage assemblée par Vite 6, état via Zustand 5, IA via Vercel AI SDK 6 et accès au système via le pont preload.

---

## 2. Structure du projet

```
src/
├── App.tsx                  # React Router (8 routes)
├── index.css                # Jetons @theme Tailwind (sombre/clair)
├── store/appStore.ts        # État global Zustand (version 18)
├── services/
�?  ├── aiService.ts         # Intégration IA multi-fournisseurs
�?  ├── tools.ts             # 18 catégories de compétences, 42+ outils
�?  ├── i18n.ts              # Traductions en 10 langues (~910 clés)
�?  ├── fileStorage.ts       # Persistance JSON via IPC + cache
�?  ├── voiceInteraction.ts  # API Web Speech (STT/TTS)
�?  └── logger.ts            # Transfert de logs Renderer �?main
├── hooks/
�?  ├── useI18n.ts           # Hook de traduction
�?  └── useTheme.ts          # Hook thème/accent/police
├── components/              # Composants React organisés par fonctionnalité
├── types/index.ts           # Interfaces TypeScript partagées
└── test/setup.ts            # Configuration Vitest

electron/
├── main.ts                  # Processus principal, handlers IPC, SMTP, mise à jour
├── preload.ts               # Pont isolé par contexte (68 canaux)
└── logger.ts                # RotatingLogger (~/.suora/logs)
```

**Sorties de build :** `out/main/` (ESM) · `out/preload/` (CJS) · `out/renderer/` (SPA) · `dist/` (installeurs)

---

## 3. Pile technologique

| Couche | Technologie | Version |
|--------|------------|---------|
| Bureau | Electron | 41.x |
| Frontend | React | 19.2 |
| Assembleur | Vite + electron-vite | 6.0 + 5.0 |
| Style | Tailwind CSS | 4.2 |
| État | Zustand | 5.0 |
| SDK IA | Vercel AI SDK (`ai`) | 6.0 |
| Langage | TypeScript | 5.8+ |
| Routeur | React Router | 7.x |
| Validation | Zod | 4.x |
| Email | nodemailer | 8.x |
| HTTP/WS | Express 5 + ws 8 | �?|
| Empaquetage | electron-builder | 26.x |
| Tests | Vitest 4.x + Playwright 1.58 | �?|

**Paquets de fournisseurs IA :** `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google-vertex`, `@ai-sdk/openai-compatible` (pour Ollama, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, Zhipu, MiniMax et les points de terminaison personnalisés).

---

## 4. Système de build

Trois cibles de build définies dans `electron.vite.config.ts` :

| Cible | Entrée | Sortie | Format |
|-------|--------|--------|--------|
| Main | `electron/main.ts` | `out/main/` | ESM |
| Preload | `electron/preload.ts` | `out/preload/` | CJS |
| Renderer | `index.html` | `out/renderer/` | SPA |

Le renderer utilise `@vitejs/plugin-react` + `@tailwindcss/vite`, avec l'alias de chemin `@` �?`./src`, et le serveur de développement sur `127.0.0.1:5173` (port strict).

| Commande | Description |
|----------|-------------|
| `npm run dev` | Electron + serveur de développement Vite avec remplacement de modules à chaud (HMR) |
| `npm run build` | Build de production (les trois cibles) |
| `npm run package` | Build + electron-builder (NSIS/DMG/AppImage) |

**Cibles electron-builder :** Windows (NSIS + portable), macOS (DMG + ZIP), Linux (AppImage + DEB + RPM).

---

## 5. Gestion de l'état

Un store Zustand unique avec un middleware `persist` s'appuyant sur le stockage de fichiers par IPC.

**Nom du store :** `suora-store` · **Version :** 18 · **Backend :** `{workspace}/`

### Tranches d'état principales

| Tranche | Champs clés |
|---------|------------|
| Sessions | `sessions`, `activeSessionId`, `openSessionTabs` |
| Agents | `agents`, `selectedAgent`, `agentPerformance`, `agentVersions` |
| Modèles | `providerConfigs`, `globalModels`, `modelUsageStats` |
| Compétences | `skills`, `pluginTools`, `skillVersions` |
| Mémoire | `globalMemories` |
| Sécurité | `toolSecurity` (répertoires autorisés, commandes bloquées, confirmation) |
| Apparence | `theme`, `fontSize`, `codeFont`, `accentColor`, `bubbleStyle`, `locale` |
| Canaux | `channelConfigs`, `channelMessages`, `channelTokens`, `channelHealth` |
| Plugins | `installedPlugins` |
| Email | `emailConfig` (SMTP) |

### Flux de persistance

```
Zustand �?adaptateur fileStateStorage �?IPC (db:loadPersistedStore / db:savePersistedStore) �?{workspace}/{settings,models}.json + sessions/, agents/, channels/, …
```

Un cache `Map` en mémoire permet des lectures synchrones via `readCached()`/`writeCached()`. Lors du premier chargement, l'adaptateur vérifie le stockage de fichiers, se rabat sur `localStorage` (migration), puis met en cache.

### Migrations (Version 1 �?18)

v2 : mémoire d'agent, outils de compétences · v3 : valeurs par défaut `toolSecurity` · v5 : `workspacePath` · v7 : migration de `providerConfigs` de Record vers Array · v8 : désactivation de la confirmation par défaut · v9 : `globalMemories`, remplissage rétroactif de la portée de mémoire · v10 : canaux, plugins, locale, agent, intégration · v11 : `pluginTools`, `skillVersions` · v12 : `emailConfig`

---

## 6. Couche de service IA

Les instances de fournisseur sont mises en cache par clé `${providerId}:${apiKey}:${baseUrl}`.

### Fournisseurs pris en charge (13+)

Anthropic et OpenAI utilisent leurs paquets SDK natifs. Tous les autres fournisseurs utilisent `@ai-sdk/openai-compatible` avec des URL de base préconfigurées (Google �?`generativelanguage.googleapis.com`, Ollama �?`localhost:11434/v1`, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, Zhipu, MiniMax ou personnalisé).

### Fonctions principales

```ts
validateModelConfig(model): { valid: boolean; error?: string }
initializeProvider(providerType, apiKey, baseUrl?, providerId?): void
testConnection(providerType, apiKey, baseUrl, modelId): Promise<{ success; error?; latency? }>
generateResponse(modelId, messages, systemPrompt?): Promise<string>
streamResponseWithTools(model, messages, tools, systemPrompt?, maxSteps?): AsyncGenerator<AppStreamEvent[]>
```

### Événements de streaming

`text-delta` · `tool-call` · `tool-result` · `tool-error` · `finish-step` · `usage` · `error`

Les appels d'outils sont exécutés dans une boucle multi-étapes (maximum par défaut de 20 étapes, `toolChoice: 'auto'`).

---

## 7. Système de compétences / outils

### 18 compétences intégrées

| ID de compétence | Outils (exemples) |
|-----------------|-------------------|
| `builtin-filesystem` | `list_dir`, `read_file`, `write_file`, `search_files`, `copy_file`, `move_file`, `stat_file` |
| `builtin-shell` | `shell` (bash sous Unix, PowerShell sous Windows) |
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

### Enregistrement d'outils

```ts
import { tool } from 'ai'
import { z } from 'zod'

export const builtinToolDefs: ToolSet = {
  list_dir: tool({
    description: 'Lister les fichiers et répertoires',
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => { /* appel IPC */ },
  }),
}
```

Fonctions : `registerTools()`, `getToolsForSkills(skillIds)`, `buildToolSet()`, `getCustomToolsFromSkill()`, `getPluginTools()`.

Les compétences peuvent être installées depuis le marketplace (registre officiel ou privé, contrôlé via le paramètre `marketplace` du store).

---

## 8. Système d'internationalisation

**10 langues :** en · zh · ja · ko · fr · de · es · pt · ru · ar (~910 clés par langue)

```ts
import { useI18n } from '@/hooks/useI18n'
const { t } = useI18n()
t('chat.send')  // Traduction selon la locale
```

**Espaces de noms principaux :** `nav.*`, `chat.*`, `agents.*`, `skills.*`, `models.*`, `settings.*`, `channels.*`, `common.*`, `onboarding.*`

**Chaîne de repli :** locale courante �?anglais �?repli fourni �?clé brute.

**Ajouter une langue :** (1) ajouter le code au type `AppLocale`, (2) ajouter la table de traduction dans `i18n.ts`, (3) ajouter l'option dans l'interface des paramètres.

---

## 9. Système de mémoire

| Niveau | Portée | Limite | Persistance |
|--------|--------|--------|-------------|
| Court terme | Par session | 100 éléments | Durée de vie de la session uniquement |
| Long terme | Globale | Illimitée | `globalMemories` dans le store |
| Vectorielle | Globale | Illimitée | Outils `search_memory`/`add_memory` |

```ts
interface AgentMemoryEntry {
  id: string; content: string; type: string;     // 'fact', 'preference', 'context'
  scope: 'session' | 'global'; createdAt: number; source?: string;
}
```

Les agents avec `autoLearn: true` persistent automatiquement les faits via la compétence `builtin-self-evolution`.

---

## 10. Communication IPC

**67 canaux invoke** (requête-réponse) · **1 canal send** (`app:ready`) · **6 canaux on** (événements)

### Pont preload

```ts
window.electron.invoke(channel, ...args): Promise<unknown>  // Liste blanche ; lève une exception pour les canaux inconnus
window.electron.on(channel, listener): void                  // Liste blanche ; ignoré silencieusement sinon
window.electron.send(channel, ...args): void                 // Liste blanche ; ignoré silencieusement sinon
```

### Index des canaux

| Catégorie | Canaux |
|-----------|--------|
| Système de fichiers | `fs:listDir`, `fs:readFile`, `fs:readFileRange`, `fs:writeFile`, `fs:deleteFile`, `fs:editFile`, `fs:searchFiles`, `fs:moveFile`, `fs:copyFile`, `fs:stat`, `fs:watch:start`, `fs:watch:stop` |
| Shell | `shell:exec`, `shell:openUrl` |
| Web | `web:search`, `web:fetch` |
| Navigateur | `browser:navigate`, `browser:screenshot`, `browser:evaluate`, `browser:extractLinks`, `browser:extractText`, `browser:fillForm`, `browser:click` |
| Presse-papiers | `clipboard:read`, `clipboard:write` |
| Minuteries | `timer:list`, `timer:create`, `timer:update`, `timer:delete`, `timer:history` |
| Store | `db:getSnapshot`, `db:loadPersistedStore`, `db:savePersistedStore`, `db:listEntities`, `db:saveEntity`, `db:deleteEntity` |
| Stockage sécurisé | `safe-storage:encrypt`, `safe-storage:decrypt`, `safe-storage:isAvailable` |
| Système | `system:getDefaultWorkspacePath`, `system:ensureDirectory`, `system:info`, `system:notify`, `system:screenshot` |
| Canaux | `channel:start/stop/status/register`, `channel:getWebhookUrl`, `channel:sendMessage`, `channel:sendMessageQueued`, `channel:getAccessToken`, `channel:healthCheck`, `channel:debugSend` |
| Email | `email:send`, `email:test` |
| Mise à jour | `updater:check`, `updater:getVersion` |
| Journalisation | `log:write` |
| Autre | `app:setAutoStart`, `app:getAutoStart`, `deep-link:getProtocol`, `crash:report/getLogs/clearLogs`, `perf:getMetrics` |

**Canaux d'événements :** `timer:fired`, `channel:message`, `fs:watch:changed`, `app:update`, `updater:available`, `deep-link`

---

## 11. Architecture de sécurité

| Mesure | Détails |
|--------|---------|
| `nodeIntegration` | `false` �?pas de Node.js dans le renderer |
| `contextIsolation` | `true` �?contextes JavaScript séparés |
| Liste blanche IPC | 68 canaux ; les canaux inconnus lèvent une exception ou sont ignorés silencieusement |
| Validation des chemins | `ensureAllowedPath()` vérifie les `allowedDirectories` avec correspondance stricte de préfixe |
| Commandes bloquées | `ensureCommandAllowed()` rejette `rm -rf`, `del /f /q`, `format`, `shutdown` |
| Confirmation | Confirmation optionnelle de l'utilisateur avant l'exécution d'un outil |
| Stockage sécurisé | Chiffrement par le trousseau du système (DPAPI / Keychain / libsecret) pour les clés API |
| Intégrité des compétences | Sommes de contrôle SHA-256 ; historique des versions (`skillVersions`, max 500 entrées) |
| Journalisation d'audit | `RotatingLogger` �?10 Mo/fichier, 5 fichiers/jour, rétention de 7 jours |

---

## 12. Système de plugins

```ts
interface PluginInfo {
  id: string; name: string; version: string;
  description: string; enabled: boolean; config: Record<string, unknown>;
}
```

Les plugins sont stockés dans `appStore.installedPlugins` et peuvent enregistrer des outils via le mappage `pluginTools` (`Record<string, string[]>` �?ID du plugin �?noms d'outils). À l'exécution, `getPluginTools()` fusionne les outils des plugins dans l'ensemble d'outils disponible.

**Points d'extension :** nouveaux outils (via `pluginTools`), nouvelles compétences (`type: 'marketplace'`), connecteurs de canaux (`ChannelConfig`), fournisseurs IA personnalisés (`ProviderConfig` compatible OpenAI).

---

## 13. Intégration des canaux

Les plateformes externes (Slack, Discord, Telegram, personnalisée) se connectent via un serveur webhook Express s'exécutant dans le processus principal.

```
Plateforme �?Webhook HTTP �?Processus principal (Express) �?événement channel:message �?Renderer/IA �?channel:sendMessage �?Plateforme
```

```ts
interface ChannelConfig {
  id: string; platform: 'slack' | 'discord' | 'telegram' | 'custom';
  name: string; token?: string; webhookUrl?: string; enabled: boolean;
}
```

La santé est surveillée via le store `channelHealth`. Les agents peuvent interagir de manière programmatique en utilisant la compétence `builtin-channels`.

---

## 14. Tests

### Tests unitaires (Vitest)

Configuration : environnement `jsdom`, globales activées, patron `src/**/*.{test,spec}.{ts,tsx}`, seuils de couverture (lignes 8 %, fonctions 5 %, branches 5 %).

```bash
npm run test          # Mode surveillance
npm run test:run      # Exécution unique
npm run test:coverage # Avec couverture v8
```

### Tests de bout en bout (Playwright)

Configuration : Chromium uniquement, URL de base `localhost:5173`, démarrage automatique du serveur de développement (timeout 120 s), tentatives 0 en local / 2 en CI.

```bash
npm run test:e2e      # Exécuter les tests de bout en bout
npm run test:e2e:ui   # Interface Playwright
```

---

## 15. CI/CD et publication

### Workflow de test (`test.yml`) �?sur push ou pull request vers `main`/`develop`

- Job **Test** : lint �?vérification de types �?tests unitaires �?envoi de couverture (Codecov) �?Node 20.x et 22.x, Ubuntu
- Job **Build** : build �?empaquetage �?envoi d'artefacts (7 jours) �?Ubuntu/Windows/macOS, Node 22.x

### Workflow de publication (`release.yml`) �?déclenché lors de la création d'une release GitHub

Compile et envoie les installeurs par plateforme : `.AppImage`/`.deb`/`.rpm` (Linux), `.exe`/`.msi` (Windows), `.dmg`/`.zip` (macOS), ainsi que les métadonnées `latest-*.yml`.

**Mise à jour automatique :** fournisseur GitHub d'electron-builder ; `updater:check` interroge la dernière release au démarrage.

---

## 16. Guide de développement

### Installation

```bash
git clone https://github.com/fandych/suora.git && cd suora
npm install
npm run dev    # Electron + HMR
```

### Ajouter une fonctionnalité

1. Définir les types dans `src/types/index.ts`
2. Ajouter l'état/les actions dans `appStore.ts` ; incrémenter la version et ajouter une migration
3. Implémenter la logique dans `src/services/`
4. Construire les composants dans `src/components/` ; extraire les hooks vers `src/hooks/`
5. Enregistrer la route dans `App.tsx` si nécessaire
6. Ajouter les clés i18n pour les 10 langues

### Ajouter un fournisseur IA

Ajouter un cas dans `aiService.ts �?initializeProvider()` avec la fabrique SDK et l'URL de base par défaut, puis ajouter l'interface dans la page des modèles. Tester avec `testConnection()`.

### Ajouter un outil

```ts
// src/services/tools.ts
my_tool: tool({
  description: 'Fait quelque chose',
  inputSchema: z.object({ input: z.string() }),
  execute: async ({ input }) => {
    return JSON.stringify(await window.electron.invoke('my:channel', input))
  },
})
```

Si l'outil nécessite un accès au système : ajouter un handler IPC dans `electron/main.ts` et ajouter le canal à la liste blanche dans `electron/preload.ts`.

### Conventions

- Alias de chemin `@` pour toutes les importations · préférer `window.electron.invoke()` aux API Node · schémas Zod pour les entrées d'outils · jetons Tailwind `@theme` pour les nouveaux styles

---

## 17. Référence API

### Actions du store (sous-ensemble principal)

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

### Stockage de fichiers

```ts
fileStateStorage.getItem(name): Promise<string | null>
fileStateStorage.setItem(name, value): void
fileStateStorage.removeItem(name): void
readCached(name): string | null      // Synchrone, depuis le cache en mémoire
writeCached(name, value): void       // Cache + sauvegarde IPC asynchrone
```

### Pont IPC (côté renderer)

```ts
await window.electron.invoke('fs:readFile', path)
await window.electron.invoke('shell:exec', command)
await window.electron.invoke('email:send', { to, subject, body })
window.electron.on('timer:fired', (event, timer) => { ... })
window.electron.on('channel:message', (event, msg) => { ... })
```

### Agents intégrés

| Agent | ID | Compétences clés |
|-------|----|------------------|
| Assistant | `default-assistant` | Les 18 compétences |
| Expert en code | `builtin-code-expert` | git, code-analysis, filesystem, shell |
| Rédacteur | `builtin-writer` | filesystem, web, utilities, memory |
| Chercheur | `builtin-researcher` | web, browser, filesystem, memory |
| Analyste de données | `builtin-data-analyst` | filesystem, shell, utilities, code-analysis |
| Ingénieur DevOps | `builtin-devops` | shell, filesystem, system-management, git |
| Chef de produit | `builtin-product-manager` | web, browser, utilities, channels |
| Traducteur | `builtin-translator` | web, utilities |
| Spécialiste en sécurité | `builtin-security` | filesystem, shell, git, code-analysis |

---

*Dernière mise à jour : 2025*
