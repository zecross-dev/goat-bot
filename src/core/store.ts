import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  AntiLinkConfig,
  GuildConfig,
  LevelingConfig,
  ModCase,
  PanelRef,
  RaidConfig,
  TicketSession,
  UserLevel,
} from "./store-types.js";

/**
 * Tiny per-guild config store backed by a JSON file (`data/config.json`).
 * This is the single source of truth for integration settings, so
 * `/goat-config` can change them and the running features pick the new values
 * up immediately. Single-process, write-through cache. The config **data
 * model** lives in `store-types.ts`; this module owns persistence + access.
 */

// Re-export the whole data model so consumers keep importing it from here.
export type * from "./store-types.js";

type Store = Record<string, GuildConfig>;

const FILE = join(process.cwd(), "data", "config.json");
let cache: Store | null = null;

async function load(): Promise<Store> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(FILE, "utf-8")) as Store;
  } catch {
    cache = {}; // missing/invalid file → start empty
  }
  return cache;
}

async function persist(): Promise<void> {
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(cache, null, 2), "utf-8");
}

/** Returns the stored config for a guild (empty object if none). */
export async function getGuildConfig(guildId: string): Promise<GuildConfig> {
  const store = await load();
  return store[guildId] ?? {};
}

/**
 * Config sections that `updateGuildConfig` **shallow-merges** onto the current
 * value (so a partial patch keeps the untouched fields). Any section NOT listed
 * here — `panels`, `levels`, `ticketSessions` — is replaced wholesale by the
 * patch, which is what their dedicated accessors rely on. Add a new mergeable
 * section here when you add one to `GuildConfig`.
 */
const MERGED_SECTIONS = [
  "tickets",
  "welcome",
  "moderation",
  "permissions",
  "leveling",
  "raid",
  "antilink",
] as const satisfies readonly (keyof GuildConfig)[];

/** Shallow-merges one section of `patch` onto `target` (no-op if unset). */
function mergeSection<K extends keyof GuildConfig>(
  target: GuildConfig,
  current: GuildConfig,
  patch: GuildConfig,
  key: K,
): void {
  const incoming = patch[key];
  if (incoming) {
    target[key] = { ...current[key], ...incoming } as GuildConfig[K];
  }
}

/** Merges a patch into a guild's config (shallow-merging the config sections). */
export async function updateGuildConfig(
  guildId: string,
  patch: GuildConfig,
): Promise<GuildConfig> {
  const store = await load();
  const current = store[guildId] ?? {};
  const next: GuildConfig = { ...current, ...patch };

  for (const key of MERGED_SECTIONS) {
    mergeSection(next, current, patch, key);
  }

  store[guildId] = next;
  await persist();
  return next;
}

/** Returns the anti-raid config for a guild (empty object if unset). */
export async function getRaidConfig(guildId: string): Promise<RaidConfig> {
  return (await getGuildConfig(guildId)).raid ?? {};
}

/** Returns the anti-link config for a guild (empty object if unset). */
export async function getAntiLinkConfig(
  guildId: string,
): Promise<AntiLinkConfig> {
  return (await getGuildConfig(guildId)).antilink ?? {};
}

/** The active ticket-intake session for a channel, if any. */
export async function getTicketSession(
  guildId: string,
  channelId: string,
): Promise<TicketSession | undefined> {
  const store = await load();
  return store[guildId]?.ticketSessions?.[channelId];
}

/** Creates/updates a ticket-intake session. */
export async function setTicketSession(
  guildId: string,
  channelId: string,
  session: TicketSession,
): Promise<void> {
  const store = await load();
  const cfg = store[guildId] ?? {};
  cfg.ticketSessions = { ...(cfg.ticketSessions ?? {}), [channelId]: session };
  store[guildId] = cfg;
  await persist();
}

/** Removes a ticket-intake session (on completion or ticket close). */
export async function clearTicketSession(
  guildId: string,
  channelId: string,
): Promise<void> {
  const store = await load();
  const sessions = store[guildId]?.ticketSessions;
  if (sessions && channelId in sessions) {
    delete sessions[channelId];
    await persist();
  }
}

/** Returns the leveling config for a guild (empty object if unset). */
export async function getLevelingConfig(
  guildId: string,
): Promise<LevelingConfig> {
  return (await getGuildConfig(guildId)).leveling ?? {};
}

/** A member's XP record (defaults to zero XP if the member has none yet). */
export async function getUserLevel(
  guildId: string,
  userId: string,
): Promise<UserLevel> {
  const store = await load();
  return store[guildId]?.levels?.[userId] ?? { xp: 0 };
}

/** Overwrites a member's XP record. */
export async function setUserLevel(
  guildId: string,
  userId: string,
  data: UserLevel,
): Promise<void> {
  const store = await load();
  const cfg = store[guildId] ?? {};
  cfg.levels = { ...(cfg.levels ?? {}), [userId]: data };
  store[guildId] = cfg;
  await persist();
}

/** Removes one member's XP (or the whole leaderboard when `userId` is omitted). */
export async function resetLevels(
  guildId: string,
  userId?: string,
): Promise<void> {
  const store = await load();
  const cfg = store[guildId];
  if (!cfg?.levels) return;
  if (userId) delete cfg.levels[userId];
  else cfg.levels = {};
  await persist();
}

/** Every member's XP for a guild, sorted from most to least XP. */
export async function getLeaderboard(
  guildId: string,
): Promise<Array<{ userId: string; xp: number }>> {
  const store = await load();
  const levels = store[guildId]?.levels ?? {};
  return Object.entries(levels)
    .map(([userId, v]) => ({ userId, xp: v.xp }))
    .sort((a, b) => b.xp - a.xp);
}

/** Records a newly published panel so it can be re-edited later. */
export async function addPanel(
  guildId: string,
  ref: PanelRef,
): Promise<void> {
  const store = await load();
  const cfg = store[guildId] ?? {};
  cfg.panels = [...(cfg.panels ?? []), ref];
  store[guildId] = cfg;
  await persist();
}

/** Every stored panel across all guilds (for startup/shutdown refresh). */
export async function getAllPanels(): Promise<PanelRef[]> {
  const store = await load();
  return Object.values(store).flatMap((c) => c.panels ?? []);
}

/** Records a moderation case, assigning it the next sequential id. */
export async function addModCase(
  guildId: string,
  data: Omit<ModCase, "id" | "timestamp">,
): Promise<ModCase> {
  const store = await load();
  const cfg = store[guildId] ?? {};
  const mod = cfg.moderation ?? {};
  const id = mod.nextCaseId ?? 1;
  const modCase: ModCase = { id, timestamp: Date.now(), ...data };
  mod.cases = [...(mod.cases ?? []), modCase];
  mod.nextCaseId = id + 1;
  cfg.moderation = mod;
  store[guildId] = cfg;
  await persist();
  return modCase;
}

/** All moderation cases for a guild, optionally filtered by target user. */
export async function getModCases(
  guildId: string,
  userId?: string,
): Promise<ModCase[]> {
  const store = await load();
  const cases = store[guildId]?.moderation?.cases ?? [];
  return userId ? cases.filter((c) => c.userId === userId) : cases;
}

/** Temp cases (e.g. tempban) whose expiry has passed and are still active. */
export async function getDueTempActions(
  now: number,
): Promise<Array<{ guildId: string; modCase: ModCase }>> {
  const store = await load();
  const due: Array<{ guildId: string; modCase: ModCase }> = [];
  for (const [guildId, cfg] of Object.entries(store)) {
    for (const c of cfg.moderation?.cases ?? []) {
      if (c.active && c.expiresAt && c.expiresAt <= now) {
        due.push({ guildId, modCase: c });
      }
    }
  }
  return due;
}

/** Marks a temp case as no longer pending (after it has been reversed). */
export async function deactivateCase(
  guildId: string,
  id: number,
): Promise<void> {
  const store = await load();
  const modCase = store[guildId]?.moderation?.cases?.find((c) => c.id === id);
  if (modCase?.active) {
    modCase.active = false;
    await persist();
  }
}

/** Removes a stored panel by channel + message id. Returns true if removed. */
export async function removePanel(
  guildId: string,
  channelId: string,
  messageId: string,
): Promise<boolean> {
  const store = await load();
  const cfg = store[guildId];
  if (!cfg?.panels) return false;
  const kept = cfg.panels.filter(
    (p) => !(p.channelId === channelId && p.messageId === messageId),
  );
  if (kept.length === cfg.panels.length) return false;
  cfg.panels = kept;
  await persist();
  return true;
}
