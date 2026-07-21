# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — run the bot locally with auto-reload (tsx watch). Note: under the watcher, Ctrl+C hard-kills the child on Windows, so the graceful shutdown (panels → maintenance) has no time to run.
- `npm run dev:once` — run once without the watcher (`tsx src/index.ts`). Use this to test graceful shutdown: Ctrl+C here fires the SIGINT handler and flips panels to maintenance before exit.
- `npm run deploy` — register slash commands with Discord. **Must be run after changing any command's `data`** (name, description, or options); code-only changes to `execute` do not need it.
- `npm run typecheck` — type-check without emitting (`tsc --noEmit`). Use this to verify changes.
- `npm run build` — compile `src/` to `dist/` via `tsc`.
- `npm start` — run the compiled bot from `dist/` (production; requires `build` first).
- `npm test` — run the Vitest unit suite once (`vitest run`); `npm run test:watch` for watch mode.

### Tests

Unit tests use **Vitest** and live **colocated** with the code as `src/**/*.spec.ts` (excluded from the `tsc` build via `tsconfig.json`). They cover the **pure logic** — XP curve, duration parsing, link detection, template rendering, id/color/link parsing, and the permission layer (with the store mocked via `vi.mock`). Discord-side handlers (button/modal/interaction flows, channel creation, sends) are intentionally not unit-tested. Vite resolves the NodeNext `.js` import specifiers to their `.ts` sources automatically, so specs import exactly like the source (`import { x } from "./y.js"`). There is no linter configured yet.

## Environment

The bot requires a `.env` file (copy from `.env.example`). `src/config.ts` throws on startup if `DISCORD_TOKEN` or `CLIENT_ID` are missing. `GUILD_ID` is optional but changes deploy behavior (see below).

## Architecture

ESM project (`"type": "module"`) targeting NodeNext. **Relative imports must use `.js` extensions** even though the source is `.ts` — this is required by NodeNext module resolution (e.g. `import { config } from "./config.js"`).

The layout is **feature-based**: shared infrastructure lives in `src/core/`, and every user-facing domain is a self-contained slice under `src/features/<feature>/`. A feature owns both its logic (`<feature>.ts`, sometimes split further) and its slash commands (`<feature>/commands/*.ts`).

```
src/
├─ index.ts             # bot entry — Client + event routing
├─ config.ts            # env vars (throws if DISCORD_TOKEN / CLIENT_ID missing)
├─ deploy-commands.ts   # standalone slash-command registration script
├─ core/
│  ├─ command.ts        # the Command interface every command default-exports
│  ├─ command-loader.ts # loadCommands(): recursively discovers commands/ files
│  └─ store.ts          # per-guild config persisted to data/config.json
└─ features/
   ├─ general/          commands/ (ping, help)
   ├─ tickets/          panel.ts · intake.ts · conversation.ts · transcript.ts · tickets.ts
   ├─ welcome/          welcome.ts
   ├─ moderation/       moderation.ts · sweeper.ts · commands/ (18 sanction/role/channel cmds)
   ├─ permissions/      permissions.ts · commands/ (goat-perms)
   ├─ leveling/         leveling.ts · commands/ (level, leaderboard, goat-levels)
   ├─ raid/             raid.ts · commands/ (goat-raid)
   ├─ antilink/         antilink.ts (link filter)
   ├─ embed/            editor.ts · commands/ (embed)
   └─ config/           config-ui.ts · commands/ (goat-config)
```

- `src/core/command.ts` — the `Command` interface (`data` + `execute`) every command file default-exports. The `general/commands/ping.ts` command is the reference implementation.
- `src/core/command-loader.ts` — `loadCommands()` **recursively** discovers every `.ts`/`.js` file inside any `commands/` directory under `src/features/` and returns a `Map<name, Command>`. **Drop a new file into any feature's `commands/` folder and it is picked up automatically**; there is no central registry. Both `index.ts` and `deploy-commands.ts` reuse it, so the running bot and the registration script always agree on the command set.
- `src/core/store.ts` — per-guild config persisted to `data/config.json` (gitignored). The **single source of truth** for all feature settings (`tickets`, `welcome`, `moderation`, `permissions`, `leveling`, `levels`, `raid`); `getGuildConfig` / `updateGuildConfig` (which shallow-merges each section). Features read it at runtime, so `/goat-config` changes take effect immediately.
- `src/index.ts` — bot entry. Builds the `Client`, loads commands, and routes events: button presses go to the ticket handler (`handleTicketButton`) or config-UI handler; **modal submissions** for the ticket intake go to `handleTicketModal`; slash commands go to their `execute` (behind the internal permission gate); `GuildMemberAdd` runs anti-raid first, then welcome; `MessageCreate` feeds the leveling system. Errors are caught here and reported ephemerally.
- `src/features/tickets/` — the ticket system, split into `panel.ts` (ticket-type catalog with an `intake` flag, customId helpers, `buildPanel`/`refreshPanels`, `isTicketButton`), `intake.ts` (project-intake modal + recap/follow-up embeds), `transcript.ts` (HTML transcript rendering), and `tickets.ts` (button routing, create/close, `handleTicketModal`). Ticket types flagged `intake: true` (currently "commande") show a **modal** on click — a duplicate check runs first, then `interaction.showModal`; on submit, `handleTicketModal` (wired to `isModalSubmit` in `src/index.ts`) opens the channel with a recap embed and starts a **guided conversation** (`conversation.ts`): it pings the member, explains the procedure, then asks `TICKET_QUESTIONS` **one at a time** — `handleTicketConversation` (wired to `MessageCreate`) advances on each owner reply, and after the last answer thanks the member and pings the staff role. It reacts only to the *fact* the owner replied (not content), so it needs **no privileged intent**; progress is persisted in the store (`ticketSessions`, keyed by channel id) so it survives restarts and is cleared on close. Non-intake types (support) open directly via `createTicket`. Modals need **no privileged intent** (message content is never read). The panel button's `customId` carries only the ticket **type**; category/staff-role/log-channel come from the store. "One ticket per type per user" is enforced by scanning channels for the owner id + type stored in the channel `topic`. On close, an HTML transcript is posted to the log channel. Needs the bot to have **Manage Channels**.
- `src/features/welcome/welcome.ts` — posts a welcome embed on member join, using the store's `welcome` channel + template (`{user} {username} {server} {count}`). Requires the **GuildMembers** privileged intent (in `src/index.ts` **and** enabled in the Developer Portal).
- `src/features/moderation/` — `moderation.ts` holds shared helpers (duration parsing, hierarchy checks `checkActable`/`checkRoleManageable`, DM notify, case recording + `postModLog`); `sweeper.ts` auto-lifts expired tempbans; `commands/` holds the 18 sanction/role/channel commands.
- `src/features/permissions/` — `permissions.ts` is the internal granular permission layer (`hasCommandAccess`, bypass/grants/groups) applied on top of Discord perms; `commands/goat-perms.ts` edits it.
- `src/features/leveling/leveling.ts` — message-activity XP. `handleMessage` (wired to `MessageCreate`) grants jittered XP per message with a per-member cooldown, derives the level from total XP via a MEE6-style curve (`xpToNext`/`levelProgress`), announces level-ups, and syncs reward roles (`applyRewards`, stack vs. highest-only). Config + per-user XP live in the store under `leveling` / `levels`. Uses only the **non-privileged** `GuildMessages` intent (message content is never read). Commands: `/level`, `/leaderboard` (everyone); `/goat-config levels` (base settings) and `/goat-levels` (rewards + XP admin).
- `src/features/raid/raid.ts` — anti-raid. `handleJoin` (wired to `GuildMemberAdd` **before** the welcome — returns `true` to skip it when it removes the member) detects join-rate spikes (N joins in a rolling window → raid mode for `lockdownMinutes`) and only then acts on joiners with the configured `action` (kick/ban/alert), alerting a channel/role. The `minAccountAgeHours` filter applies **only while raid mode is active**: it spares accounts older than the threshold and removes only newer ones (0/unset → act on all joiners during the raid). Live state (recent joins, `raidUntil`, `manualLock`) is **in-memory** (per `states` Map), so it fail-opens on restart; only settings persist (store `raid`). Uses the already-enabled `GuildMembers` intent. Commands: `/goat-config raid` (settings) and `/goat-raid` (`lockdown`/`unlock`/`status`).
- `src/features/antilink/antilink.ts` — anti-link filter. `handleMessage` (wired to `MessageCreate` **before** leveling — returns `true` when it deletes, so a removed message earns no XP) deletes links from members without permission, posting an auto-removed warning and a mod-log entry. Exemptions: **ticket channels** (via `isTicketChannel`), members with **Manage Messages**, configured `allowedRoleIds`/`allowedChannelIds`, and whitelisted domains. Detection is deliberately conservative (`http(s)://`, `www.`, `domain.tld/path`) so dev tokens like `discord.js`/`index.ts` are not flagged. Requires the **privileged `MessageContent` intent** (in `src/index.ts` **and** the Developer Portal) — without it `message.content` is empty. Config in store `antilink`; managed via `/goat-config antilink`.
- `src/features/embed/editor.ts` — interactive embed editor. `/embed` opens an ephemeral panel (live preview + buttons); the in-progress draft is kept **in memory** keyed by user id. Buttons open modals (content/color/media/author/field) or act directly; a `ChannelSelectMenuBuilder` sends to a channel, and other buttons DM it or edit an existing **bot-authored** message; `/embed message:<link>` or the Import button loads an existing embed. All editor interactions share the `embed:` customId prefix and are routed **first** in `src/index.ts` via `isEmbedInteraction` + `handleEmbedInteraction` (covers buttons, modals, and any select menu). Editor modals are shown from components, so `handleModal` narrows with `interaction.isFromMessage()` to get `.update()`. No new command deploy is needed beyond registering `/embed` itself.
- `src/features/config/` — `commands/goat-config.ts` is the admin-only (`ManageGuild`) config command with subcommands `tickets`, `welcome`, `moderation`, `levels`, `raid`, `display`; `config-ui.ts` builds the `display` embed + the per-panel delete buttons. Panels are recorded in the store with an `integration` tag so `display` can list any future integration's panels too.
- `src/deploy-commands.ts` — standalone script (not part of the running bot) that pushes command `data` to Discord's REST API. If `GUILD_ID` is set it registers to that one guild (instant); otherwise it registers globally (up to ~1 hour to propagate). Use a `GUILD_ID` during development for instant updates.

### Adding a feature or command

- **New command in an existing feature**: add a file to that feature's `commands/` folder (default-export a `Command`), then `npm run deploy`.
- **New feature**: create `src/features/<name>/` with a `<name>.ts` for logic and a `commands/` folder for its slash commands; wire any event handlers into `src/index.ts`. The loader finds the commands automatically.

### Gateway intents

`src/index.ts` configures `GatewayIntentBits`: `Guilds` (slash commands + tickets), `GuildMembers` (welcome + anti-raid — **privileged**), `GuildMessages` (leveling — **not** privileged), and `MessageContent` (anti-link — **privileged**). Counting messages for XP needs only the `MessageCreate` *event*, but reading message text for the anti-link filter needs `MessageContent`. Both privileged intents (`GuildMembers`, `MessageContent`) must **also** be enabled in the Discord Developer Portal → Bot → Privileged Gateway Intents, or the bot fails to start / receives empty content.
