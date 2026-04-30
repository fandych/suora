# Documentation technique de Suora

Ce document est une référence technique basée sur l'implémentation actuelle du dépôt. Il sert aux contributeurs et aux mainteneurs et ne décrit que ce qui est effectivement présent dans le code.

## 1. Vue d'ensemble du système

Suora est un atelier local d'IA basé sur Electron. Les modules de travail actuellement présents sont les suivants :

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

L'application suit une approche locale d'abord. L'état utilisateur, les sessions, l'arborescence documentaire, les configurations d'agents, les configurations de modèles et la plupart des métadonnées d'exécution sont stockés localement via une couche de persistance pilotée par IPC.

## 2. Architecture d'exécution

Le runtime est divisé en trois couches.

| Couche | Rôle |
| --- | --- |
| Electron Main Process | Gère le système de fichiers, les aides de récupération réseau, Secure Storage, le shell, le runtime des canaux et les handlers IPC |
| Preload Bridge | Expose une API `window.electron` fondée sur une allowlist sous context isolation |
| React Renderer | Rend l'interface du workbench, gère l'état avec Zustand et orchestre l'IA, les documents, les pipelines, les canaux et les réglages |

Le renderer utilise un Hash Router et charge les modules fonctionnels à la demande.

### Routes de premier niveau actuelles

| Route | Module |
| --- | --- |
| `/chat` | Espace de chat |
| `/documents` | Espace documentaire |
| `/pipeline` | Éditeur de pipelines d'agents et historique d'exécution |
| `/models/:view` | Vues fournisseurs, modèles et comparaison |
| `/agents` | Gestion des agents |
| `/skills/:view` | Vues installées, navigation et sources |
| `/timer` | Gestion des minuteries et des horaires |
| `/channels` | Intégrations de plateformes de messagerie |
| `/mcp` | Intégrations et configuration MCP |
| `/settings/:section` | Sections de réglages |

### Sections de réglages actuelles

- `general`
- `security`
- `voice`
- `shortcuts`
- `data`
- `logs`
- `system`

## 3. Structure du dépôt

Le dépôt s'organise autour d'une coque Electron et d'une application React structurée par fonctionnalité.

```text
electron/
  main.ts          processus principal Electron et handlers IPC
  preload.ts       pont preload isolé
  channelService.ts
  database.ts

src/
  App.tsx          bootstrap du routeur et initialisation globale
  main.tsx         point d'entrée du renderer
  index.css        tokens de thème globaux et styles UI
  components/      modules fonctionnels et UI partagée
  hooks/           hooks React
  services/        AI, stockage, i18n, pipelines, canaux, documents
  store/           store Zustand et slices
  types/           types partagés

docs/
  user/            documentation utilisateur
  technical/       références techniques

e2e/
  tests Playwright end-to-end
```

## 4. Stack technique

| Domaine | Technologie |
| --- | --- |
| Shell desktop | Electron 41 |
| Frontend | React 19 |
| Outils de build | Vite 6 + electron-vite 5 |
| Styles | Tailwind CSS 4 |
| État | Zustand 5 |
| Langage | TypeScript 5.8 |
| Runtime IA | Vercel AI SDK 6 |
| Tests unitaires | Vitest |
| Tests E2E | Playwright |

## 5. Modèle d'état applicatif

Suora utilise un store Zustand persistant unique dans `src/store/appStore.ts` pour piloter tout l'état du workbench.

### Principaux domaines d'état

- sessions et onglets de chat
- documents, dossiers et groupes de documents
- modèles et configurations de fournisseurs
- agents, mémoires d'agents, versions d'agents et statistiques de performance
- skills, versions de skills et sources externes
- pipelines et métadonnées d'exécution
- minuteries
- canaux, santé des canaux, utilisateurs, historique et tokens
- notifications
- configuration et état des serveurs MCP
- préférences UI comme le thème, la langue, la taille de police et la couleur d'accent

### Portée actuelle des imports et exports

- agents personnalisés
- skills personnalisées
- toutes les sessions
- configurations de fournisseurs
- paramètres de répertoires externes

## 6. Couche modèle et service IA

L'intégration IA se trouve dans `src/services/aiService.ts`.

### Fournisseurs actuellement pris en charge

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
- endpoints compatibles OpenAI

### Responsabilités du service IA

- valider la configuration des modèles
- initialiser et mettre en cache les clients selon l'identité du fournisseur, la clé API et la base URL
- classifier les erreurs réseau et fournisseur
- générer des réponses texte classiques
- produire des réponses en streaming au sein d'une boucle multi-étapes avec outils

### Types d'événements de streaming actuels

- `text-delta`
- `tool-call`
- `tool-result`
- `tool-error`
- `finish-step`
- `usage`
- `error`

## 7. Système d'agents et de skills

### Agents intégrés actuels

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### Modèle d'agent

Le type `Agent` inclut actuellement :

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

Les agents Suora ne sont donc pas de simples prompts prédéfinis. Ils embarquent aussi des contraintes d'outils, du routage et du comportement mémoire.

### Modèle de skills

Le système de skills actuel repose sur des paquets de capacités fondés sur des prompts. Il prend en charge :

- la liste des skills installées
- la navigation dans le registre
- la gestion des sources
- l'édition et l'aperçu de `SKILL.md`
- l'import d'un fichier unique
- l'import d'un dossier complet
- l'export en markdown ou zip
- la gestion d'une arborescence de ressources à côté de `SKILL.md`

Les commentaires du code et le comportement de l'UI distinguent clairement deux niveaux : les outils intégrés restent fournis par le système d'outils, tandis que les skills ajoutent des instructions spécialisées et des ressources packagées.

## 8. Documents, pipelines et minuteries

### Documents

Le module Documents prend actuellement en charge :

- groupes de documents
- dossiers imbriqués
- documents markdown
- rendu Mermaid
- rendu mathématique
- backlinks et références
- recherche de documents
- vue graphe
- sélection de documents comme contexte de chat

### Pipeline

Le module Pipeline prend actuellement en charge :

- workflows multi-agents en plusieurs étapes
- retries et stratégies de backoff
- timeouts par étape
- exécution conditionnelle avec `runIf`
- transformations de sortie et export de variables
- budgets de durée totale, de tokens et de nombre d'étapes
- aperçu Mermaid et export du source
- historique d'exécution et détail des étapes
- sauvegarde, import et export

La couche chat prend aussi en charge des commandes `/pipeline` pour lister, lancer, consulter l'état, lire l'historique et annuler des pipelines enregistrés.

### Timer

Types de minuterie actuels :

- `Once`
- `Interval`
- `Cron`

Actions actuellement prises en charge :

- notification bureau
- exécution d'un prompt d'agent
- exécution d'un pipeline sauvegardé

## 9. Channels et MCP

### Plateformes de canaux

La surface `ChannelPlatform` actuelle prend en charge :

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

### Comportement actuel des canaux

- transport webhook ou stream
- un agent de réponse par canal
- activation ou désactivation d'auto-reply
- liste blanche de chats autorisés
- historique des messages
- liste des utilisateurs
- panneau de santé
- panneau de débogage

### MCP

Le module d'intégration fournit actuellement :

- configuration des serveurs
- suivi de l'état de connexion
- intégration des capacités MCP dans l'exécution des agents

## 10. Modèle IPC et sécurité

Suora conserve le context isolation d'Electron et route les opérations privilégiées par le preload bridge.

### Principales caractéristiques de sécurité actuelles

- le renderer n'accède pas directement aux API Node.js
- le preload n'expose qu'une surface invoke/on/send sur allowlist
- les échecs de secure storage sont remontés en avertissements UI
- l'accès au système de fichiers peut être sandboxé
- l'utilisateur peut définir une liste de répertoires autorisés
- des motifs shell dangereux peuvent être bloqués
- l'exécution d'outils peut exiger une confirmation préalable

### Comportement actuel de Secure Storage

L'application tente d'abord d'écrire les clés API dans le stockage sécurisé du système d'exploitation. Si ce stockage est indisponible ou si le chiffrement échoue, l'UI avertit que les clés restent seulement en mémoire et doivent être ressaisies après redémarrage.

## 11. Thème UI, internationalisation, build et tests

### Thème et préférences

Le renderer utilise un système de tokens partagé dans `src/index.css` et des hooks comme `useTheme`. Les axes de préférence actuellement pris en charge sont :

- thème clair, sombre ou système
- taille de police
- police de code
- couleur d'accent
- langue

Le mode de thème par défaut est actuellement `system`.

### Langues actuellement intégrées

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

### Commandes de développement courantes

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

### Couverture de test actuellement visible

- comportement du preload Electron
- utilitaires de stockage
- UI d'onboarding
- comportement de l'éditeur de skills
- flux marketplace et skill registry
- hooks de thème
- helpers de base de données
- parcours smoke Playwright

## 12. Notes de maintenance

Lorsque vous mettez à jour la documentation technique de ce dépôt, privilégiez les faits issus du code plutôt que les formulations héritées de versions antérieures. Les points d'ancrage les plus fiables sont :

- les routes réelles dans `src/App.tsx`
- les agents intégrés réels dans `src/store/appStore.ts`
- les types de fournisseurs réels dans `src/services/aiService.ts`
- les sections de réglages réelles dans `src/components/settings/SettingsLayout.tsx`

À moins d'avoir vérifié le code juste avant, évitez d'écrire en dur des nombres sensibles au drift comme le nombre total de canaux IPC ou le nombre total d'outils.