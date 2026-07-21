import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Tiny per-guild config store backed by a JSON file (`data/config.json`).
 * This is the single source of truth for integration settings (tickets,
 * welcome), so `/goat-config` can change them and the running features pick
 * the new values up immediately. Single-process, write-through cache.
 */

export interface TicketConfig {
  categoryId?: string;
  staffRoleId?: string;
  logChannelId?: string;
}

export interface WelcomeConfig {
  channelId: string;
  message?: string;
}

/** A published integration panel we can re-edit on startup/shutdown. */
export interface PanelRef {
  /** Which integration owns this panel (e.g. "tickets"). */
  integration: string;
  channelId: string;
  messageId: string;
  title?: string;
  description?: string;
}

export type ModActionType =
  | "warn"
  | "note"
  | "kick"
  | "ban"
  | "tempban"
  | "unban"
  | "mute"
  | "unmute";

/** A single moderation action recorded against a user. */
export interface ModCase {
  id: number;
  type: ModActionType;
  userId: string;
  moderatorId: string;
  reason?: string;
  timestamp: number;
  /** For temp actions: when it should be reversed. */
  expiresAt?: number;
  /** For temp actions: still pending reversal. */
  active?: boolean;
}

export interface ModerationConfig {
  logChannelId?: string;
  cases?: ModCase[];
  nextCaseId?: number;
}

/** Who is explicitly allowed (roles + users) for a command or group. */
export interface PermGrant {
  roleIds: string[];
  userIds: string[];
}

/** A named bundle of commands, granted to roles/users. */
export interface PermGroup {
  commands: string[];
  roleIds: string[];
  userIds: string[];
}

export interface PermissionsConfig {
  /** Roles/users that bypass every internal permission check. */
  bypassRoleIds?: string[];
  bypassUserIds?: string[];
  /** Per-command allow-lists (command name → who may use it). */
  grants?: Record<string, PermGrant>;
  /** Named groups (group name → commands + who has the group). */
  groups?: Record<string, PermGroup>;
}

/** A role automatically granted when a member reaches `level`. */
export interface LevelReward {
  level: number;
  roleId: string;
}

export interface LevelingConfig {
  /** Master switch — no XP is gained while this is false/undefined. */
  enabled?: boolean;
  /** Average XP granted per eligible message (jittered ±25% at runtime). */
  xpPerMessage?: number;
  /** Minimum seconds between two XP gains for the same member. */
  cooldownSeconds?: number;
  /** Whether to announce level-ups. */
  announce?: boolean;
  /** Where to post level-up announcements (defaults to the message channel). */
  announceChannelId?: string;
  /** Keep every earned reward role (true) vs only the highest one (false). */
  stackRewards?: boolean;
  /** Reward roles granted at given levels. */
  rewards?: LevelReward[];
  /** Channels where messages grant no XP. */
  noXpChannelIds?: string[];
  /** Roles whose members gain no XP. */
  noXpRoleIds?: string[];
}

/** A member's accumulated XP (level is derived from it, see leveling module). */
export interface UserLevel {
  /** Total lifetime XP. */
  xp: number;
  /** Timestamp of the last XP gain (for cooldown). */
  lastGain?: number;
}

/** What to do to members caught by anti-raid protection. */
export type RaidAction = "kick" | "ban" | "alert";

export interface RaidConfig {
  /** Master switch for anti-raid protection. */
  enabled?: boolean;
  /** Number of joins within the window that triggers raid mode. */
  joinThreshold?: number;
  /** Rolling window (seconds) over which joins are counted. */
  joinWindowSeconds?: number;
  /** Action applied to joiners during an active raid / manual lockdown. */
  action?: RaidAction;
  /** Accounts younger than this (hours) are actioned on join (0 = disabled). */
  minAccountAgeHours?: number;
  /** How long raid mode stays active after being triggered (minutes). */
  lockdownMinutes?: number;
  /** Channel where raid alerts are posted. */
  alertChannelId?: string;
  /** Role pinged on raid alerts (e.g. staff). */
  alertRoleId?: string;
}

export interface AntiLinkConfig {
  /** Master switch for anti-link filtering. */
  enabled?: boolean;
  /** Roles allowed to post links anywhere. */
  allowedRoleIds?: string[];
  /** Channels where links are always allowed (in addition to ticket channels). */
  allowedChannelIds?: string[];
  /** Allowed domains/substrings — a message whose links match is left alone. */
  whitelist?: string[];
}

/** An in-progress ticket intake Q&A (tracks which question the owner is on). */
export interface TicketSession {
  ownerId: string;
  /** Number of questions the owner has answered so far. */
  step: number;
}

export interface GuildConfig {
  tickets?: TicketConfig;
  welcome?: WelcomeConfig;
  panels?: PanelRef[];
  moderation?: ModerationConfig;
  permissions?: PermissionsConfig;
  leveling?: LevelingConfig;
  /** Per-member XP (user id → level data). */
  levels?: Record<string, UserLevel>;
  raid?: RaidConfig;
  antilink?: AntiLinkConfig;
  /** Active ticket intake conversations (channel id → session). */
  ticketSessions?: Record<string, TicketSession>;
}

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

/** Merges a patch into a guild's config (shallow-merging tickets/welcome). */
export async function updateGuildConfig(
  guildId: string,
  patch: GuildConfig,
): Promise<GuildConfig> {
  const store = await load();
  const current = store[guildId] ?? {};
  const next: GuildConfig = {
    ...current,
    ...patch,
    tickets: patch.tickets
      ? { ...current.tickets, ...patch.tickets }
      : current.tickets,
    welcome: patch.welcome
      ? { ...current.welcome, ...patch.welcome }
      : current.welcome,
    moderation: patch.moderation
      ? { ...current.moderation, ...patch.moderation }
      : current.moderation,
    permissions: patch.permissions
      ? { ...current.permissions, ...patch.permissions }
      : current.permissions,
    leveling: patch.leveling
      ? { ...current.leveling, ...patch.leveling }
      : current.leveling,
    raid: patch.raid ? { ...current.raid, ...patch.raid } : current.raid,
    antilink: patch.antilink
      ? { ...current.antilink, ...patch.antilink }
      : current.antilink,
  };
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
