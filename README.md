# Colorz Bot

Bot Discord écrit en TypeScript avec [discord.js](https://discord.js.org) v14
(slash commands, boutons, ESM/NodeNext). Il fournit un système de tickets
complet, des messages d'arrivée, et une commande de configuration centralisée.

## Fonctionnalités

### 🎫 Système de tickets

- **Panneau configurable** avec un message pré-fait et des boutons.
- **Deux types de tickets** : `Support` (questions/aide) et `Passer commande`.
- **Questionnaire de projet** sur `Passer commande` : au clic, un **formulaire**
  (modal) récolte les infos clés — nom du projet, objectif, budget, équipe &
  taille du Discord, ce qui a déjà été essayé. À l'envoi, le salon est créé avec
  un **récapitulatif propre** (visible aussi dans les logs).
- **Conversation guidée** ensuite : le bot **ping le membre**, explique la
  procédure, puis lui pose **3 questions une par une** (une réponse → la question
  suivante). Quand tout est répondu, il **remercie le membre et ping le staff**
  pour la prise en charge. L'état est **persisté** (survit à un redémarrage) et
  ça ne lit **pas** le contenu des messages — donc aucun intent privilégié requis.
- **Salons privés** : seuls le créateur, le rôle staff et le bot y ont accès.
- **Un seul ticket ouvert par type et par membre** (anti-spam).
- **Bouton de fermeture** qui supprime le salon après 5 secondes.
- **Salon de logs** : notification à chaque ouverture (🟢) et fermeture (🔴).
- **Transcript HTML** : à la fermeture, un fichier `.html` stylé (façon Discord,
  avec avatars, couleurs, images) reprenant toute la conversation est joint au
  log de fermeture.

### 🔨 Modération

- Commandes de sanction : `warn`, `warnings`, `note`, `kick`, `ban`, `tempban`,
  `unban`, `banlist`, `mute`, `unmute`, `clear`.
- Commandes rôles/salons : `addrole`, `delrole`, `nick`, `lock`, `unlock`,
  `hide`, `unhide`.
- **Historique persistant** : chaque sanction est enregistrée en *case*
  numérotée (consultable via `/warnings`).
- **Salon de logs de modération** configurable : chaque action y est publiée.
- **Sécurités** : vérification de la hiérarchie des rôles, notification DM du
  membre sanctionné, expiration **automatique** des `tempban` (rétabli au
  redémarrage). `mute`/`unmute` utilisent le timeout natif de Discord.

### 🔗 Anti-liens

- Supprime les liens postés par les membres **sans permission**, avec un
  avertissement auto-effacé et un log dans le salon de modération.
- **Autorisé dans les tickets** : chacun peut y partager un lien (ex : le Discord
  de son projet, un dépôt, une maquette).
- **Exemptions** : membres avec *Gérer les messages*, rôles et salons autorisés
  (configurables), et **domaines en liste blanche**.
- **Détection conservatrice** pensée pour une communauté de dev : seules les
  vraies URL sont ciblées (`http(s)://`, `www.`, `domaine.tld/chemin`) — des
  mentions comme `discord.js` ou `index.ts` ne sont **pas** bloquées.
- ⚠️ Nécessite l'intent **privilégié MessageContent** (voir *Prérequis Discord*) :
  sans lui, le contenu des messages est vide et rien n'est filtré.

### 🛡️ Protection anti-raid

- **Détection de vague de connexions** : X arrivées en Y secondes → **mode raid**
  activé (verrouillage temporaire configurable).
- **Filtre d'âge de compte (pendant un raid)** : quand le mode raid est actif,
  seuls les comptes plus récents que le seuil sont sanctionnés — les comptes
  anciens (vrais membres pris dans la vague) sont épargnés. Sans seuil, tous les
  arrivants sont filtrés pendant le raid.
- **Action configurable** pendant un raid ou un verrouillage : `kick`, `ban`, ou
  `alert` (alerte seulement, sans sanction).
- **Alertes** dans un salon dédié avec **ping d'un rôle** (staff).
- **Verrouillage manuel** (`/goat-raid lockdown` / `unlock`) et **statut** en
  temps réel (`/goat-raid status`).
- S'appuie sur l'événement d'arrivée existant : **aucun intent supplémentaire**
  (utilise `GuildMembers`, déjà requis). Le bot doit avoir **Expulser** et/ou
  **Bannir des membres** selon l'action choisie.

### 🔐 Permissions granulaires

- Couche d'autorisation **interne**, par-dessus les permissions Discord.
- **Bypass** : rôles/membres qui contournent toutes les règles (accès total).
- **Grants par commande** : liste blanche — une fois une commande configurée,
  seuls les rôles/membres autorisés (et bypass/admins) peuvent l'utiliser.
- **Groupes** : bundles de commandes assignables à des rôles/membres.
- Owner et Administrateurs contournent toujours ces règles (anti-lockout).
- Si une commande n'a **aucune** config interne, on laisse passer : ce sont les
  permissions Discord natives qui s'appliquent.

### 🏆 Système de niveaux

- Les membres gagnent de l'**XP** en discutant (XP moyen configurable, jitter
  ±25 %, avec un **cooldown** anti-spam par membre).
- **Courbe de progression** façon MEE6 : `5·niv² + 50·niv + 100` XP pour passer
  au niveau suivant.
- **Annonces de passage de niveau** (activables) dans un salon dédié ou dans le
  salon courant.
- **Rôles récompenses** attribués automatiquement à des paliers de niveau, avec
  choix entre **cumul** des rôles ou conserver uniquement le **plus haut**.
- **Exclusions** : salons et rôles peuvent être exclus du gain d'XP (via le
  store).
- `/level` (carte de niveau + rang) et `/leaderboard` (top 10) pour les membres ;
  `/goat-levels` pour la gestion admin (récompenses, XP, reset).
- Ne nécessite **que** l'intent non privilégié `GuildMessages` (le contenu des
  messages n'est pas lu, seul le fait qu'un message a été envoyé compte).

### 🖼️ Éditeur d'embed

- **`/embed`** ouvre un éditeur **interactif** (message éphémère) avec **aperçu
  en direct** et des boutons pour régler chaque partie : contenu (titre,
  description, lien), couleur, images (grande + miniature), auteur/footer +
  horodatage, et **champs** (ajout / vidage).
- **Import** d'un embed existant — via l'option `/embed message:<lien>` ou le
  bouton *Importer* — pour le reprendre et le modifier.
- **Destinations** : envoi dans un **salon** (sélecteur), en **MP**, ou
  **édition d'un message existant du bot** (le bot ne peut éditer que ses
  propres messages).
- Réservé aux admins (permission « Gérer le serveur »).

### 👋 Messages d'arrivée

- Embed de bienvenue posté dans un salon configurable à chaque nouveau membre.
- Message personnalisable avec les variables `{user}`, `{username}`,
  `{server}`, `{count}`. Un message par défaut est utilisé si aucun n'est défini.

### ⚙️ Configuration centralisée (`/goat-config`)

- Toute la config (tickets, arrivées) est stockée par serveur dans
  `data/config.json` et modifiable à chaud — les changements s'appliquent
  immédiatement, sans republier les messages.
- `/goat-config display` liste les panneaux actifs et permet de les **supprimer
  proprement** d'un bouton (le message et son entrée dans le store sont retirés).

### 🔧 Cycle de vie des panneaux (maintenance)

- À l'**arrêt propre** du bot, chaque panneau publié passe en mode maintenance
  (bannière grise + boutons désactivés).
- Au **redémarrage**, les panneaux repassent en actif **en place** (édités, pas
  republiés) et reprennent le contenu à jour du code.

## Commandes

### `/ping`

Répond « Pong » avec la latence.

### `/help`

Aide auto-documentée. Option `category` : `Général` (défaut), `Modération`
(sanctions, rôles, salons, formats de durée), `Niveaux` (XP, récompenses),
`Configuration` (goat-config + goat-perms). Ex : `/help category:Modération`.

### 🏆 Niveaux *(pour tout le monde)*

| Commande | Options | Description |
|---|---|---|
| `level` | `member` | Affiche le niveau, l'XP et le rang (le tien par défaut). |
| `leaderboard` | — | Top 10 des membres par XP. |

### `/goat-levels` *(réservé aux admins — permission « Gérer le serveur »)*

| Sous-commande | Options | Rôle |
|---|---|---|
| `add-reward` | `level` *(requis)*, `role` *(requis)* | Attribue un rôle récompense à un palier |
| `remove-reward` | `level` *(requis)* | Retire la récompense d'un palier |
| `rewards` | — | Liste les rôles récompenses configurés |
| `set` | `member` *(requis)*, `level` *(requis)* | Fixe le niveau d'un membre |
| `give` | `member` *(requis)*, `amount` *(requis)* | Ajoute/retire de l'XP (amount négatif = retire) |
| `reset` | `member` | Réinitialise un membre (ou tout le serveur si vide) |

### `/goat-raid` *(réservé aux admins — permission « Gérer le serveur »)*

| Sous-commande | Options | Rôle |
|---|---|---|
| `lockdown` | — | Active le verrouillage manuel (filtre tous les arrivants) |
| `unlock` | — | Lève le verrouillage manuel |
| `status` | — | Affiche l'état de la protection et sa configuration |

### Modération *(permissions Discord requises par commande)*

| Commande | Options | Permission |
|---|---|---|
| `warn` | `member` *(requis)*, `reason` | Modérer les membres |
| `warnings` | `member` *(requis)* | Modérer les membres |
| `note` | `member` *(requis)*, `content` *(requis)* | Modérer les membres |
| `kick` | `member` *(requis)*, `reason` | Expulser des membres |
| `ban` | `user` *(requis)*, `reason`, `delete_days` | Bannir des membres |
| `tempban` | `user` *(requis)*, `duration` *(requis)*, `reason` | Bannir des membres |
| `unban` | `user` *(requis)*, `reason` | Bannir des membres |
| `banlist` | — | Bannir des membres |
| `mute` | `member` *(requis)*, `duration`, `reason` | Modérer les membres |
| `unmute` | `member` *(requis)*, `reason` | Modérer les membres |
| `clear` | `amount` *(requis, 1-100)*, `member` | Gérer les messages |
| `addrole` | `member` *(requis)*, `role` *(requis)* | Gérer les rôles |
| `delrole` | `member` *(requis)*, `role` *(requis)* | Gérer les rôles |
| `nick` | `member` *(requis)*, `nickname` | Gérer les pseudos |
| `lock` / `unlock` | `channel`, `reason` | Gérer les salons |
| `hide` / `unhide` | `channel`, `reason` | Gérer les salons |

Formats de durée acceptés : `30s`, `10m`, `2h`, `7d`, `1w` (mute plafonné à 28j).
`lock`/`hide` agissent sur le salon courant si aucun `channel` n'est précisé.

### `/goat-perms` *(réservé aux admins — permission « Gérer le serveur »)*

| Sous-commande | Options | Rôle |
|---|---|---|
| `allow` | `command` *(requis)*, `role`, `member` | Autorise un rôle/membre sur une commande |
| `disallow` | `command` *(requis)*, `role`, `member` | Retire l'autorisation |
| `bypass` | `remove`, `role`, `member` | Ajoute/retire du bypass total |
| `group create` | `name` *(requis)*, `commands` *(requis, CSV)* | Crée/remplace un groupe de commandes |
| `group delete` | `name` *(requis)* | Supprime un groupe |
| `group assign` | `name` *(requis)*, `role`, `member` | Assigne un groupe |
| `group unassign` | `name` *(requis)*, `role`, `member` | Retire un groupe |
| `display` | — | Affiche les permissions configurées |

> Limite : la couche interne **restreint** (liste blanche) et gère le **bypass**
> parmi les membres qui voient déjà la commande. Elle ne peut pas rendre visible
> une commande masquée par les permissions Discord natives.

### `/embed [message]` *(réservé aux admins — permission « Gérer le serveur »)*

Éditeur d'embed interactif. Option `message` : lien d'un message du bot à
importer pour l'éditer. L'éditeur permet ensuite d'envoyer dans un salon, en MP,
ou d'écraser un message existant du bot.

### `/goat-config` *(réservé aux admins — permission « Gérer le serveur »)*

| Sous-commande | Options | Rôle |
|---|---|---|
| `tickets` | `staff_role`, `category`, `logs_channel`, `panel_channel`, `title`, `description` | Configure les tickets et publie le panneau (via `panel_channel`) |
| `welcome` | `channel` *(requis)*, `message` | Configure le salon et le message d'arrivée |
| `moderation` | `logs_channel` *(requis)* | Configure le salon de logs de modération |
| `levels` | `enabled`, `xp_per_message`, `cooldown`, `announce`, `announce_channel`, `stack_rewards` | Configure le système de niveaux |
| `raid` | `enabled`, `join_threshold`, `join_window`, `action`, `min_account_age`, `lockdown_minutes`, `alert_channel`, `alert_role` | Configure la protection anti-raid |
| `antilink` | `enabled`, `allow_role`, `allow_channel`, `whitelist`, `remove` | Configure le filtre anti-liens (add/remove via `remove`) |
| `display` | — | Affiche la configuration et la liste des panneaux actifs, avec un bouton 🗑️ pour supprimer proprement chaque panneau (message + entrée) |

Exemples :

```
/goat-config tickets staff_role:@Staff category:Tickets logs_channel:#logs panel_channel:#support
/goat-config welcome channel:#bienvenue message:Bienvenue {user} sur {server} 🎉
/goat-config levels enabled:true xp_per_message:20 cooldown:60 announce_channel:#niveaux
/goat-levels add-reward level:5 role:@Actif
/goat-config raid enabled:true join_threshold:5 join_window:10 action:kick alert_channel:#alertes alert_role:@Staff
/goat-config display
```

## Prérequis Discord

1. **Application + bot** sur le
   [Discord Developer Portal](https://discord.com/developers/applications) :
   - **Bot → Reset Token** → `DISCORD_TOKEN`
   - **General Information → Application ID** → `CLIENT_ID`
2. **Intents privilégiés** (**Bot → Privileged Gateway Intents**), à **activer** :
   - **Server Members Intent** — messages d'arrivée + anti-raid. Sans lui, le bot
     plante au démarrage.
   - **Message Content Intent** — **filtre anti-liens** (lecture du contenu des
     messages). Sans lui, le contenu arrive vide et l'anti-liens ne filtre rien.

   *(Le système de niveaux utilise `GuildMessages`, non privilégié — rien de plus
   à activer pour lui.)*
3. **Permissions du bot** : au minimum **Manage Channels**, **Manage Roles**,
   **Manage Messages** (anti-liens), **View Channels**, **Send Messages**.
   Inviter via **OAuth2 → URL Generator** avec les scopes `bot` +
   `applications.commands`.

## Installation

```sh
cp .env.example .env      # puis remplir DISCORD_TOKEN, CLIENT_ID, GUILD_ID (recommandé)
npm install
```

## Commandes de développement

| Commande | Description |
|---|---|
| `npm run dev` | Lance le bot avec auto-reload (tsx watch). ⚠️ Sous le watcher, Ctrl+C tue le process trop vite pour l'arrêt propre. |
| `npm run dev:once` | Lance le bot sans watcher. À utiliser pour tester l'arrêt propre (Ctrl+C fait passer les panneaux en maintenance). |
| `npm run deploy` | Enregistre les slash commands auprès de Discord. **Obligatoire après toute modification du `data` d'une commande** (nom, description, options). |
| `npm run typecheck` | Vérifie les types sans compiler (`tsc --noEmit`). |
| `npm test` | Lance les tests unitaires (Vitest). `npm run test:watch` pour le mode veille. |
| `npm run build` | Compile `src/` vers `dist/`. |
| `npm start` | Lance le bot compilé depuis `dist/` (production ; nécessite `build`). |

Démarrage rapide en dev :

```sh
npm run deploy
npm run dev
```

## Architecture

Le code est organisé **par fonctionnalité** (*feature-based*) : l'infrastructure
partagée est dans `src/core/`, et chaque domaine est une tranche autonome sous
`src/features/<feature>/` qui regroupe **sa logique** et **ses commandes**.

```
src/
├─ index.ts             # entrée : client, routage des événements, arrêt propre
├─ config.ts            # lecture des variables d'environnement
├─ deploy-commands.ts   # script d'enregistrement des slash commands
├─ core/
│  ├─ command.ts        # type Command (data + execute)
│  ├─ command-loader.ts # loadCommands() : découverte récursive des dossiers commands/
│  └─ store.ts          # config persistée par serveur (data/config.json)
└─ features/
   ├─ general/          # commands/ : ping, help
   ├─ tickets/          # panel.ts · intake.ts · conversation.ts · transcript.ts · tickets.ts
   ├─ welcome/          # welcome.ts (messages d'arrivée)
   ├─ moderation/       # moderation.ts · sweeper.ts · commands/ (18 commandes)
   ├─ permissions/      # permissions.ts · commands/ (goat-perms)
   ├─ leveling/         # leveling.ts · commands/ (level, leaderboard, goat-levels)
   ├─ raid/             # raid.ts · commands/ (goat-raid)
   ├─ antilink/         # antilink.ts (filtre anti-liens)
   ├─ embed/            # editor.ts · commands/ (embed)
   └─ config/           # config-ui.ts · commands/ (goat-config)
```

## Tests

Tests unitaires avec **Vitest**, **colocalisés** avec le code (`src/**/*.spec.ts`,
exclus du build). Ils couvrent la **logique pure** — courbe d'XP, parsing des
durées, détection de liens, rendu des templates, parsing d'IDs/couleurs, et la
couche de permissions (store mocké). Les handlers Discord (boutons, modals,
création de salons, envois) ne sont pas testés en unitaire.

```sh
npm test            # lance la suite une fois
npm run test:watch  # mode veille
```

## Ajouter une commande

Créer un fichier dans le dossier `commands/` de la feature concernée (par ex.
`src/features/moderation/commands/`), qui exporte par défaut un `Command` (voir
`src/features/general/commands/ping.ts`). Il est **découvert automatiquement**
par le loader récursif. Lancer `npm run deploy` ensuite pour que Discord connaisse
la nouvelle commande.

Pour une **nouvelle feature**, créer `src/features/<nom>/` avec un `<nom>.ts`
(logique) et un dossier `commands/` (slash commands), puis brancher les
éventuels gestionnaires d'événements dans `src/index.ts`.
