# Suora �?Guide de l'utilisateur

Bienvenue dans **Suora**, une application de bureau alimentée par l'IA qui apporte intelligence multi-modèle, automatisation et extensibilité à votre flux de travail quotidien. Ce guide couvre tout ce dont vous avez besoin pour démarrer et tirer le meilleur parti de l'application.

---

## Table des matières

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Premiers pas](#premiers-pas)
4. [Chat](#chat)
5. [Modèles d'IA](#modèles-dia)
6. [Agents](#agents)
7. [Compétences](#compétences)
8. [Minuteries et planification](#minuteries-et-planification)
9. [Canaux](#canaux)
10. [Paramètres](#paramètres)
11. [Base de connaissances et mémoire](#base-de-connaissances-et-mémoire)
12. [Sécurité et confidentialité](#sécurité-et-confidentialité)
13. [Raccourcis clavier](#raccourcis-clavier)
14. [Dépannage](#dépannage)
15. [FAQ](#faq)

---

## Introduction

Suora est une application Electron multiplateforme qui vous permet d'interagir avec les principaux modèles d'IA �?Anthropic Claude, OpenAI GPT, Google Gemini et bien d'autres �?à travers une interface de chat unifiée. Au-delà de simples conversations, l'application propose des agents intelligents spécialisés dans le développement, la rédaction, la recherche et le DevOps ; un riche système de compétences pour les opérations sur les fichiers, l'automatisation du navigateur, l'e-mail et git ; des tâches planifiées ; des intégrations avec des plateformes de messagerie ; et un système de mémoire persistante permettant à votre IA de conserver le contexte entre les sessions.

Que vous soyez développeur à la recherche d'un copilote de programmation, rédacteur en quête d'assistance créative ou utilisateur avancé souhaitant automatiser des tâches répétitives, Suora s'adapte à vos besoins.

---

## Installation

### Configuration requise

| Plateforme | Version minimale |
|------------|-----------------|
| Windows    | Windows 10 ou ultérieur |
| macOS      | macOS 11 (Big Sur) ou ultérieur |
| Linux      | Ubuntu 20.04 / Fedora 34 ou équivalent |

### Téléchargement

1. Rendez-vous sur la page **GitHub Releases** du dépôt Suora.
2. Téléchargez l'installateur correspondant à votre plateforme :
   - **Windows** �?installateur `.exe`
   - **macOS** �?image disque `.dmg`
   - **Linux** �?paquet `.AppImage` ou `.deb`
3. Lancez l'installateur et suivez les instructions à l'écran.

### Compilation depuis les sources

```bash
git clone https://github.com/fandych/suora.git
cd suora
npm install
npm run build
npm run package
```

---

## Premiers pas

Lorsque vous lancez l'application pour la première fois, un **assistant de configuration en 5 étapes** vous guide à travers la mise en place initiale :

1. **Bienvenue** �?Une brève présentation de l'application.
2. **Configurer un fournisseur de modèle** �?Saisissez votre clé API pour au moins un fournisseur (par ex. OpenAI, Anthropic).
3. **Découvrez vos agents** �?Aperçu des agents spécialisés intégrés.
4. **Explorez les compétences** �?Découvrez les capacités disponibles pour vos agents.
5. **C'est prêt !** �?Commencez à discuter immédiatement.

> Vous pouvez ignorer l'assistant et tout configurer ultérieurement depuis les **Paramètres**.

---

## Chat

L'interface de chat est le cœur de Suora.

### Démarrer une nouvelle conversation

- Cliquez sur le bouton **�?* dans la barre latérale ou appuyez sur `Ctrl + N` (`Cmd + N` sur macOS).
- Chaque conversation est une session indépendante avec son propre historique.

### Envoyer des messages

- Tapez votre message et appuyez sur **Entrée** pour l'envoyer.
- Utilisez **Maj + Entrée** pour insérer un saut de ligne dans un message.
- Joignez des images ou des fichiers à l'aide du bouton de pièce jointe.

### Fonctionnalités des messages

- **Réponses en streaming** �?Les réponses de l'IA s'affichent mot par mot en temps réel.
- **Rendu Markdown** �?Blocs de code avec coloration syntaxique, tableaux, listes et plus encore.
- **Indicateurs d'exécution d'outils** �?Lorsque l'IA invoque une compétence, des icônes d'état s'affichent : en attente (�?, en cours (�?, succès (�?, erreur (�?, ainsi que la durée d'exécution.
- **Retour d'information** �?Évaluez tout message de l'assistant avec 👍 ou 👎.
- **Utilisation des tokens** �?Chaque réponse affiche le nombre de tokens consommés.
- **Saisie vocale** �?Appuyez sur `Ctrl + Maj + V` pour dicter un message.

### Palette de commandes

Appuyez sur `Ctrl + K` pour ouvrir la palette de commandes permettant de naviguer rapidement, changer d'agent, activer ou désactiver des compétences, et bien plus.

---

## Modèles d'IA

Suora prend en charge un large éventail de fournisseurs d'IA.

### Fournisseurs pris en charge

| Fournisseur | Exemples de modèles |
|-------------|-------------------|
| Anthropic | Claude 3.5 Sonnet, Claude 3 Opus |
| OpenAI | GPT-4o, GPT-4 Turbo |
| Google Vertex AI | Gemini 1.5 Pro, Gemini 1.5 Flash |
| Ollama | Llama 3, Mistral (local) |
| DeepSeek | DeepSeek Coder, DeepSeek Chat |
| Groq | Mixtral, LLaMA (inférence rapide) |
| Together AI | Divers modèles open source |
| Fireworks AI | Divers modèles open source |
| Perplexity | Modèles Sonar |
| Cohere | Command R+ |
| Compatible OpenAI | Tout point de terminaison compatible |

### Ajouter un fournisseur

1. Accédez à **Paramètres �?Fournisseurs de modèles**.
2. Cliquez sur **Ajouter un fournisseur** et choisissez un type de fournisseur.
3. Entrez votre **clé API** et définissez éventuellement une **URL de base**.
4. Cliquez sur **Tester la connexion** pour vérifier.
5. Sélectionnez les modèles que vous souhaitez utiliser.

### Configuration par modèle

Chaque modèle peut avoir ses propres paramètres de **température** (créativité) et de **nombre maximal de tokens** (longueur de la réponse).

---

## Agents

Les agents sont des personnalités d'IA spécialisées avec des instructions système, des ensembles de compétences et des styles de réponse distincts.

### Agents intégrés

| Agent | Idéal pour | Température |
|-------|-----------|-------------|
| 🤖 Assistant | Tâches générales | 0.7 |
| 🧑‍�?Expert en code | Revue de code, débogage | 0.5 |
| ✍️ Rédacteur | Articles, documentation | 0.8 |
| 📚 Chercheur | Recherche, vérification des faits | 0.6 |
| 📊 Analyste de données | Jeux de données, tendances | 0.5 |
| 🚀 Ingénieur DevOps | CI/CD, automatisation | 0.4 |
| 🛡�?Auditeur en sécurité | Analyse de vulnérabilités | 0.3 |
| 🌐 Traducteur | Traduction, relecture | 0.3 |
| 📱 Chef de produit | Spécifications, user stories | 0.6 |

### Créer un agent personnalisé

1. Accédez au panneau **Agents**.
2. Cliquez sur **Créer un agent**.
3. Définissez un **nom**, une **instruction système**, un **style de réponse** (concis / équilibré / détaillé) et une **température**.
4. Attribuez les compétences auxquelles l'agent doit avoir accès.
5. Enregistrez.

Les agents prennent également en charge l'**auto-apprentissage** : ils peuvent stocker des informations en mémoire au fil des conversations.

---

## Compétences

Les compétences sont des outils que les agents peuvent invoquer pendant les conversations.

### Catégories de compétences intégrées (18+)

| Catégorie | Exemples |
|-----------|---------|
| 📁 Système de fichiers | Lire, écrire, modifier, rechercher, copier, déplacer des fichiers |
| 🖥�?Shell | Exécuter des commandes shell |
| 🌐 Web | Rechercher sur le web, récupérer des pages, ouvrir des URLs |
| 🔧 Utilitaires | Presse-papiers, notifications, captures d'écran, informations système |
| 📋 Tâches | Gérer des listes de tâches |
| �?Minuterie | Créer et gérer des minuteries |
| 🧠 Mémoire | Stocker, rechercher et gérer les mémoires |
| 🌍 Automatisation du navigateur | Naviguer, cliquer, remplir des formulaires, extraire du texte |
| 🤝 Communication entre agents | Déléguer des tâches entre agents |
| �?Automatisation événementielle | Déclencheurs sur modification de fichiers et planification |
| 🧬 Auto-évolution | Créer et améliorer des compétences dynamiquement |
| 📎 Pièces jointes | Lire les fichiers joints |
| 🔀 Git | Status, diff, log, commit, stage |
| 🔬 Analyse de code | Analyser la structure, trouver des motifs |
| 🎯 Interaction avancée | Invites interactives, exécution en boucle |
| 📱 Canaux | Démarrer/arrêter des serveurs webhook, envoyer des messages |
| 📧 E-mail | Envoyer des e-mails via SMTP |
| ⚙️ Gestion du système | Changer de modèle/session, gérer les plugins |

### Activer / Désactiver des compétences

Ouvrez **Paramètres �?Compétences** ou utilisez la palette de commandes (`Ctrl + K`) pour activer ou désactiver des compétences individuellement. Désactiver une compétence empêche tous les agents de l'invoquer.

### Marketplace

Parcourez les compétences contribuées par la communauté depuis le **Marketplace de compétences** et installez-les en un clic. Les compétences personnalisées sont chargées depuis des répertoires externes tels que `~/.agents/skills`.

---

## Minuteries et planification

Automatisez les tâches récurrentes en créant des minuteries.

### Types de minuteries

| Type | Description | Exemple |
|------|-------------|---------|
| **Une fois** | Se déclenche une seule fois à une date/heure précise | « Me rappeler à 15h aujourd'hui » |
| **Intervalle** | Se répète toutes les N minutes | Toutes les 30 minutes |
| **Cron** | Planification récurrente avancée | `0 9 * * 1-5` (9h en semaine) |

### Créer une minuterie

1. Ouvrez le panneau **Minuterie**.
2. Cliquez sur **Ajouter une minuterie**.
3. Choisissez le type de minuterie et configurez la planification.
4. Définissez l'action : **Notifier** (notification de bureau) ou **Interroger l'agent** (exécuter une invite).
5. Enregistrez. L'application affiche les 5 prochaines exécutions en aperçu.

### Référence des expressions Cron

```
┌───────────── minute (0-59)
�?┌───────────── heure (0-23)
�?�?┌───────────── jour du mois (1-31)
�?�?�?┌───────────── mois (1-12)
�?�?�?�?┌───────────── jour de la semaine (0-6, Dim=0)
�?�?�?�?�?
* * * * *
```

Exemples courants :
- `*/15 * * * *` �?Toutes les 15 minutes
- `0 */2 * * *` �?Toutes les 2 heures
- `30 8 * * 1` �?Lundi à 8h30
- `0 0 1 * *` �?Minuit le 1er de chaque mois

---

## Canaux

Connectez Suora à des plateformes de messagerie pour des réponses automatisées.

### Plateformes prises en charge

- **WeChat** �?La principale application de messagerie en Chine
- **Feishu (Lark)** �?La suite collaborative de Bytedance
- **DingTalk** �?Le messager d'entreprise d'Alibaba

### Configurer un canal

1. Accédez à **Canaux** dans la barre latérale.
2. Sélectionnez une plateforme et entrez les identifiants requis (App ID, App Secret, jeton de vérification, clé de chiffrement).
3. Choisissez le mode de connexion **Webhook** ou **Stream**.
4. Activez la **Réponse automatique** si vous souhaitez que l'IA réponde automatiquement.
5. Restreignez éventuellement à des groupes de discussion spécifiques.

L'application affiche l'état de la connexion, la latence et l'historique des messages (jusqu'à 500 messages).

---

## Paramètres

Accédez aux paramètres via l'icône d'engrenage dans la barre latérale.

### Général

- **Thème** �?Clair, Sombre ou Système (suit les préférences de l'OS).
- **Langue** �?English, 中文, 日本�? 한국�? Français, Deutsch, Español, Português, Русский, العربية.
- **Démarrage automatique** �?Lancer Suora au démarrage de l'ordinateur.
- **Sauvegarde automatique** �?Enregistrer automatiquement les sessions de chat.
- **Espace de travail** �?Choisir un répertoire pour les données de l'application.

### Apparence

- **Taille de police** �?Petite, Moyenne, Grande.
- **Police de code** �?Fira Code, JetBrains Mono, Source Code Pro, Cascadia Code, Consolas ou par défaut.
- **Style de bulle** �?Par défaut, Minimaliste, Bordé, Glassmorphism.
- **Couleur d'accentuation** �?Choisissez une couleur de surbrillance pour l'interface.

### Voix

- **Activer la voix** �?Activer/désactiver la reconnaissance et la synthèse vocales.
- **Langue** �?Code BCP 47 (par ex. `en-US`, `zh-CN`).
- **Débit / Hauteur / Volume de la voix** �?Ajustez finement la sortie vocale.
- **Envoi automatique** �?Envoyer automatiquement le message une fois la reconnaissance vocale terminée.

### Proxy

- **Activer le proxy** �?Acheminer le trafic via un proxy HTTP, HTTPS ou SOCKS5.
- Configurez l'**hôte**, le **port** et l'authentification optionnelle.

### E-mail (SMTP)

- Configurez un serveur SMTP pour envoyer des e-mails via la compétence E-mail.
- Champs : hôte, port, sécurisé (TLS/STARTTLS), nom d'utilisateur, mot de passe, nom de l'expéditeur et adresse de l'expéditeur.

### Gestion des données

- **Conservation de l'historique** �?Nombre de jours de conservation de l'historique des conversations (0 = illimité).
- **Effacer l'historique** �?Supprimer toutes les sessions de chat.
- **Exporter / Importer** �?Sauvegarder et restaurer les agents, compétences, sessions et fournisseurs sous forme de fichier JSON.

---

## Base de connaissances et mémoire

Suora dispose d'un système de mémoire en couches qui fournit un contexte persistant à votre IA.

### Types de mémoire

| Type | Objectif |
|------|---------|
| Observation | Conclusions ou découvertes importantes |
| Préférence | Préférences utilisateur et personnalisation |
| Correction | Erreurs à éviter |
| Connaissance | Faits généraux |

### Portées de la mémoire

- **Session** �?Existe uniquement dans la session de chat en cours.
- **Globale** �?Persiste à travers toutes les sessions et tous les agents.

### Utiliser la mémoire

Les agents peuvent automatiquement stocker et rappeler des mémoires pendant les conversations. Vous pouvez également gérer la mémoire manuellement :

- **Stocker** �?Enregistrer un fait via la compétence `memory_store`.
- **Rechercher** �?Recherche sémantique dans toutes les mémoires avec `memory_search`.
- **Lister** �?Filtrer par type ou portée avec `memory_list`.
- **Supprimer** �?Supprimer des entrées avec `memory_delete`.

### Mémoire vectorielle

Pour les cas d'utilisation avancés, Suora inclut un index vectoriel en mémoire qui permet la recherche par similarité sémantique dans votre base de connaissances.

---

## Sécurité et confidentialité

### Politiques d'exécution des outils

- **Répertoires autorisés** �?Restreignez les opérations sur les fichiers à une liste blanche de répertoires.
- **Commandes bloquées** �?Les commandes dangereuses (`rm -rf`, `format`, `shutdown`, etc.) sont bloquées par défaut.
- **Invites de confirmation** �?Exigez optionnellement l'approbation de l'utilisateur avant toute exécution d'outil.

### Intégrité des compétences

- Les compétences sont vérifiées à l'aide de **hachages SHA-256** et de signatures cryptographiques.
- Le système d'audit détecte les motifs de code dangereux tels que `eval()`, `Function()` et `require()`.

### Journalisation d'audit

Chaque exécution d'outil est journalisée avec :
- Horodatage, nom de l'outil, statut et durée
- Données d'entrée/sortie
- Enregistrements des erreurs et des commandes bloquées

Le journal d'audit stocke jusqu'à 10 000 entrées et peut être exporté en JSON. Un tableau de bord affiche les statistiques d'exécution des dernières 24 heures.

---

## Raccourcis clavier

| Action | Windows / Linux | macOS |
|--------|----------------|-------|
| Nouvelle conversation | `Ctrl + N` | `Cmd + N` |
| Palette de commandes | `Ctrl + K` | `Cmd + K` |
| Envoyer un message | `Entrée` | `Entrée` |
| Nouvelle ligne | `Maj + Entrée` | `Maj + Entrée` |
| Saisie vocale | `Ctrl + Maj + V` | `Cmd + Maj + V` |
| Basculer la barre latérale | `Ctrl + B` | `Cmd + B` |
| Fermer le panneau | `Échap` | `Échap` |

Tous les raccourcis sont personnalisables dans **Paramètres �?Raccourcis clavier**.

---

## Dépannage

### L'application ne démarre pas

- Assurez-vous que votre système répond à la configuration minimale requise.
- Sous Linux, vérifiez que l'AppImage possède les permissions d'exécution : `chmod +x Suora.AppImage`.
- Consultez les journaux de l'application dans `~/.suora/logs/`.

### Les réponses de l'IA sont vides ou échouent

- Vérifiez que votre clé API est valide dans **Paramètres �?Fournisseurs de modèles**.
- Cliquez sur **Tester la connexion** pour diagnostiquer les problèmes de connectivité.
- Si vous êtes derrière un pare-feu d'entreprise, configurez un proxy dans **Paramètres �?Proxy**.

### Les compétences ne s'exécutent pas

- Vérifiez que la compétence est activée dans **Paramètres �?Compétences**.
- Consultez **Sécurité �?Répertoires autorisés** si une opération sur un fichier est bloquée.
- Examinez le **Journal d'audit** pour les détails des erreurs.

### La minuterie ne se déclenche pas

- Assurez-vous que la minuterie est activée (**on**).
- Vérifiez votre expression cron à l'aide du panneau d'aperçu (il affiche les 5 prochaines exécutions).
- L'application doit être en cours d'exécution pour que les minuteries se déclenchent (fréquence de vérification : toutes les 15 secondes).

### Utilisation élevée de la mémoire

- Réduisez la **Conservation de l'historique** dans les Paramètres.
- Supprimez les anciennes sessions de chat.
- Désactivez les compétences et agents inutilisés.

---

## FAQ

**Q : Mes données sont-elles envoyées à des serveurs tiers ?**
R : Les conversations sont envoyées uniquement au fournisseur d'IA que vous configurez (par ex. OpenAI, Anthropic). Aucune donnée n'est transmise à l'équipe Suora.

**Q : Puis-je utiliser des modèles locaux ?**
R : Oui. Ajoutez un fournisseur **Ollama** et pointez-le vers votre instance Ollama locale.

**Q : Comment réinitialiser l'application ?**
R : Supprimez le répertoire `~/.suora/` et relancez l'application.

**Q : Puis-je utiliser plusieurs fournisseurs d'IA en même temps ?**
R : Absolument. Ajoutez autant de fournisseurs que vous le souhaitez et basculez entre les modèles en cours de conversation.

**Q : Où sont stockées mes sessions de chat ?**
R : Localement sur votre ordinateur dans le répertoire de l'espace de travail (par défaut : `~/.suora/`).

**Q : Comment créer une compétence personnalisée ?**
R : Utilisez la compétence **Auto-évolution** (`skill_create`) pour générer dynamiquement de nouvelles compétences, ou placez un fichier de définition de compétence dans `~/.agents/skills/`.

**Q : Existe-t-il une version mobile ?**
R : Suora est actuellement disponible uniquement pour Windows, macOS et Linux.

**Q : Comment signaler un bug ?**
R : Ouvrez un ticket sur le dépôt GitHub avec les étapes de reproduction et les informations de votre système.

---

*Merci d'utiliser Suora ! Si vous avez des suggestions ou des commentaires, n'hésitez pas à nous en faire part sur GitHub.*
