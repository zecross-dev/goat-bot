import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/command.js";
import { recordCase } from "../moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Débannit un utilisateur.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption((o) =>
      o.setName("user").setDescription("Utilisateur à débannir.").setRequired(true),
    )
    .addStringOption((o) => o.setName("reason").setDescription("Raison du débannissement.")),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return;

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? undefined;

    const ban = await interaction.guild.bans.fetch(user.id).catch(() => null);
    if (!ban) {
      await interaction.reply({
        content: "Cet utilisateur n'est pas banni.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.guild.bans.remove(user.id, reason);
    const modCase = await recordCase(interaction.guild, {
      type: "unban",
      user,
      moderator: interaction.user,
      reason,
    });

    await interaction.reply({
      content: `♻️ **${user.tag}** a été débanni (case #${modCase.id}).`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
