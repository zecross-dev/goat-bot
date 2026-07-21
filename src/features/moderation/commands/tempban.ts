import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/command.js";
import {
  checkActable,
  formatDuration,
  notifyUser,
  parseDuration,
  recordCase,
} from "../moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("tempban")
    .setDescription("Bannit temporairement un utilisateur.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption((o) =>
      o.setName("user").setDescription("Utilisateur à bannir.").setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName("duration")
        .setDescription("Durée (ex : 30m, 2h, 7d, 1w).")
        .setRequired(true),
    )
    .addStringOption((o) => o.setName("reason").setDescription("Raison du bannissement.")),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return;

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? undefined;
    const durationMs = parseDuration(interaction.options.getString("duration", true));

    if (durationMs === null) {
      await interaction.reply({
        content: "Durée invalide. Exemples : `30m`, `2h`, `7d`, `1w`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const moderator = await interaction.guild.members.fetch(interaction.user.id);
    const target = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (target) {
      const error = checkActable(moderator, target);
      if (error) {
        await interaction.reply({ content: error, flags: MessageFlags.Ephemeral });
        return;
      }
    }

    const expiresAt = Date.now() + durationMs;
    if (target) await notifyUser(user, interaction.guild, "tempban", reason);
    await interaction.guild.members.ban(user.id, { reason });
    const modCase = await recordCase(interaction.guild, {
      type: "tempban",
      user,
      moderator: interaction.user,
      reason,
      expiresAt,
      active: true,
    });

    await interaction.reply({
      content: `🔨 **${user.tag}** banni pour ${formatDuration(durationMs)} (case #${modCase.id}).`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
