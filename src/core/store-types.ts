/**
 * The per-guild configuration **data model** — every feature's settings shape,
 * plus the aggregate `GuildConfig`. Kept separate from the persistence engine
 * (`store.ts`) so the schema reads as one place. `store.ts` re-exports all of
 * these, so consumers keep importing them from `./core/store.js`.
 */

export interface TicketConfig {
  /** Destination category per ticket type (ticket type name → category id). */
  categoryIds?: Record<string, string>;
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
