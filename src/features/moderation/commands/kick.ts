import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/command.js";
import { checkActable, notifyUser, recordCase } from "../moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Expulse un membre du serveur.")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false)
    .addUserOption((o) =>
      o.setName("member").setDescription("Membre à expulser.").setRequired(true),
    )
    .addStringOption((o) => o.setName("reason").setDescription("Raison de l'expulsion.")),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return;

    const user = interaction.options.getUser("member", true);
    const reason = interaction.options.getString("reason") ?? undefined;
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

    await notifyUser(user, interaction.guild, "kick", reason);
    await target.kick(reason);
    const modCase = await recordCase(interaction.guild, {
      type: "kick",
      user,
      moderator: interaction.user,
      reason,
    });

    await interaction.reply({
      content: `👢 **${user.tag}** a été expulsé (case #${modCase.id}).`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
