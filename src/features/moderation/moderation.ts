import {
  EmbedBuilder,
  MessageFlags,
  TextChannel,
  time,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type PermissionOverwriteOptions,
  type Role,
  type User,
} from "discord.js";
import {
  addModCase,
  getGuildConfig,
  type ModActionType,
  type ModCase,
} from "../../core/store.js";

/**
 * Shared moderation helpers: duration parsing, hierarchy checks, user DMs,
 * and case recording + logging to the configured moderation log channel.
 */

/** Discord timeouts max out at 28 days. */
export const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

const ACTION_META: Record<ModActionType, { label: string; color: number }> = {
  warn: { label: "Avertissement", color: 0xfee75c },
  note: { label: "Note", color: 0x99aab5 },
  kick: { label: "Expulsion", color: 0xe67e22 },
  ban: { label: "Bannissement", color: 0xed4245 },
  tempban: { label: "Bannissement temporaire", color: 0xed4245 },
  unban: { label: "Débannissement", color: 0x57f287 },
  mute: { label: "Mute (timeout)", color: 0xe67e22 },
  unmute: { label: "Unmute", color: 0x57f287 },
};

/**
 * Parses a duration like "10m", "2h", "7d", "1w", "30s" into milliseconds.
 * Returns null if the input is not a valid duration.
 */
export function parseDuration(input: string): number | null {
  const match = input.trim().match(/^(\d+)\s*(s|m|h|d|w)$/i);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const factor: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  };
  return value * factor[unit];
}

/** Human-readable duration (approximate, largest unit). */
export function formatDuration(ms: number): string {
  const units: Array<[number, string]> = [
    [604_800_000, "semaine(s)"],
    [86_400_000, "jour(s)"],
    [3_600_000, "heure(s)"],
    [60_000, "minute(s)"],
    [1000, "seconde(s)"],
  ];
  for (const [factor, name] of units) {
    if (ms >= factor) return `${Math.floor(ms / factor)} ${name}`;
  }
  return "quelques secondes";
}

/**
 * Verifies the moderator (and the bot) may act on a target member: not self,
 * not the owner, and higher in the role hierarchy. Returns an error message
 * to show the user, or null if the action is allowed.
 */
export function checkActable(
  moderator: GuildMember,
  target: GuildMember,
): string | null {
  if (target.id === moderator.id) return "Tu ne peux pas te sanctionner toi-même.";
  if (target.id === moderator.guild.ownerId)
    return "Impossible de sanctionner le propriétaire du serveur.";

  const me = moderator.guild.members.me;
  if (me && target.roles.highest.position >= me.roles.highest.position)
    return "Ce membre a un rôle supérieur ou égal au mien : je ne peux pas le sanctionner.";

  const isOwner = moderator.id === moderator.guild.ownerId;
  if (
    !isOwner &&
    target.roles.highest.position >= moderator.roles.highest.position
  )
    return "Ce membre a un rôle supérieur ou égal au tien.";

  return null;
}

/**
 * Verifies a role may be assigned/removed by the moderator and the bot:
 * not @everyone, not integration-managed, and below both their highest roles.
 * Returns an error message, or null if allowed.
 */
export function checkRoleManageable(
  moderator: GuildMember,
  role: Role,
): string | null {
  const guild = moderator.guild;
  if (role.id === guild.roles.everyone.id) return "Impossible d'assigner @everyone.";
  if (role.managed)
    return "Ce rôle est géré par une intégration et ne peut pas être assigné.";

  const me = guild.members.me;
  if (me && role.position >= me.roles.highest.position)
    return "Ce rôle est supérieur ou égal au mien : je ne peux pas le gérer.";

  const isOwner = moderator.id === guild.ownerId;
  if (!isOwner && role.position >= moderator.roles.highest.position)
    return "Ce rôle est supérieur ou égal au tien.";

  return null;
}

/** Attempts to DM a user about a moderation action. Silent on failure. */
export async function notifyUser(
  user: User,
  guild: Guild,
  action: ModActionType,
  reason: string | undefined,
  extra?: string,
): Promise<void> {
  const meta = ACTION_META[action];
  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`${meta.label} — ${guild.name}`)
    .setDescription(reason ? `**Raison :** ${reason}` : "Aucune raison fournie.")
    .setTimestamp();
  if (extra) embed.addFields({ name: "Détails", value: extra });

  await user.send({ embeds: [embed] }).catch(() => {
    /* DMs closed — ignore */
  });
}

/**
 * Records a moderation case and posts it to the configured mod-log channel.
 * Returns the created case (with its id).
 */
export async function recordCase(
  guild: Guild,
  data: {
    type: ModActionType;
    user: User;
    moderator: User;
    reason?: string;
    expiresAt?: number;
    active?: boolean;
  },
): Promise<ModCase> {
  const modCase = await addModCase(guild.id, {
    type: data.type,
    userId: data.user.id,
    moderatorId: data.moderator.id,
    reason: data.reason,
    expiresAt: data.expiresAt,
    active: data.active,
  });

  const meta = ACTION_META[data.type];
  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setAuthor({
      name: `${data.user.tag} (${data.user.id})`,
      iconURL: data.user.displayAvatarURL(),
    })
    .setTitle(`${meta.label} · Case #${modCase.id}`)
    .addFields(
      { name: "Membre", value: `<@${data.user.id}>`, inline: true },
      { name: "Modérateur", value: `<@${data.moderator.id}>`, inline: true },
      { name: "Raison", value: data.reason ?? "*aucune*", inline: false },
    )
    .setTimestamp();

  if (data.expiresAt) {
    embed.addFields({
      name: "Expire",
      value: `${time(Math.floor(data.expiresAt / 1000), "R")}`,
      inline: true,
    });
  }

  await postModLog(guild, embed);
  return modCase;
}

/**
 * Shared logic for lock/unlock/hide/unhide: edits the @everyone overwrite on
 * the target channel (option "channel", default the current one), logs it, and
 * replies. Commands just pass the permission patch and labels.
 */
export async function runChannelState(
  interaction: ChatInputCommandInteraction,
  opts: { perms: PermissionOverwriteOptions; title: string; color: number; success: string },
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) return;

  const chosen = interaction.options.getChannel("channel") ?? interaction.channel;
  if (!(chosen instanceof TextChannel)) {
    await interaction.reply({
      content: "Cible invalide : choisis un salon textuel.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const reason = interaction.options.getString("reason") ?? undefined;
  await chosen.permissionOverwrites.edit(
    interaction.guild.roles.everyone,
    opts.perms,
    { reason },
  );

  await postModLog(
    interaction.guild,
    new EmbedBuilder()
      .setColor(opts.color)
      .setTitle(opts.title)
      .addFields(
        { name: "Salon", value: `<#${chosen.id}>`, inline: true },
        { name: "Modérateur", value: `<@${interaction.user.id}>`, inline: true },
        ...(reason ? [{ name: "Raison", value: reason }] : []),
      )
      .setTimestamp(),
  );

  await interaction.reply({
    content: `${opts.success} ${chosen.toString()}.`,
    flags: MessageFlags.Ephemeral,
  });
}

/** Posts an embed to the guild's configured moderation log channel, if any. */
export async function postModLog(
  guild: Guild,
  embed: EmbedBuilder,
): Promise<void> {
  const logChannelId = (await getGuildConfig(guild.id)).moderation?.logChannelId;
  if (!logChannelId) return;
  const channel = guild.channels.cache.get(logChannelId);
  if (channel?.isTextBased()) {
    await channel.send({ embeds: [embed] }).catch((error) => {
      console.error("[moderation] Failed to post mod log:", error);
    });
  }
}
