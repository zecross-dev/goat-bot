import { EmbedBuilder, type Guild, type GuildMember } from "discord.js";
import { getRaidConfig, type RaidAction, type RaidConfig } from "../../core/store.js";

/**
 * Anti-raid protection. Watches the member-join stream and, when too many
 * accounts join in a short window (or when a lockdown is enabled manually),
 * puts the guild into "raid mode": incoming members are kicked/banned (per
 * config) and staff is alerted. The account-age filter applies *only* during
 * an active raid — there it spares older accounts and removes only brand-new
 * ones (the likely raiders).
 *
 * Runs on the existing `GuildMemberAdd` event (privileged `GuildMembers`
 * intent, already enabled) — no additional intent is required.
 */

export const RAID_DEFAULTS = {
  joinThreshold: 5,
  joinWindowSeconds: 10,
  action: "kick" as RaidAction,
  lockdownMinutes: 5,
} as const;

/** Per-guild live state, kept in memory (cleared on restart = fail-open). */
interface RaidState {
  /** Timestamps of recent joins, pruned to the detection window. */
  joins: number[];
  /** Epoch ms until which auto-triggered raid mode stays active (0 = off). */
  raidUntil: number;
  /** Staff-toggled lockdown, independent of auto-detection. */
  manualLock: boolean;
}

const states = new Map<string, RaidState>();

function stateFor(guildId: string): RaidState {
  let s = states.get(guildId);
  if (!s) {
    s = { joins: [], raidUntil: 0, manualLock: false };
    states.set(guildId, s);
  }
  return s;
}

/** Whether the guild is currently in lockdown (manual or auto). */
export function isLockedDown(guildId: string): boolean {
  const s = states.get(guildId);
  if (!s) return false;
  return s.manualLock || s.raidUntil > Date.now();
}

/** Snapshot of the current protection state for `/goat-raid status`. */
export function getStatus(guildId: string): {
  active: boolean;
  manual: boolean;
  autoUntil: number;
} {
  const s = states.get(guildId);
  const now = Date.now();
  const autoUntil = s && s.raidUntil > now ? s.raidUntil : 0;
  return {
    active: (s?.manualLock ?? false) || autoUntil > 0,
    manual: s?.manualLock ?? false,
    autoUntil,
  };
}

/**
 * Processes a joining member. Returns `true` if the member was blocked
 * (kicked/banned) so the caller can skip the welcome message. No-ops and
 * returns `false` when protection is disabled and no manual lockdown is set.
 */
export async function handleJoin(member: GuildMember): Promise<boolean> {
  const guildId = member.guild.id;
  const cfg = await getRaidConfig(guildId);
  const state = stateFor(guildId);
  const now = Date.now();

  // Expire an auto raid window that has elapsed.
  if (state.raidUntil && state.raidUntil <= now) state.raidUntil = 0;

  if (!cfg.enabled && !state.manualLock) return false;

  const action = cfg.action ?? RAID_DEFAULTS.action;

  // Join-rate detection: record this join and (re)trigger raid mode on a spike.
  const windowMs = (cfg.joinWindowSeconds ?? RAID_DEFAULTS.joinWindowSeconds) * 1000;
  state.joins.push(now);
  state.joins = state.joins.filter((t) => now - t <= windowMs);

  const threshold = cfg.joinThreshold ?? RAID_DEFAULTS.joinThreshold;
  const justTriggered = state.joins.length >= threshold && state.raidUntil <= now;
  if (justTriggered) {
    const minutes = cfg.lockdownMinutes ?? RAID_DEFAULTS.lockdownMinutes;
    state.raidUntil = now + minutes * 60_000;
    await alert(
      member.guild,
      cfg,
      `🚨 **Raid détecté** : ${state.joins.length} arrivées en ${
        cfg.joinWindowSeconds ?? RAID_DEFAULTS.joinWindowSeconds
      } s.\nVerrouillage anti-raid pour **${minutes} min** — action : **${actionLabel(
        action,
      )}**.`,
    );
  }

  // Only act on joiners while a raid / manual lockdown is active.
  const active = state.manualLock || state.raidUntil > now;
  if (!active || action === "alert") return false;

  // During a raid, if an account-age filter is set, spare older accounts
  // (likely real members caught in the wave) and only remove brand-new ones.
  if (cfg.minAccountAgeHours && cfg.minAccountAgeHours > 0) {
    const ageHours = (now - member.user.createdTimestamp) / 3_600_000;
    if (ageHours >= cfg.minAccountAgeHours) return false;
    await actionMember(
      member,
      action,
      `Raid — compte trop récent (moins de ${cfg.minAccountAgeHours} h)`,
    );
    await alert(
      member.guild,
      cfg,
      `🚫 ${member.user.tag} (${member.id}) — compte de moins de ${cfg.minAccountAgeHours} h retiré pendant le raid. Action : **${actionLabel(action)}**.`,
    );
    return true;
  }

  // No age filter: act on every joiner during the raid / lockdown.
  await actionMember(
    member,
    action,
    state.manualLock ? "Verrouillage anti-raid manuel" : "Raid détecté",
  );
  return true;
}

/** Toggles the manual lockdown and announces it. */
export async function setManualLockdown(
  guild: Guild,
  on: boolean,
): Promise<void> {
  const state = stateFor(guild.id);
  state.manualLock = on;
  if (!on) {
    state.raidUntil = 0;
    state.joins = [];
  }
  const cfg = await getRaidConfig(guild.id);
  await alert(
    guild,
    cfg,
    on
      ? "🔒 **Verrouillage manuel activé** — les nouveaux arrivants seront filtrés."
      : "🔓 **Verrouillage levé** — retour au fonctionnement normal.",
  );
}

/** Human label for an action. */
function actionLabel(action: RaidAction): string {
  return action === "ban" ? "bannissement" : action === "kick" ? "expulsion" : "alerte seule";
}

/** Applies the configured action to a member. Best-effort (needs Kick/Ban). */
async function actionMember(
  member: GuildMember,
  action: RaidAction,
  reason: string,
): Promise<void> {
  try {
    if (action === "ban" && member.bannable) {
      await member.ban({ reason });
    } else if (action === "kick" && member.kickable) {
      await member.kick(reason);
    }
  } catch (error) {
    console.error("[raid] Failed to action member:", error);
  }
}

/** Posts a raid alert to the configured channel, pinging the alert role. */
async function alert(
  guild: Guild,
  cfg: RaidConfig,
  description: string,
): Promise<void> {
  if (!cfg.alertChannelId) return;
  const channel = guild.channels.cache.get(cfg.alertChannelId);
  if (!channel?.isTextBased() || !channel.isSendable()) return;

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("🛡️ Protection anti-raid")
    .setDescription(description)
    .setTimestamp();

  await channel
    .send({
      content: cfg.alertRoleId ? `<@&${cfg.alertRoleId}>` : undefined,
      embeds: [embed],
      allowedMentions: { roles: cfg.alertRoleId ? [cfg.alertRoleId] : [] },
    })
    .catch((error) => console.error("[raid] Failed to send alert:", error));
}
