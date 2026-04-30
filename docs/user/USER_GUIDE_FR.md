# Guide d'utilisation de Suora

Ce guide est basé sur l'implémentation actuelle du dépôt. Il décrit ce que Suora sait faire aujourd'hui, et non ce qui figurait dans d'anciens plans ou dans une documentation dépassée.

## 1. Qu'est-ce que Suora

Suora est un atelier local d'IA. L'application actuelle n'est pas seulement une fenêtre de chat, mais un espace de travail de bureau composé de modules pour le chat, les documents, les modèles, les agents, les compétences, les pipelines, les minuteries, les canaux, les serveurs MCP et les réglages.

Vous pouvez l'utiliser pour :

- exécuter des conversations et des tâches quotidiennes avec différents modèles
- déléguer du travail à des agents spécialisés pour le code, l'écriture, la recherche, la sécurité, la donnée et le DevOps
- maintenir un espace documentaire local et joindre ce contexte aux conversations
- construire des pipelines multi-étapes et les lancer manuellement ou selon un horaire
- connecter des plateformes de messagerie pour que l'assistant de bureau réponde aux messages entrants

## 2. Installation et premier lancement

### Prérequis

- environnement de bureau sous Windows, macOS ou Linux
- Node.js 18+ pour une exécution depuis les sources
- npm

### Lancer depuis les sources

```bash
npm install
npm run dev
```

### Onboarding

Au premier lancement, Suora affiche un parcours d'onboarding en cinq étapes :

1. Welcome
2. Configure a Model Provider
3. Meet Your Agents
4. Explore Skills
5. You're All Set

Si vous l'ignorez, vous pouvez le relancer plus tard depuis `Settings -> System`.

## 3. Carte de l'espace de travail

| Module | Usage actuel |
| --- | --- |
| Chat | Chat multi-session, changement d'agent ou de modèle, pièces jointes et appels d'outils |
| Documents | Groupes de documents locaux, dossiers, backlinks et vue graphe |
| Pipeline | Conception et exécution de workflows multi-agents |
| Models | Configuration des fournisseurs, activation des modèles, test de connexion et comparaison |
| Agents | Gestion des agents intégrés et personnalisés, tests, import, export et versionning |
| Skills | Compétences installées, exploration du registre et édition de `SKILL.md` |
| Timer | Planifications uniques, par intervalle et Cron |
| Channels | Intégrations de messagerie et routage des réponses |
| MCP | Configuration des serveurs Model Context Protocol |
| Settings | Préférences, sécurité, données, journaux et diagnostic |

## 4. Flux de chat

L'expérience de chat actuelle comprend :

- plusieurs sessions et onglets
- sélection de l'agent et du modèle par session
- pièces jointes image, fichier et audio
- réponses en streaming
- rendu markdown, blocs de code et mathématiques
- affichage de l'état des appels d'outils
- relance des réponses en échec
- édition, suppression, épinglage et branchement des messages
- feedback sur les réponses de l'assistant
- lecture à voix haute des réponses
- citations en ligne

### Raccourcis actuellement fonctionnels

- `Ctrl/Cmd + K` : ouvrir la palette de commandes
- `Enter` : envoyer un message
- `Shift + Enter` : nouvelle ligne dans la zone de saisie
- `Escape` : fermer la palette ou les dialogues
- `Ctrl/Cmd + S` : enregistrer dans l'éditeur de documents

### Palette de commandes

La palette peut aller directement vers :

- les sessions
- les documents
- les agents
- les compétences
- les modèles
- les réglages
- les canaux
- les minuteries
- MCP
- Pipeline

## 5. Modèles et fournisseurs

La couche actuelle de fournisseurs prend en charge :

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
- les endpoints compatibles OpenAI

### Ce que le module Models permet aujourd'hui

- ajouter des configurations de fournisseur
- utiliser des préréglages de fournisseur
- saisir des clés API et des Base URL personnalisées
- tester la connectivité
- activer ou désactiver des modèles individuellement
- ajuster `temperature` et `maxTokens` par modèle
- afficher la liste des modèles activés
- comparer les modèles dans la vue Compare

Si vous utilisez Ollama, l'endpoint local par défaut est `http://localhost:11434/v1`.

## 6. Agents et compétences

### Agents intégrés

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### Capacités des agents personnalisés

L'éditeur actuel prend en charge :

- nom, avatar, couleur et prompt système
- rattachement à un modèle
- attribution des compétences
- température, nombre maximal de tours et style de réponse
- listes d'outils autorisés et interdits
- apprentissage automatique
- import, export et duplication
- instantanés de version et restauration
- chat de test directement dans le module Agents

### Capacités du module Skills

Le flux actuel des compétences prend en charge :

- l'affichage des compétences installées
- l'activation ou la désactivation des compétences
- l'édition de `SKILL.md`
- l'exploration des compétences du registre
- l'aperçu d'installation avant installation
- l'ajout et la gestion des sources de compétences
- l'import d'un fichier de compétence
- l'import d'un dossier complet de compétence
- l'export d'une compétence en markdown ou zip

Les compétences peuvent aussi être chargées automatiquement depuis l'espace de travail et depuis des répertoires externes.

## 7. Documents, pipelines et minuteries

### Documents

Le module Documents prend actuellement en charge :

- les groupes de documents
- les dossiers imbriqués
- les documents markdown
- les diagrammes Mermaid
- les blocs mathématiques
- la recherche de documents
- les backlinks et références
- la vue graphe
- l'utilisation de documents sélectionnés comme contexte de chat

### Pipeline

Le module Pipeline prend actuellement en charge :

- les workflows multi-agents en plusieurs étapes
- les retries et stratégies de backoff par étape
- les timeouts par étape
- l'exécution conditionnelle avec `runIf`
- les transformations de sortie et les variables exportées
- les budgets de durée totale, de tokens totaux et de nombre d'étapes
- l'aperçu Mermaid et l'export du code source
- l'historique d'exécution et le détail des étapes
- l'enregistrement, l'import et l'export

Le chat prend aussi en charge des commandes `/pipeline`, par exemple :

- `/pipeline list`
- `/pipeline run <name-or-id>`
- `/pipeline status`
- `/pipeline history <name-or-id>`
- `/pipeline cancel`

### Timer

Les types de minuterie actuels sont :

- Once
- Interval
- Cron

Les actions actuelles sont :

- notification bureau
- exécuter un prompt d'agent
- exécuter un pipeline enregistré

## 8. Channels et MCP

### Plateformes de canaux prises en charge

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

### Ce que le module Channels prend actuellement en charge

- transport webhook ou stream
- affectation d'un agent de réponse par canal
- activation ou désactivation de la réponse automatique
- liste blanche de chats autorisés
- historique des messages
- liste des utilisateurs suivis
- vue de santé
- vue de débogage

### MCP

Le module MCP sert actuellement à :

- ajouter des configurations de serveur
- modifier des configurations de serveur
- vérifier l'état de connexion
- exposer les capacités MCP aux agents

## 9. Réglages, sécurité et données

Les sections de réglages actuelles sont :

- General
- Security
- Voice
- Shortcuts
- Data
- Logs
- System

### Fonctions importantes actuellement disponibles

- thème, langue, polices et couleur d'accent
- démarrage automatique
- configuration du proxy
- réglages SMTP et test de connexion
- gestionnaire de variables d'environnement
- politique de confirmation des outils
- mode sandbox du système de fichiers
- liste des répertoires autorisés
- motifs shell bloqués
- préférences vocales
- gestion des raccourcis
- import et export
- politique de rétention
- journaux et historique des plantages
- métriques d'exécution
- relancer l'onboarding

### Clés API et stockage sécurisé

L'implémentation actuelle tente d'abord de stocker les clés API dans le stockage sécurisé du système d'exploitation.

Si le keyring système n'est pas disponible ou si le chiffrement échoue, Suora avertit que :

- les clés restent uniquement en mémoire
- elles doivent être saisies à nouveau après redémarrage

### Ce que l'export inclut actuellement

- les agents personnalisés
- les compétences personnalisées
- toutes les sessions
- les configurations de fournisseurs
- les réglages des répertoires externes

## 10. Dépannage

### La connexion du modèle échoue

Vérifiez dans cet ordre :

1. la clé API est valide
2. la Base URL correspond bien au fournisseur
3. au moins un modèle est activé
4. le proxy ne bloque pas la requête
5. le test de connexion dans Models réussit

### Un canal ne reçoit aucun message

Vérifiez dans cet ordre :

1. le canal est activé
2. l'agent de réponse existe encore et est activé
3. le serveur local des canaux fonctionne pour les canaux webhook
4. l'URL de callback côté plateforme correspond exactement à celle de Suora
5. le chat actuel n'est pas bloqué par `allowedChats`
6. la vue Health ou Debug ne montre pas d'erreur d'identifiants

### Une compétence ne semble pas active

Vérifiez dans cet ordre :

1. la compétence est activée
2. la compétence nécessaire est assignée à l'agent
3. la compétence a bien été importée dans l'espace de travail actuel ou un répertoire externe
4. le contenu est un `SKILL.md` valide

### Une minuterie ne se déclenche pas

Vérifiez dans cet ordre :

1. la minuterie est activée
2. l'expression Cron est valide
3. l'agent ou le pipeline cible existe toujours
4. l'application de bureau est en cours d'exécution

## 11. Première session recommandée

Si vous découvrez la version actuelle, cet ordre fonctionne bien :

1. ajoutez un fournisseur et activez un modèle dans `Models`
2. parcourez les agents intégrés dans `Agents`
3. démarrez votre première conversation dans `Chat`
4. créez un groupe de documents dans `Documents`
5. enregistrez un workflow de deux ou trois étapes dans `Pipeline`
6. planifiez-le depuis `Timer`
7. configurez `Channels` ou `MCP` quand le flux local est déjà stable