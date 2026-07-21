import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/command.js";
import {
  MAX_TIMEOUT_MS,
  checkActable,
  formatDuration,
  notifyUser,
  parseDuration,
  recordCase,
} from "../moderation.js";

const DEFAULT_MUTE_MS = 60 * 60 * 1000; // 1 hour

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Rend muet un membre via un timeout Discord.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((o) =>
      o.setName("member").setDescription("Membre à rendre muet.").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("duration").setDescription("Durée (ex : 10m, 2h, 1d). Défaut : 1h. Max : 28j."),
    )
    .addStringOption((o) => o.setName("reason").setDescription("Raison du mute.")),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return;

    const user = interaction.options.getUser("member", true);
    const reason = interaction.options.getString("reason") ?? undefined;
    const durationInput = interaction.options.getString("duration");

    let durationMs = DEFAULT_MUTE_MS;
    if (durationInput) {
      const parsed = parseDuration(durationInput);
      if (parsed === null) {
        await interaction.reply({
          content: "Durée invalide. Exemples : `10m`, `2h`, `1d`.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      durationMs = Math.min(parsed, MAX_TIMEOUT_MS);
    }

    const moderator = await interaction.guild.members.fetch(interaction.user.id);
    const target = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!target) {
      await interaction.reply({
        content: "Ce membre n'est pas sur le serveur.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const error = checkActable(moderator, target);
    if (error) {
      await interaction.reply({ content: error, flags: MessageFlags.Ephemeral });
      return;
    }

    await target.timeout(durationMs, reason);
    await notifyUser(user, interaction.guild, "mute", reason, `Durée : ${formatDuration(durationMs)}`);
    const modCase = await recordCase(interaction.guild, {
      type: "mute",
      user,
      moderator: interaction.user,
      reason,
      expiresAt: Date.now() + durationMs,
    });

    await interaction.reply({
      content: `🔇 **${user.tag}** rendu muet pour ${formatDuration(durationMs)} (case #${modCase.id}).`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
