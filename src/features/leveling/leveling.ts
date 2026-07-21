import {
  EmbedBuilder,
  type Guild,
  type GuildMember,
  type Message,
  type User,
} from "discord.js";
import {
  getLevelingConfig,
  getUserLevel,
  setUserLevel,
  updateGuildConfig,
  type LevelingConfig,
  type LevelReward,
} from "../../core/store.js";

/**
 * Message-activity leveling. Members earn XP for chatting; crossing an XP
 * threshold raises their level, optionally announced and rewarded with roles.
 *
 * Only the *fact* that a message was sent is used (not its content), so the
 * running bot needs the non-privileged `GuildMessages` intent — no privileged
 * `MessageContent` intent is required.
 */

/** Fallbacks applied when a guild has not set the corresponding option. */
export const LEVELING_DEFAULTS = {
  xpPerMessage: 20,
  cooldownSeconds: 60,
  announce: true,
  stackRewards: true,
} as const;

const DEFAULT_ANNOUNCE = "🎉 GG {user}, tu passes **niveau {level}** !";

// ── XP curve (MEE6-style) ────────────────────────────────────────────────────

/** XP required to advance *from* `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return 5 * level * level + 50 * level + 100;
}

/** Total cumulative XP required to *reach* `level` (level 0 = 0 XP). */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let n = 0; n < level; n++) total += xpToNext(n);
  return total;
}

/**
 * Resolves a total-XP amount into a level plus progress within that level.
 * `into`/`needed` describe how far the member is through the current level.
 */
export function levelProgress(totalXp: number): {
  level: number;
  into: number;
  needed: number;
} {
  let level = 0;
  let remaining = Math.max(0, Math.floor(totalXp));
  let needed = xpToNext(0);
  while (remaining >= needed) {
    remaining -= needed;
    level++;
    needed = xpToNext(level);
  }
  return { level, into: remaining, needed };
}

/** The level a member with `totalXp` has reached. */
export function levelFromXp(totalXp: number): number {
  return levelProgress(totalXp).level;
}

/** A jittered XP gain (±25%) around the configured average, minimum 1. */
function rollXp(average: number): number {
  const min = Math.max(1, Math.round(average * 0.75));
  const max = Math.max(min, Math.round(average * 1.25));
  return min + Math.floor(Math.random() * (max - min + 1));
}

// ── Message handling ─────────────────────────────────────────────────────────

/**
 * Grants XP for a message and handles any resulting level-up (announcement +
 * reward roles). Safe to call for every message: it silently no-ops when
 * leveling is disabled, the author is a bot, the channel/role is excluded, or
 * the per-member cooldown has not elapsed.
 */
export async function handleMessage(message: Message): Promise<void> {
  if (message.author.bot || message.system) return;
  if (!message.inGuild()) return;

  const cfg = await getLevelingConfig(message.guildId);
  if (!cfg.enabled) return;

  // Excluded channel (also matches a thread's parent channel).
  const parentId = message.channel.isThread() ? message.channel.parentId : null;
  if (
    cfg.noXpChannelIds?.some(
      (id) => id === message.channelId || id === parentId,
    )
  ) {
    return;
  }

  const member = message.member;
  if (member && cfg.noXpRoleIds?.some((r) => member.roles.cache.has(r))) return;

  // Per-member cooldown.
  const now = Date.now();
  const cooldownMs =
    (cfg.cooldownSeconds ?? LEVELING_DEFAULTS.cooldownSeconds) * 1000;
  const record = await getUserLevel(message.guildId, message.author.id);
  if (record.lastGain && now - record.lastGain < cooldownMs) return;

  const oldLevel = levelFromXp(record.xp);
  const gain = rollXp(cfg.xpPerMessage ?? LEVELING_DEFAULTS.xpPerMessage);
  const newXp = record.xp + gain;
  await setUserLevel(message.guildId, message.author.id, {
    xp: newXp,
    lastGain: now,
  });

  const newLevel = levelFromXp(newXp);
  if (newLevel <= oldLevel) return;

  await onLevelUp(message, newLevel, cfg).catch((error) =>
    console.error("[leveling] level-up handling failed:", error),
  );
}

/** Announces a level-up and syncs the member's reward roles. */
async function onLevelUp(
  message: Message<true>,
  level: number,
  cfg: LevelingConfig,
): Promise<void> {
  if (message.member) await applyRewards(message.member, level, cfg);

  if (!(cfg.announce ?? LEVELING_DEFAULTS.announce)) return;

  const text = DEFAULT_ANNOUNCE.replaceAll("{user}", message.author.toString())
    .replaceAll("{username}", message.author.username)
    .replaceAll("{level}", String(level));

  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setDescription(text)
    .setThumbnail(message.author.displayAvatarURL({ size: 128 }));

  const channel = cfg.announceChannelId
    ? message.guild.channels.cache.get(cfg.announceChannelId)
    : message.channel;
  if (channel?.isTextBased() && channel.isSendable()) {
    await channel.send({ embeds: [embed] });
  }
}

/**
 * Brings a member's reward roles in line with their level. Adds every reward
 * they have earned; when `stackRewards` is off, keeps only the highest earned
 * reward and removes lower ones. Best-effort — needs Manage Roles.
 */
export async function applyRewards(
  member: GuildMember,
  level: number,
  cfg: LevelingConfig,
): Promise<void> {
  const rewards = cfg.rewards ?? [];
  if (rewards.length === 0) return;

  const earned = rewards.filter((r) => r.level <= level);
  if (earned.length === 0) return;

  const stack = cfg.stackRewards ?? LEVELING_DEFAULTS.stackRewards;
  const toAdd = new Set<string>();
  const toRemove = new Set<string>();

  if (stack) {
    for (const r of earned) toAdd.add(r.roleId);
  } else {
    const highest = earned.reduce((a, b) => (b.level > a.level ? b : a));
    toAdd.add(highest.roleId);
    for (const r of rewards) {
      if (r.roleId !== highest.roleId) toRemove.add(r.roleId);
    }
  }

  for (const roleId of toAdd) {
    if (!member.roles.cache.has(roleId)) {
      await member.roles
        .add(roleId, `Récompense niveau ${level}`)
        .catch((e) => console.error("[leveling] add role failed:", e));
    }
  }
  for (const roleId of toRemove) {
    if (member.roles.cache.has(roleId)) {
      await member.roles
        .remove(roleId, "Palier de récompense supérieur atteint")
        .catch((e) => console.error("[leveling] remove role failed:", e));
    }
  }
}

// ── Reward mutators (used by the admin command) ──────────────────────────────

/** Adds/replaces the reward role at `level`. Returns the sorted reward list. */
export async function setReward(
  guildId: string,
  level: number,
  roleId: string,
): Promise<LevelReward[]> {
  const cfg = await getLevelingConfig(guildId);
  const rewards = (cfg.rewards ?? []).filter((r) => r.level !== level);
  rewards.push({ level, roleId });
  rewards.sort((a, b) => a.level - b.level);
  await updateGuildConfig(guildId, { leveling: { rewards } });
  return rewards;
}

/** Removes the reward at `level`. Returns true if one existed. */
export async function removeReward(
  guildId: string,
  level: number,
): Promise<boolean> {
  const cfg = await getLevelingConfig(guildId);
  const rewards = cfg.rewards ?? [];
  const kept = rewards.filter((r) => r.level !== level);
  if (kept.length === rewards.length) return false;
  await updateGuildConfig(guildId, { leveling: { rewards: kept } });
  return true;
}

// ── Display helpers ──────────────────────────────────────────────────────────

/** A compact text progress bar, e.g. `▰▰▰▱▱▱▱▱▱▱`. */
function progressBar(into: number, needed: number, width = 12): string {
  const filled = Math.max(0, Math.min(width, Math.round((into / needed) * width)));
  return "▰".repeat(filled) + "▱".repeat(width - filled);
}

/** Builds the `/level` rank card for a member. */
export function buildRankEmbed(
  user: User,
  totalXp: number,
  rank: number | null,
): EmbedBuilder {
  const { level, into, needed } = levelProgress(totalXp);
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "Niveau", value: `**${level}**`, inline: true },
      {
        name: "Classement",
        value: rank ? `**#${rank}**` : "*non classé*",
        inline: true,
      },
      { name: "XP total", value: `**${totalXp}**`, inline: true },
      {
        name: `Progression — ${into} / ${needed} XP`,
        value: progressBar(into, needed),
      },
    );
}

/** Builds the `/leaderboard` embed from the top entries. */
export async function buildLeaderboardEmbed(
  guild: Guild,
  entries: Array<{ userId: string; xp: number }>,
): Promise<EmbedBuilder> {
  const top = entries.slice(0, 10);
  const medals = ["🥇", "🥈", "🥉"];
  const lines = await Promise.all(
    top.map(async (e, i) => {
      const level = levelFromXp(e.xp);
      const rank = medals[i] ?? `**${i + 1}.**`;
      const name =
        guild.members.cache.get(e.userId)?.toString() ?? `<@${e.userId}>`;
      return `${rank} ${name} — niveau **${level}** (${e.xp} XP)`;
    }),
  );

  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle(`🏆 Classement — ${guild.name}`)
    .setDescription(lines.join("\n") || "*Personne n'a encore gagné d'XP.*");
}
